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
import Modal from "../../../components/ui/Modal";
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

function findLabel(options: TagOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function ResumeStep5Page() {
  const router = useRouter();
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
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(desired));

  const validation = useMemo(() => DesiredConditionsSchema.safeParse(desired), [desired]);
  const hasAnySelection = useMemo(
    () => desired.locations.length + desired.roles.length + desired.industries.length > 0,
    [desired]
  );

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

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(true);
      setSubmitError(null);
      if (!hasAnySelection || !validation.success) {
        return;
      }
      const success = await flushSaves();
      if (!success) {
        setSubmitError("保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      router.push("/cv/1");
    },
    [flushSaves, hasAnySelection, router, validation.success]
  );

  const renderChipGroup = useCallback(
    (values: string[], options: TagOption[], onRemove: (value: string) => void) => {
      if (!values.length) {
        return <p className="chip-group__empty">未選択</p>;
      }
      return (
        <div className="chip-group">
          {values.map((value) => (
            <span key={value} className="chip">
              {findLabel(options, value)}
              <button type="button" onClick={() => onRemove(value)} aria-label={`${findLabel(options, value)}を削除`}>
                ×
              </button>
            </span>
          ))}
        </div>
      );
    },
    []
  );

  const loadErrorId = loadError ? "desired-load-error" : undefined;

  return (
    <>
      <form aria-describedby={loadErrorId} onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: "24px" }}>
          <h2 className="resume-page-title">希望条件</h2>
          <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem" }}>
            希望する勤務地・職種・業界を選択してください。
          </p>
          <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem", marginTop: "8px" }}>
            入力内容は2秒後に自動保存されます。ページ移動時にも保存されます。
          </p>
          {loadError ? (
            <p
              id={loadErrorId}
              role="alert"
              style={{ marginTop: "8px", color: "#dc2626", fontSize: "0.875rem" }}
            >
              {loadError}
            </p>
          ) : null}
        </div>

        <div className="resume-form" style={{ display: "grid", gap: "24px" }}>
          <section className="desired-section">
            <header className="desired-section__header">
              <h2>希望勤務地</h2>
              <button type="button" className="button button--secondary" onClick={() => setLocationsOpen(true)}>
                選択する
              </button>
            </header>
            {renderChipGroup(desired.locations, lookupOptions.locations, toggleLocation)}
          </section>

          <section className="desired-section">
            <header className="desired-section__header">
              <h2>希望職種</h2>
              <button type="button" className="button button--secondary" onClick={() => setRolesOpen(true)}>
                選択する
              </button>
            </header>
            {renderChipGroup(desired.roles, lookupOptions.roles, toggleRole)}
          </section>

          <section className="desired-section">
            <header className="desired-section__header">
              <h2>希望業界</h2>
              <button type="button" className="button button--secondary" onClick={() => setIndustriesOpen(true)}>
                選択する
              </button>
            </header>
            {renderChipGroup(desired.industries, lookupOptions.industries, toggleIndustry)}
          </section>

          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : null}
          {!hasAnySelection && submitted ? (
            <p className="form-error" role="alert">
              いずれかの項目を1つ以上選択してください。
            </p>
          ) : null}
        </div>

        <AutoSaveBadge state={saveState} />

        <StepNav
          step={5}
          totalSteps={5}
          prevHref="/resume/4"
          nextHref="/cv/1"
          nextType="submit"
          nextDisabled={isLoading || !hasAnySelection || !validation.success}
          nextLabel="次へ"
        />
      </form>

      <Modal open={locationsOpen} onClose={() => setLocationsOpen(false)} title="希望勤務地">
        <div className="modal-list">
          {lookupOptions.locations.map((option) => {
            const checked = desired.locations.includes(option.value);
            const disabled = !checked && desired.locations.length >= MAX_LOCATIONS;
            return (
              <label key={option.value} className={`modal-option${disabled ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleLocation(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="button button--primary" onClick={() => setLocationsOpen(false)}>
            閉じる
          </button>
        </div>
      </Modal>

      <Modal open={rolesOpen} onClose={() => setRolesOpen(false)} title="希望職種">
        <div className="modal-list">
          {lookupOptions.roles.map((option) => {
            const checked = desired.roles.includes(option.value);
            const disabled = !checked && desired.roles.length >= MAX_ROLES;
            return (
              <label key={option.value} className={`modal-option${disabled ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleRole(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="button button--primary" onClick={() => setRolesOpen(false)}>
            閉じる
          </button>
        </div>
      </Modal>

      <Modal open={industriesOpen} onClose={() => setIndustriesOpen(false)} title="希望業界">
        <div className="modal-list">
          {lookupOptions.industries.map((option) => {
            const checked = desired.industries.includes(option.value);
            const disabled = !checked && desired.industries.length >= MAX_INDUSTRIES;
            return (
              <label key={option.value} className={`modal-option${disabled ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleIndustry(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="button button--primary" onClick={() => setIndustriesOpen(false)}>
            閉じる
          </button>
        </div>
      </Modal>
    </div>
  );
}
