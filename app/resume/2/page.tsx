"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import AutoSaveBadge from "../_components/AutoSaveBadge";
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

type ResumeResponse = {
  id?: string | null;
  status?: ResumeStatus | null;
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

export default function ResumeStep2Page() {
  return <ResumeStatusForm />;
}

function ResumeStatusForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isLoading, setIsLoading] = useState(true);
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

  const handleFieldChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleNextClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (!parsed.success) {
        return;
      }
      event.preventDefault();
      const saved = await saveStatus(parsed.data, { force: true });
      if (saved) {
        router.push("/resume/3");
        return;
      }
      router.push("/resume/3");
    },
    [parsed, router, saveStatus]
  );

  return (
    <form>
      <div style={{ marginBottom: "24px" }}>
        <h2 className="resume-page-title">就学状況</h2>
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        <div>
          <label htmlFor="eduStatus" style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
            就学状況
          </label>
          <select
            id="eduStatus"
            name="eduStatus"
            value={form.eduStatus}
            onChange={(event) => handleFieldChange("eduStatus", event.target.value)}
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="">選択してください</option>
            {eduStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="joinTiming" style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
            入社希望時期
          </label>
          <select
            id="joinTiming"
            name="joinTiming"
            value={form.joinTiming}
            onChange={(event) => handleFieldChange("joinTiming", event.target.value)}
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="">選択してください</option>
            {joinTimingOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="jobChangeCount" style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}>
            転職回数
          </label>
          <select
            id="jobChangeCount"
            name="jobChangeCount"
            value={form.jobChangeCount}
            onChange={(event) => handleFieldChange("jobChangeCount", event.target.value)}
            style={{
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 12px",
              backgroundColor: "#fff",
              fontSize: "1rem",
            }}
          >
            <option value="">選択してください</option>
            {jobChangeCountOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AutoSaveBadge state={saveState} />

      <nav className="step-nav" aria-label="ステップナビゲーション">
        <Link href="/resume/1" className="step-nav__button step-nav__button--secondary">
          戻る
        </Link>
        <div className="step-nav__status">Step 2 / 5</div>
        <Link
          href="/resume/3"
          className="step-nav__button step-nav__button--primary"
          onClick={handleNextClick}
        >
          次へ
        </Link>
      </nav>
    </form>
  );
}
