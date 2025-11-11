"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";

import type { ZodError } from "zod";

import { createPreferredLocationSchema } from "../../../lib/validation/schemas";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import TagInput from "../_components/TagInput";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { DesiredSchema } from "../_schemas/resume";
import StepNav from "../_components/StepNav";

type Option = { value: string; label: string };

type LookupResponse = {
  options?: Array<{ value?: string; label?: string } | string>;
  records?: Array<{ value?: string; label?: string }>;
};

type ResumeResponse = {
  preferredLocation?: unknown;
  desired?: unknown;
  data?: { preferredLocation?: unknown; desired?: unknown };
  fields?: { preferredLocation?: unknown; desired?: unknown };
};

const STORAGE_KEY = "resume.resumeId";
const ERROR_MESSAGE = "希望勤務地を選択してください";

type DesiredSnapshot = {
  preferredLocation: string | null;
  roles: string[];
  industries: string[];
  locations: string[];
};

function extractValidationMessage(
  error: ZodError<{ preferredLocation: string }>
): string {
  return error.flatten().fieldErrors.preferredLocation?.[0] ?? ERROR_MESSAGE;
}

function parseDesired(candidate: unknown) {
  const value = (() => {
    if (typeof candidate === "string") {
      try {
        return JSON.parse(candidate) as unknown;
      } catch (error) {
        console.error("Failed to parse desired JSON", error);
        return null;
      }
    }
    return candidate ?? null;
  })();

  if (!value || typeof value !== "object") return null;
  const result = DesiredSchema.safeParse(value);
  if (!result.success) return null;
  return result.data;
}

function uniqueTags(values: readonly string[] | undefined): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function extractDesiredSnapshot(
  payload: ResumeResponse | null | undefined
): DesiredSnapshot {
  const fallback: DesiredSnapshot = {
    preferredLocation: null,
    roles: [],
    industries: [],
    locations: [],
  };

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const preferredCandidates: unknown[] = [
    payload.preferredLocation,
    payload.data?.preferredLocation,
    payload.fields?.preferredLocation,
  ];

  let preferredLocation: string | null = null;
  for (const candidate of preferredCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      preferredLocation = candidate.trim();
      break;
    }
  }

  const desiredCandidates: unknown[] = [
    payload.desired,
    payload.data?.desired,
    payload.fields?.desired,
  ];

  for (const candidate of desiredCandidates) {
    const parsed = parseDesired(candidate);
    if (!parsed) continue;
    const roles = uniqueTags(parsed.roles);
    const industries = uniqueTags(parsed.industries);
    const locations = uniqueTags(parsed.locations);
    return {
      preferredLocation:
        preferredLocation ?? locations.find((location) => location.length > 0) ?? null,
      roles,
      industries,
      locations,
    };
  }

  return fallback;
}

function normalizeOptions(payload: LookupResponse): Option[] {
  const result: Option[] = [];
  const seen = new Set<string>();

  const candidates: Array<{ value?: unknown; label?: unknown } | string> = [];
  if (Array.isArray(payload?.options)) {
    candidates.push(...payload.options);
  }
  if (Array.isArray(payload?.records)) {
    for (const record of payload.records) {
      candidates.push(record as { value?: unknown; label?: unknown });
    }
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const value = candidate.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      result.push({ value, label: value });
      continue;
    }
    if (!candidate || typeof candidate !== "object") continue;
    const rawValue = candidate.value;
    const rawLabel = candidate.label;
    const value = typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
    const label = typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : null;
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push({ value, label: label ?? value });
  }

  return result;
}

export default function LocationForm() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [value, setValue] = useState<string>("");
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [desiredReady, setDesiredReady] = useState(false);

  const lastSavedRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setResumeId(stored);
      return;
    }
    const generated = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_KEY, generated);
    setResumeId(generated);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadLookups() {
      try {
        setLookupError(null);
        const res = await fetch(`/api/data/lookups?type=prefectures`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load prefectures: ${res.status}`);
        }
        const json = (await res.json()) as LookupResponse;
        if (cancelled) return;
        const normalized = normalizeOptions(json);
        if (!normalized.length) {
          setLookupError("勤務地の候補が取得できませんでした。");
        }
        setOptions(normalized);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load prefecture lookups", error);
        if (!cancelled) {
          setLookupError("勤務地の候補が取得できませんでした。時間をおいて再度お試しください。");
          setOptions([]);
        }
      }
    }

    void loadLookups();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!resumeId) return;
    const id = resumeId;
    let cancelled = false;
    const controller = new AbortController();

    async function loadPreferredLocation() {
      try {
        setLoadError(null);
        const params = new URLSearchParams({ id, draftId: id });
        const res = await fetch(`/api/data/resume?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error(`failed to load resume: ${res.status}`);
        }
        const json = (await res.json()) as ResumeResponse;
        if (cancelled) return;
        const snapshot = extractDesiredSnapshot(json);
        if (snapshot.preferredLocation) {
          setValue(snapshot.preferredLocation);
          lastSavedRef.current = snapshot.preferredLocation;
        }
        setRoles(snapshot.roles);
        setIndustries(snapshot.industries);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load preferred location", error);
        if (!cancelled) {
          setLoadError("データの取得に失敗しました。時間をおいて再度お試しください。");
        }
      } finally {
        if (!cancelled) {
          setDesiredReady(true);
        }
      }
    }

    void loadPreferredLocation();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resumeId]);

  const schema = useMemo(
    () => createPreferredLocationSchema(options.map((option) => option.value)),
    [options]
  );

  const validation = useMemo(
    () => schema.safeParse({ preferredLocation: value }),
    [schema, value]
  );

  const desiredPayload = useMemo(
    () => ({
      roles,
      industries,
      locations: value ? [value] : [],
    }),
    [roles, industries, value]
  );

  const saveDesired = useCallback(
    async (payload: typeof desiredPayload) => {
      if (!resumeId) {
        throw new Error("保存に必要なIDがありません");
      }

      const res = await fetch("/api/data/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: resumeId,
          desired: {
            roles: payload.roles,
            industries: payload.industries,
            locations: payload.locations,
          },
        }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `failed to save desired conditions: ${res.status}`);
      }
    },
    [resumeId]
  );

  const desiredAutoSaveState = useAutoSave(desiredPayload, saveDesired, 1500, {
    enabled: desiredReady && Boolean(resumeId),
  });

  const persist = useCallback(
    async (location: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!resumeId) return false;
      if (!location) return false;

      try {
        if (!silent && isMountedRef.current) {
          setSaveStatus("saving");
          if (saveStatusTimeoutRef.current) {
            clearTimeout(saveStatusTimeoutRef.current);
            saveStatusTimeoutRef.current = null;
          }
        }
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: resumeId, preferredLocation: location }),
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save preferred location: ${res.status}`);
        }
        lastSavedRef.current = location;
        if (!silent && isMountedRef.current) {
          setSaveStatus("saved");
          saveStatusTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setSaveStatus("idle");
            saveStatusTimeoutRef.current = null;
          }, 1200);
        }
        return true;
      } catch (error) {
        console.error("Failed to save preferred location", error);
        if (!silent && isMountedRef.current) {
          setSaveStatus("error");
          saveStatusTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
            setSaveStatus("idle");
            saveStatusTimeoutRef.current = null;
          }, 2000);
        }
        return false;
      }
    },
    [resumeId]
  );

  useEffect(() => {
    if (!touched) return;
    if (validation.success) {
      setFieldError(null);
    } else {
      setFieldError(extractValidationMessage(validation.error));
    }
  }, [touched, validation]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setValue(nextValue);
      setSubmitError(null);
      if (touched) {
        const result = schema.safeParse({ preferredLocation: nextValue });
        if (result.success) {
          setFieldError(null);
        } else {
          setFieldError(extractValidationMessage(result.error));
        }
      }
    },
    [schema, touched]
  );

  const handleRolesChange = useCallback((next: string[]) => {
    setRoles(next);
    setSubmitError(null);
  }, []);

  const handleIndustriesChange = useCallback((next: string[]) => {
    setIndustries(next);
    setSubmitError(null);
  }, []);

  const handleBlur = useCallback(async () => {
    if (!touched) {
      setTouched(true);
    }
    const result = schema.safeParse({ preferredLocation: value });
    if (!result.success) {
      setFieldError(extractValidationMessage(result.error));
      return;
    }
    setFieldError(null);
    const location = result.data.preferredLocation;
    if (location !== lastSavedRef.current) {
      await persist(location);
    }
  }, [schema, touched, value, persist]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    setTouched(true);
    const result = schema.safeParse({ preferredLocation: value });
    if (!result.success) {
      setFieldError(extractValidationMessage(result.error));
      return;
    }
    if (!resumeId) {
      setSubmitError("保存に必要なIDの取得に失敗しました。ページを再読み込みしてください。");
      return;
    }
    setFieldError(null);
    setIsSubmitting(true);
    try {
      const [locationSaved] = await Promise.all([
        persist(result.data.preferredLocation, { silent: true }),
        saveDesired(desiredPayload),
      ]);
      if (!locationSaved) {
        setIsSubmitting(false);
        setSubmitError("保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }
    } catch (error) {
      console.error("Failed to save desired conditions", error);
      setIsSubmitting(false);
      setSubmitError("保存に失敗しました。時間をおいて再度お試しください。");
      return;
    }
    setIsSubmitting(false);
    router.push("/cv/2");
  }, [schema, value, resumeId, persist, router, saveDesired, desiredPayload]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submit();
    },
    [submit]
  );

  const handleNextClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      event.preventDefault();
      await submit();
    },
    [submit]
  );

  const nextDisabled = isSubmitting;
  const fieldErrorId = fieldError ? "preferredLocation-error" : undefined;
  const loadErrorId = loadError ? "preferredLocation-load-error" : undefined;
  const lookupErrorId = lookupError ? "preferredLocation-lookup-error" : undefined;
  const submitErrorId = submitError ? "preferredLocation-submit-error" : undefined;
  const describedBy = [fieldErrorId, lookupErrorId, loadErrorId]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;
  const formDescriptionIds = [loadErrorId, lookupErrorId, submitErrorId]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: "24px" }}
      aria-describedby={formDescriptionIds}
      noValidate
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <h2 className="resume-page-title">希望勤務地</h2>
        <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem" }}>
          希望する勤務地を選択してください。選択後は自動的に保存されます。
        </p>
        {loadError && (
          <p
            id={loadErrorId}
            role="alert"
            style={{ color: "#dc2626", fontSize: "0.875rem" }}
          >
            {loadError}
          </p>
        )}
        {lookupError && (
          <p
            id={lookupErrorId}
            role="alert"
            style={{ color: "#b45309", fontSize: "0.875rem" }}
          >
            {lookupError}
          </p>
        )}
        {submitError && (
          <p
            id={submitErrorId}
            role="alert"
            style={{ color: "#dc2626", fontSize: "0.875rem" }}
          >
            {submitError}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "24px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <label htmlFor="preferredLocation" style={{ fontWeight: 600 }}>
            希望勤務地
          </label>
          <select
            id="preferredLocation"
            name="preferredLocation"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={touched && Boolean(fieldError)}
            aria-describedby={describedBy}
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
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {touched && fieldError && (
            <p
              id={fieldErrorId}
              role="alert"
              style={{ color: "#dc2626", fontSize: "0.875rem" }}
            >
              {fieldError}
            </p>
          )}
          {!fieldError && saveStatus !== "idle" && (
            <p
              style={{ fontSize: "0.75rem", color: "var(--color-secondary, #6b7280)" }}
              aria-live="polite"
            >
              {saveStatus === "saving" && "自動保存中..."}
              {saveStatus === "saved" && "保存しました"}
              {saveStatus === "error" && "自動保存に失敗しました。"}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>希望職種</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted, #6b7280)" }}>
            希望する職種をタグで入力してください。
          </p>
          <TagInput
            id="desired-roles"
            label="希望職種"
            value={roles}
            onChange={handleRolesChange}
            placeholder="例）マーケティング、ITコンサル、カスタマーサクセス"
          />
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>希望業界</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted, #6b7280)" }}>
            関心のある業界をタグで入力してください。
          </p>
          <TagInput
            id="desired-industries"
            label="希望業界"
            value={industries}
            onChange={handleIndustriesChange}
            placeholder="例）SaaS、金融、ヘルスケア"
          />
        </div>

        <AutoSaveBadge state={desiredAutoSaveState} />
      </div>

      <StepNav
        step={5}
        nextType="link"
        nextHref="/cv/2"
        nextDisabled={nextDisabled}
        nextLabel={isSubmitting ? "保存中..." : "次へ"}
        onNextClick={handleNextClick}
      />
    </form>
  );
}
