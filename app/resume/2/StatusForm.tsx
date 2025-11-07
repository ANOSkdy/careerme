"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import {
  ResumeStatusSchema,
  type ResumeStatus,
} from "../../lib/validation/schemas";

const STORAGE_KEY = "resume.resumeId";

const eduStatusOptions: ResumeStatus["eduStatus"][] = ["在学中", "卒業済み"];
const joinTimingOptions: ResumeStatus["joinTiming"][] = [
  "すぐ",
  "3ヶ月以内",
  "半年以内",
  "1年以内",
  "いい所があれば",
];
const jobChangeCountOptions: ResumeStatus["jobChangeCount"][] = [
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

type FormState = {
  eduStatus: ResumeStatus["eduStatus"] | "";
  joinTiming: ResumeStatus["joinTiming"] | "";
  jobChangeCount: ResumeStatus["jobChangeCount"] | "";
};

type FieldKey = keyof FormState;

const initialForm: FormState = {
  eduStatus: "",
  joinTiming: "",
  jobChangeCount: "",
};

function parseResumeStatus(payload: unknown): ResumeStatus | null {
  if (!payload || typeof payload !== "object") return null;

  const direct = ResumeStatusSchema.safeParse(payload);
  if (direct.success) return direct.data;

  const note = (payload as { note?: unknown }).note;
  if (typeof note === "string") {
    try {
      const parsed = JSON.parse(note);
      const fromNote = ResumeStatusSchema.safeParse(parsed);
      if (fromNote.success) return fromNote.data;
    } catch (error) {
      console.warn("Failed to parse resume status note", error);
    }
  }

  return null;
}

function extractResumeStatus(payload: unknown): ResumeStatus | null {
  if (!payload) return null;
  const candidates = [
    (payload as { step2?: unknown })?.step2,
    (payload as { data?: { step2?: unknown } })?.data?.step2,
    payload,
  ];

  for (const candidate of candidates) {
    const parsed = parseResumeStatus(candidate);
    if (parsed) return parsed;
  }

  return null;
}

export default function StatusForm() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const formRef = useRef<FormState>(initialForm);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    eduStatus: false,
    joinTiming: false,
    jobChangeCount: false,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      resumeIdRef.current = stored;
      setResumeId(stored);
    }
  }, []);

  useEffect(() => {
    if (!resumeId) return;

    let cancelled = false;
    const controller = new AbortController();
    setLoadError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ id: resumeId, draftId: resumeId });
        const res = await fetch(`/api/data/resume?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`failed to fetch resume status: ${res.status}`);
        }

        const data = await res.json();
        const status = extractResumeStatus(data);
        if (!cancelled && status) {
          const nextForm: FormState = {
            eduStatus: status.eduStatus,
            joinTiming: status.joinTiming,
            jobChangeCount: status.jobChangeCount,
          };
          lastSavedRef.current = JSON.stringify(status);
          formRef.current = nextForm;
          setForm(nextForm);
          setTouched({ eduStatus: false, joinTiming: false, jobChangeCount: false });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load resume status", error);
        if (!cancelled) {
          setLoadError("データの取得に失敗しました");
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resumeId]);

  const validation = useMemo(() => ResumeStatusSchema.safeParse(form), [form]);

  const errors = useMemo(() => {
    if (validation.success) return {} as Partial<Record<FieldKey, string>>;
    const map: Partial<Record<FieldKey, string>> = {};
    for (const issue of validation.error.issues) {
      const key = issue.path.join(".");
      if (key === "eduStatus" || key === "joinTiming" || key === "jobChangeCount") {
        map[key] = issue.message;
      }
    }
    return map;
  }, [validation]);

  const ensureResumeId = useCallback(() => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (typeof window === "undefined") return null;
    const generated = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_KEY, generated);
    resumeIdRef.current = generated;
    setResumeId(generated);
    return generated;
  }, []);

  const saveStatus = useCallback(
    async (value: ResumeStatus) => {
      const snapshot = JSON.stringify(value);
      if (snapshot === lastSavedRef.current) {
        if (mountedRef.current) {
          setSaveState("saved");
          setTimeout(() => {
            if (mountedRef.current) setSaveState("idle");
          }, 1200);
        }
        return;
      }

      const id = ensureResumeId();
      if (!id) return;

      setSaveState("saving");
      try {
        const body = {
          draftId: id,
          step: 2 as const,
          data: {
            status: "student",
            note: JSON.stringify({ ...value, version: "resume-status/v1" }),
          },
        };

        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`failed to save resume status: ${res.status}`);
        }

        lastSavedRef.current = snapshot;
        if (mountedRef.current) {
          setSaveState("saved");
          setTimeout(() => {
            if (mountedRef.current) setSaveState("idle");
          }, 1200);
        }
      } catch (error) {
        console.error("Failed to save resume status", error);
        if (mountedRef.current) {
          setSaveState("error");
        }
      }
    },
    [ensureResumeId]
  );

  const handleFieldChange = useCallback((field: FieldKey, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value } as FormState;
      formRef.current = next;
      return next;
    });
  }, []);

  const handleFieldBlur = useCallback(
    (field: FieldKey) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const result = ResumeStatusSchema.safeParse(formRef.current);
      if (result.success) {
        void saveStatus(result.data);
      }
    },
    [saveStatus]
  );

  const nextDisabled = !validation.success;

  return (
    <form aria-describedby={loadError ? "status-load-error" : undefined}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-text-strong, #111827)",
            marginBottom: "8px",
          }}
        >
          就学状況
        </h2>
        <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem" }}>
          入力内容はフィールドから離れたタイミングで自動保存されます。
        </p>
        {loadError && (
          <p
            id="status-load-error"
            role="alert"
            style={{ marginTop: "8px", color: "#dc2626", fontSize: "0.875rem" }}
          >
            {loadError}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        <div>
          <label
            htmlFor="eduStatus"
            style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
          >
            就学状況 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="eduStatus"
            name="eduStatus"
            value={form.eduStatus}
            onChange={(event) => handleFieldChange("eduStatus", event.target.value)}
            onBlur={() => handleFieldBlur("eduStatus")}
            aria-invalid={touched.eduStatus && Boolean(errors.eduStatus)}
            aria-describedby={errors.eduStatus ? "error-eduStatus" : undefined}
            required
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {eduStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.eduStatus && errors.eduStatus && (
            <p
              id="error-eduStatus"
              role="alert"
              style={{ marginTop: "4px", color: "#dc2626", fontSize: "0.875rem" }}
            >
              {errors.eduStatus}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="joinTiming"
            style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
          >
            入社希望時期 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="joinTiming"
            name="joinTiming"
            value={form.joinTiming}
            onChange={(event) => handleFieldChange("joinTiming", event.target.value)}
            onBlur={() => handleFieldBlur("joinTiming")}
            aria-invalid={touched.joinTiming && Boolean(errors.joinTiming)}
            aria-describedby={errors.joinTiming ? "error-joinTiming" : undefined}
            required
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {joinTimingOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.joinTiming && errors.joinTiming && (
            <p
              id="error-joinTiming"
              role="alert"
              style={{ marginTop: "4px", color: "#dc2626", fontSize: "0.875rem" }}
            >
              {errors.joinTiming}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="jobChangeCount"
            style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
          >
            転職回数 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="jobChangeCount"
            name="jobChangeCount"
            value={form.jobChangeCount}
            onChange={(event) => handleFieldChange("jobChangeCount", event.target.value)}
            onBlur={() => handleFieldBlur("jobChangeCount")}
            aria-invalid={touched.jobChangeCount && Boolean(errors.jobChangeCount)}
            aria-describedby={errors.jobChangeCount ? "error-jobChangeCount" : undefined}
            required
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="" disabled>
              選択してください
            </option>
            {jobChangeCountOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {touched.jobChangeCount && errors.jobChangeCount && (
            <p
              id="error-jobChangeCount"
              role="alert"
              style={{ marginTop: "4px", color: "#dc2626", fontSize: "0.875rem" }}
            >
              {errors.jobChangeCount}
            </p>
          )}
        </div>
      </div>

      <AutoSaveBadge state={saveState} />

      <StepNav step={2} nextDisabled={nextDisabled} />
    </form>
  );
}
