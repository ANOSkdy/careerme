
"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import {
  ResumeStatusSchema,
  type ResumeStatus,
} from "../../../lib/validation/schemas";

type FormState = {
  eduStatus: ResumeStatus["eduStatus"] | "";
  joinTiming: ResumeStatus["joinTiming"] | "";
  jobChangeCount: ResumeStatus["jobChangeCount"] | "";
};

type FieldKey = keyof FormState;

type ResumeResponse = {
  id?: string | null;
  status?: ResumeStatus | null;
};

const fieldErrorMessages: Record<FieldKey, string> = {
  eduStatus: "就学状況を選択してください",
  joinTiming: "入社希望時期を選択してください",
  jobChangeCount: "転職回数を選択してください",
};

const initialForm: FormState = {
  eduStatus: "",
  joinTiming: "",
  jobChangeCount: "",
};

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

export default function StatusForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    eduStatus: false,
    joinTiming: false,
    jobChangeCount: false,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/data/resume", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load resume status: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;

        const id = typeof data.id === "string" && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }
        if (data.status) {
          const parsed = ResumeStatusSchema.safeParse(data.status);
          if (parsed.success) {
            const next: FormState = {
              eduStatus: parsed.data.eduStatus,
              joinTiming: parsed.data.joinTiming,
              jobChangeCount: parsed.data.jobChangeCount,
            };
            setForm(next);
            lastSnapshotRef.current = JSON.stringify(parsed.data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load resume status", error);
          if (!cancelled) {
            setLoadError("データの取得に失敗しました");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const ensureResumeId = useCallback(async () => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (ensureIdPromiseRef.current) return ensureIdPromiseRef.current;

    ensureIdPromiseRef.current = (async () => {
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ touch: true }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to ensure resume id: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        const id = typeof data.id === "string" && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }
        return id;
      } catch (error) {
        console.error("Failed to ensure resume id", error);
        return null;
      } finally {
        ensureIdPromiseRef.current = null;
      }
    })();

    return ensureIdPromiseRef.current;
  }, []);

  const parsed = useMemo(() => ResumeStatusSchema.safeParse(form), [form]);

  useEffect(() => {
    if (parsed.success) {
      setErrors({});
    } else {
      const map: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key === "eduStatus" || key === "joinTiming" || key === "jobChangeCount") {
          map[key] = fieldErrorMessages[key as FieldKey];
        }
      }
      setErrors(map);
    }
  }, [parsed]);

  const saveStatus = useCallback(
    async (value: ResumeStatus, options: { force?: boolean } = {}) => {
      const snapshot = JSON.stringify(value);
      if (!options.force && snapshot === lastSnapshotRef.current && resumeIdRef.current) {
        return true;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setSaveState("error");
        return false;
      }

      setSaveState("saving");
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ensuredId, status: value }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to save status: ${res.status}`);
        }
        const json = (await res.json()) as ResumeResponse;
        const id = typeof json.id === "string" && json.id ? json.id : ensuredId;
        resumeIdRef.current = id;
        setResumeId(id);
        lastSnapshotRef.current = snapshot;
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
        return true;
      } catch (error) {
        console.error("Failed to save resume status", error);
        setSaveState("error");
        return false;
      }
    },
    [ensureResumeId]
  );

  const autoSavePayload = parsed.success ? parsed.data : null;

  useAutoSave(autoSavePayload, async (value) => {
    if (!value) return;
    await saveStatus(value);
  }, 2000, { enabled: Boolean(autoSavePayload) && !isLoading });

  const handleFieldChange = useCallback((field: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFieldBlur = useCallback((field: FieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTouched({ eduStatus: true, joinTiming: true, jobChangeCount: true });
      if (!parsed.success) return;

      setIsSubmitting(true);
      const saved = await saveStatus(parsed.data, { force: true });
      setIsSubmitting(false);
      if (saved) {
        router.push("/resume/3");
      }
    },
    [parsed, saveStatus, router]
  );

  const nextDisabled = !parsed.success || isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit} aria-describedby={loadError ? "status-load-error" : undefined}>
      <div style={{ marginBottom: "24px" }}>
        <h2 className="resume-page-title">就学状況</h2>
        <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem" }}>
          入力内容は2秒後に自動保存されます。ページ移動時にも保存されます。
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

      <StepNav step={2} nextType="submit" nextDisabled={nextDisabled} />
    </form>
  );
}
