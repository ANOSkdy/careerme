"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ResumeStep5Template } from "./template";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import type { SaveState } from "../_components/hooks/useAutoSave";
import type { TagOption } from "../../../components/ui/TagSelector";
import {
  DesiredConditionsSchema,
  type DesiredConditions,
} from "../../../lib/validation/schemas";

const MAX_LOCATIONS = 5;
const MAX_ROLES = 10;
const MAX_INDUSTRIES = 10;

const RESUME_API = "/api/data/resume";

type LookupResponse = {
  options?: Record<string, TagOption[]>;
};

type ResumeResponse = {
  id?: string | null;
  desired?: unknown;
};

function toDesired(value: unknown): DesiredConditions {
  const parsed = DesiredConditionsSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return { locations: [], roles: [], industries: [] };
}

export default function ResumeStep5Page() {
  return (
    <ResumeStep5Template>
      <ResumeStep5PageContent />
    </ResumeStep5Template>
  );
}

function ResumeStep5PageContent() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const [desired, setDesired] = useState<DesiredConditions>({
    locations: [],
    roles: [],
    industries: [],
  });
  const desiredRef = useRef<DesiredConditions>(desired);
  const [lookupOptions, setLookupOptions] = useState<{ locations: TagOption[]; roles: TagOption[]; industries: TagOption[] }>({
    locations: [],
    roles: [],
    industries: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(desired));

  useEffect(() => {
    desiredRef.current = desired;
  }, [desired]);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  const ensureResumeId = useCallback(async () => {
    try {
      const res = await fetch(RESUME_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touch: true }),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`failed to ensure resume id: ${res.status}`);
      }
      const json = (await res.json()) as ResumeResponse;
      const id = typeof json.id === "string" && json.id ? json.id : null;
      if (id) {
        resumeIdRef.current = id;
        setResumeId(id);
      }
      return id;
    } catch (error) {
      console.error("Failed to ensure resume id", error);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const lookupRes = await fetch("/api/data/lookups", { cache: "force-cache" });
        if (lookupRes.ok) {
          const lookupJson = (await lookupRes.json()) as LookupResponse;
          const options = lookupJson?.options;
          if (!cancelled && options) {
            setLookupOptions((prev) => ({
              locations: options.locations ?? prev.locations,
              roles: options.roles ?? prev.roles,
              industries: options.industries ?? prev.industries,
            }));
          }
        }

        const resumeRes = await fetch(RESUME_API, { cache: "no-store" });
        if (!resumeRes.ok) {
          throw new Error(`failed to load resume: ${resumeRes.status}`);
        }
        const resumeJson = (await resumeRes.json()) as ResumeResponse;
        if (cancelled) return;

        let id = typeof resumeJson.id === "string" && resumeJson.id ? resumeJson.id : null;
        if (!id) {
          id = await ensureResumeId();
        } else {
          resumeIdRef.current = id;
          setResumeId(id);
        }

        const desiredValue = toDesired(resumeJson.desired);
        if (!cancelled) {
          setDesired(desiredValue);
          desiredRef.current = desiredValue;
          lastSavedRef.current = JSON.stringify(desiredValue);
        }
      } catch (error) {
        console.error("Failed to bootstrap desired conditions", error);
        if (!cancelled) {
          setLoadError("希望条件の読み込みに失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [ensureResumeId]);

  const saveDesired = useCallback(async (value: DesiredConditions): Promise<boolean> => {
    const resumeIdValue = resumeIdRef.current;
    if (!resumeIdValue) return true;
    setSaveState("saving");
    try {
      const res = await fetch(RESUME_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resumeIdValue, desired: value }),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`failed to save desired conditions: ${res.status}`);
      }
      lastSavedRef.current = JSON.stringify(value);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1200);
      return true;
    } catch (error) {
      console.error("Failed to save desired conditions", error);
      setSaveState("error");
      return false;
    }
  }, []);

  const flushSaves = useCallback(async () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    const resumeIdValue = resumeIdRef.current;
    if (!resumeIdValue) return true;
    const snapshot = JSON.stringify(desiredRef.current);
    if (snapshot === lastSavedRef.current) {
      return true;
    }
    return saveDesired(desiredRef.current);
  }, [saveDesired]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      void flushSaves();
    };
  }, [flushSaves]);

  useEffect(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (!resumeIdRef.current) return;
    const snapshot = JSON.stringify(desired);
    if (snapshot === lastSavedRef.current) return;
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      void saveDesired(desiredRef.current);
    }, 2000);
  }, [desired, saveDesired]);

  const toggleLocation = useCallback(
    (value: string) => {
      setDesired((prev) => {
        const exists = prev.locations.includes(value);
        if (exists) {
          const next = prev.locations.filter((item) => item !== value);
          return { ...prev, locations: next };
        }
        if (prev.locations.length >= MAX_LOCATIONS) {
          return prev;
        }
        return { ...prev, locations: [...prev.locations, value] };
      });
    },
    []
  );

  const toggleIndustry = useCallback(
    (value: string) => {
      setDesired((prev) => {
        const exists = prev.industries.includes(value);
        if (exists) {
          return { ...prev, industries: prev.industries.filter((item) => item !== value) };
        }
        if (prev.industries.length >= MAX_INDUSTRIES) {
          return prev;
        }
        return { ...prev, industries: [...prev.industries, value] };
      });
    },
    []
  );

  const toggleRole = useCallback(
    (value: string) => {
      setDesired((prev) => {
        const exists = prev.roles.includes(value);
        if (exists) {
          return { ...prev, roles: prev.roles.filter((item) => item !== value) };
        }
        if (prev.roles.length >= MAX_ROLES) {
          return prev;
        }
        return { ...prev, roles: [...prev.roles, value] };
      });
    },
    []
  );

  return (
    <div className="resume-step">
      <h1 className="resume-step__title">希望条件</h1>
      <p className="resume-step__description">希望する勤務地・職種・業界を選択してください。</p>
      <div className="resume-step__status">
        <AutoSaveBadge state={saveState} />
      </div>
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
      <form className="resume5-form" noValidate>
        <PillSection
          title="希望勤務地"
          description="希望する勤務地を選択してください。選択後は自動的に保存されます。"
          name="desiredLocations"
          options={lookupOptions.locations}
          values={desired.locations}
          onToggle={toggleLocation}
          maxSelections={MAX_LOCATIONS}
          loading={isLoading}
        />

        <PillSection
          title="希望職種"
          description="希望する職種をタグで選択してください。"
          name="desiredRoles"
          options={lookupOptions.roles}
          values={desired.roles}
          onToggle={toggleRole}
          maxSelections={MAX_ROLES}
          loading={isLoading}
        />

        <PillSection
          title="希望業界"
          description="興味のある業界を選択してください。"
          name="desiredIndustries"
          options={lookupOptions.industries}
          values={desired.industries}
          onToggle={toggleIndustry}
          maxSelections={MAX_INDUSTRIES}
          loading={isLoading}
        />

        <div className="resume5-actions">
          <Link href="/resume/4" className="resume5-actions__link resume5-actions__link--secondary">
            戻る
          </Link>
          <div className="resume5-actions__status">Step 5 / 5</div>
          <Link
            href="/cv/2"
            className="resume5-actions__link resume5-actions__link--primary"
            onClick={() => {
              void flushSaves();
            }}
          >
            次へ
          </Link>
        </div>
      </form>
      <style jsx>{`
        .resume5-form {
          display: flex;
          flex-direction: column;
          gap: 32px;
          margin-top: 24px;
        }
        .resume5-section {
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 16px;
          padding: 24px;
          background: #ffffff;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        }
        .resume5-section__header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .resume5-section__header h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-strong, #0f172a);
        }
        .resume5-section__hint {
          font-size: 0.875rem;
          color: var(--color-text-muted, #64748b);
        }
        .resume5-section__description {
          margin-top: 8px;
          font-size: 0.9rem;
          color: var(--color-text-muted, #64748b);
          line-height: 1.6;
        }
        .resume5-section__loading,
        .resume5-section__empty {
          margin-top: 12px;
          font-size: 0.875rem;
          color: var(--color-text-muted, #64748b);
        }
        .resume5-pillbox {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 16px;
        }
        .resume5-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 10px 18px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #cbd5e1);
          background: #ffffff;
          color: var(--color-text, #1f2937);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .resume5-pill input {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }
        .resume5-pill__label {
          pointer-events: none;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .resume5-pill.is-selected {
          background: var(--color-primary, #2563eb);
          border-color: var(--color-primary, #2563eb);
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
        }
        .resume5-pill.is-disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .resume5-pill input:focus-visible + .resume5-pill__label {
          outline: 2px solid var(--color-primary, #2563eb);
          outline-offset: 4px;
          border-radius: 9999px;
        }
        .resume5-actions {
          margin-top: 8px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          align-items: center;
        }
        .resume5-actions__link {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 600;
          text-decoration: none;
        }
        .resume5-actions__link--secondary {
          background: #f1f5f9;
          color: var(--color-text, #1f2937);
        }
        .resume5-actions__link--primary {
          background: var(--color-primary, #2563eb);
          color: #ffffff;
        }
        .resume5-actions__status {
          text-align: center;
          font-size: 0.875rem;
          color: var(--color-text-muted, #64748b);
          font-weight: 500;
        }
        @media (max-width: 640px) {
          .resume5-section {
            padding: 20px;
          }
          .resume5-actions {
            grid-template-columns: 1fr;
          }
          .resume5-actions__status {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
}

type PillSectionProps = {
  title: string;
  description?: string;
  name: string;
  options: TagOption[];
  values: string[];
  onToggle: (value: string) => void;
  maxSelections: number;
  loading?: boolean;
};

function PillSection({
  title,
  description,
  name,
  options,
  values,
  onToggle,
  maxSelections,
  loading = false,
}: PillSectionProps) {
  const showLoading = loading && options.length === 0;
  const selectionHint = `最大${maxSelections}件（選択中 ${values.length}/${maxSelections}）`;

  return (
    <section className="resume5-section">
      <header className="resume5-section__header">
        <h2>{title}</h2>
        <span className="resume5-section__hint">{selectionHint}</span>
      </header>
      {description ? <p className="resume5-section__description">{description}</p> : null}
      {showLoading ? <p className="resume5-section__loading">候補を読み込み中です...</p> : null}
      <div className="resume5-pillbox" role="group" aria-label={title}>
        {options.map((option) => {
          const checked = values.includes(option.value);
          const disabled = !checked && values.length >= maxSelections;
          return (
            <label
              key={option.value}
              className={`resume5-pill${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
              aria-disabled={disabled}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onToggle(option.value)}
                disabled={disabled}
              />
              <span className="resume5-pill__label">{option.label}</span>
            </label>
          );
        })}
        {!showLoading && options.length === 0 ? (
          <p className="resume5-section__empty">利用可能な選択肢がありません。</p>
        ) : null}
      </div>
    </section>
  );
}
