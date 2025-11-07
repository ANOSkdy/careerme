"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import {
  ResumeStatusPartialSchema,
  ResumeStatusSchema,
  type ResumeStatus,
} from "../../../lib/validation/schemas";

type EduStatusOption = ResumeStatus["eduStatus"];
type JoinTimingOption = ResumeStatus["joinTiming"];
type JobChangeOption = ResumeStatus["jobChangeCount"];

type FormState = {
  eduStatus: EduStatusOption | "";
  joinTiming: JoinTimingOption | "";
  jobChangeCount: JobChangeOption | "";
};

type TouchedState = {
  eduStatus: boolean;
  joinTiming: boolean;
  jobChangeCount: boolean;
};

type FieldName = keyof FormState;
const FIELD_KEYS: FieldName[] = ["eduStatus", "joinTiming", "jobChangeCount"];

type ExtractedStatus = {
  form: FormState;
  snapshot: string | null;
};

const STORAGE_KEY = "resume.resumeId";

const EDU_STATUS_OPTIONS: EduStatusOption[] = ["在学中", "卒業済み"];
const JOIN_TIMING_OPTIONS: JoinTimingOption[] = [
  "すぐ",
  "3ヶ月以内",
  "半年以内",
  "1年以内",
  "いい所があれば",
];
const JOB_CHANGE_OPTIONS: JobChangeOption[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "10回以上",
];

const initialForm: FormState = {
  eduStatus: "",
  joinTiming: "",
  jobChangeCount: "",
};

const initialTouched: TouchedState = {
  eduStatus: false,
  joinTiming: false,
  jobChangeCount: false,
};

function formFromResumeStatus(value: ResumeStatus | Partial<ResumeStatus>): FormState {
  return {
    eduStatus: (value.eduStatus as EduStatusOption | undefined) ?? "",
    joinTiming: (value.joinTiming as JoinTimingOption | undefined) ?? "",
    jobChangeCount: (value.jobChangeCount as JobChangeOption | undefined) ?? "",
  };
}

function parseStatusCandidate(candidate: unknown): ExtractedStatus | null {
  if (!candidate) return null;

  if (typeof candidate === "string") {
    try {
      const parsed = JSON.parse(candidate);
      return parseStatusCandidate(parsed);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== "object") return null;

  const full = ResumeStatusSchema.safeParse(candidate);
  if (full.success) {
    return { form: formFromResumeStatus(full.data), snapshot: JSON.stringify(full.data) };
  }

  const partial = ResumeStatusPartialSchema.safeParse(candidate);
  if (partial.success) {
    return { form: formFromResumeStatus(partial.data), snapshot: null };
  }

  if (
    "note" in candidate &&
    candidate !== null &&
    typeof (candidate as { note?: unknown }).note === "string"
  ) {
    try {
      const parsed = JSON.parse((candidate as { note: string }).note);
      return parseStatusCandidate(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

function extractResumeStatus(payload: unknown): ExtractedStatus | null {
  const candidates: unknown[] = [
    (payload as { step2?: unknown })?.step2,
    (payload as { data?: { step2?: unknown } })?.data?.step2,
    payload,
  ];

  for (const candidate of candidates) {
    const parsed = parseStatusCandidate(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function toResumeStatus(form: FormState): ResumeStatus | null {
  const parsed = ResumeStatusSchema.safeParse(form);
  if (!parsed.success) return null;
  return parsed.data;
}

export default function StatusForm() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<TouchedState>(initialTouched);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);

  const formRef = useRef(form);
  const lastSavedRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    lastSavedRef.current = lastSavedSnapshot;
  }, [lastSavedSnapshot]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setResumeId(stored);
      return;
    }
    const generated =
      window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
    window.localStorage.setItem(STORAGE_KEY, generated);
    setResumeId(generated);
  }, []);

  useEffect(() => {
    if (!resumeId) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ id: resumeId, draftId: resumeId });
        const res = await fetch(`/api/data/resume?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          console.warn("Failed to fetch resume status", res.status);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const extracted = extractResumeStatus(data);
        if (extracted) {
          setForm(extracted.form);
          setTouched(initialTouched);
          setLastSavedSnapshot(extracted.snapshot);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load resume status", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resumeId]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const attemptSave = useCallback(async () => {
    if (!resumeId) return;
    if (savingRef.current) return;

    const status = toResumeStatus(formRef.current);
    if (!status) return;

    const snapshot = JSON.stringify(status);
    if (snapshot === lastSavedRef.current) return;

    savingRef.current = true;
    setSaveState("saving");
    try {
      const mappedStatus = status.eduStatus === "在学中" ? "student" : "other";
      const res = await fetch("/api/data/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: resumeId,
          step: 2,
          data: {
            status: mappedStatus,
            note: JSON.stringify(status),
          },
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `failed to save resume status: ${res.status}`);
      }
      setLastSavedSnapshot(snapshot);
      setSaveState("saved");
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => setSaveState("idle"), 1200);
    } catch (error) {
      console.error("Failed to save resume status", error);
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }, [resumeId]);

  const parsed = useMemo(() => ResumeStatusSchema.safeParse(form), [form]);

  const fieldErrors = useMemo(() => {
    if (parsed.success) return {} as Partial<Record<FieldName, string>>;
    const map: Partial<Record<FieldName, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && FIELD_KEYS.includes(key as FieldName)) {
        map[key as FieldName] = issue.message;
      }
    }
    return map;
  }, [parsed]);

  const handleChange = useCallback(
    (field: FieldName) => (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as FormState[FieldName];
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleBlur = useCallback(
    (field: FieldName) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      void attemptSave();
    },
    [attemptSave]
  );

  const labelStyle = {
    display: "block",
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--color-text-strong, #111827)",
    marginBottom: "4px",
  } as const;

  const selectBaseStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    lineHeight: 1.4,
    backgroundColor: "var(--color-surface, #FFFFFF)",
    color: "var(--color-text, #1f2937)",
  } as const;

  const helperStyle = {
    marginTop: "4px",
    fontSize: "0.75rem",
    color: "var(--color-error, #dc2626)",
  } as const;

  const isNextDisabled = !parsed.success;

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--color-text-strong, #111827)",
          marginBottom: "24px",
        }}
      >
        就学状況
      </h2>

      <div style={{ display: "grid", gap: "20px" }}>
        <div>
          <label htmlFor="eduStatus" style={labelStyle}>
            就学状況 <span aria-hidden="true" style={{ color: "var(--color-error, #dc2626)" }}>*</span>
          </label>
          <select
            id="eduStatus"
            name="eduStatus"
            value={form.eduStatus}
            onChange={handleChange("eduStatus")}
            onBlur={handleBlur("eduStatus")}
            aria-required="true"
            aria-invalid={touched.eduStatus && Boolean(fieldErrors.eduStatus)}
            aria-describedby={
              touched.eduStatus && fieldErrors.eduStatus ? "error-eduStatus" : undefined
            }
            style={{
              ...selectBaseStyle,
              border: `1px solid ${
                touched.eduStatus && fieldErrors.eduStatus
                  ? "var(--color-error, #dc2626)"
                  : "var(--color-border, #d1d5db)"
              }`,
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {EDU_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.eduStatus && fieldErrors.eduStatus ? (
            <p id="error-eduStatus" role="alert" style={helperStyle}>
              {fieldErrors.eduStatus}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="joinTiming" style={labelStyle}>
            入社希望時期 <span aria-hidden="true" style={{ color: "var(--color-error, #dc2626)" }}>*</span>
          </label>
          <select
            id="joinTiming"
            name="joinTiming"
            value={form.joinTiming}
            onChange={handleChange("joinTiming")}
            onBlur={handleBlur("joinTiming")}
            aria-required="true"
            aria-invalid={touched.joinTiming && Boolean(fieldErrors.joinTiming)}
            aria-describedby={
              touched.joinTiming && fieldErrors.joinTiming ? "error-joinTiming" : undefined
            }
            style={{
              ...selectBaseStyle,
              border: `1px solid ${
                touched.joinTiming && fieldErrors.joinTiming
                  ? "var(--color-error, #dc2626)"
                  : "var(--color-border, #d1d5db)"
              }`,
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {JOIN_TIMING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.joinTiming && fieldErrors.joinTiming ? (
            <p id="error-joinTiming" role="alert" style={helperStyle}>
              {fieldErrors.joinTiming}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="jobChangeCount" style={labelStyle}>
            転職回数 <span aria-hidden="true" style={{ color: "var(--color-error, #dc2626)" }}>*</span>
          </label>
          <select
            id="jobChangeCount"
            name="jobChangeCount"
            value={form.jobChangeCount}
            onChange={handleChange("jobChangeCount")}
            onBlur={handleBlur("jobChangeCount")}
            aria-required="true"
            aria-invalid={touched.jobChangeCount && Boolean(fieldErrors.jobChangeCount)}
            aria-describedby={
              touched.jobChangeCount && fieldErrors.jobChangeCount
                ? "error-jobChangeCount"
                : undefined
            }
            style={{
              ...selectBaseStyle,
              border: `1px solid ${
                touched.jobChangeCount && fieldErrors.jobChangeCount
                  ? "var(--color-error, #dc2626)"
                  : "var(--color-border, #d1d5db)"
              }`,
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {JOB_CHANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.jobChangeCount && fieldErrors.jobChangeCount ? (
            <p id="error-jobChangeCount" role="alert" style={helperStyle}>
              {fieldErrors.jobChangeCount}
            </p>
          ) : null}
        </div>
      </div>

      <AutoSaveBadge state={saveState} />

      <StepNav step={2} nextDisabled={isNextDisabled} />
    </div>
  );
}
