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
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { DesiredSchema } from "../_schemas/resume";
import StepNav from "../_components/StepNav";

type Option = { value: string; label: string };

const ROLE_PRESET_OPTIONS: Option[] = [
  { value: "営業", label: "営業" },
  { value: "マーケティング", label: "マーケティング" },
  { value: "プロダクトマネージャー", label: "プロダクトマネージャー" },
  { value: "カスタマーサクセス", label: "カスタマーサクセス" },
  { value: "コンサルタント", label: "コンサルタント" },
  { value: "バックオフィス", label: "バックオフィス" },
  { value: "ソフトウェアエンジニア", label: "ソフトウェアエンジニア" },
];

const INDUSTRY_PRESET_OPTIONS: Option[] = [
  { value: "IT・ソフトウェア", label: "IT・ソフトウェア" },
  { value: "SaaS", label: "SaaS" },
  { value: "金融", label: "金融" },
  { value: "コンサルティング", label: "コンサルティング" },
  { value: "人材", label: "人材" },
  { value: "ヘルスケア", label: "ヘルスケア" },
  { value: "製造", label: "製造" },
];

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
const NEXT_PAGE_PATH = "/cv/2";

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

function extendOptions(base: Option[], values: readonly string[]): Option[] {
  if (!Array.isArray(values) || values.length === 0) {
    return base;
  }
  const seen = new Set(base.map((option) => option.value));
  const extended = [...base];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    extended.push({ value, label: value });
  }
  return extended;
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
  const [value, setValue] = useState<string>("");
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [roleOptions, setRoleOptions] = useState<Option[]>(ROLE_PRESET_OPTIONS);
  const [industryOptions, setIndustryOptions] = useState<Option[]>(
    INDUSTRY_PRESET_OPTIONS
  );
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
        setOptions(normalized);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load prefecture lookups", error);
        if (!cancelled) {
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
        setRoleOptions((current) => extendOptions(current, snapshot.roles));
        setIndustryOptions((current) => extendOptions(current, snapshot.industries));
        setRoles(snapshot.roles);
        setIndustries(snapshot.industries);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load preferred location", error);
        if (!cancelled) {
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

  const handleRolesSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions, (option) => option.value);
      setRoles(selected);
    },
    []
  );

  const handleIndustriesSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(event.target.selectedOptions, (option) => option.value);
      setIndustries(selected);
    },
    []
  );

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
    setTouched(true);
    const result = schema.safeParse({ preferredLocation: value });
    if (!result.success) {
      setFieldError(extractValidationMessage(result.error));
      return;
    }
    if (!resumeId) {
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
        return;
      }
    } catch (error) {
      console.error("Failed to save desired conditions", error);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    router.push(NEXT_PAGE_PATH);
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
  const describedBy = [fieldErrorId]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px" }} noValidate>
      <div style={{ display: "grid", gap: "8px" }}>
        <h2 className="resume-page-title">希望勤務地</h2>
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
            </p>
          )}
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <label htmlFor="desired-roles" style={{ fontWeight: 600 }}>
            希望職種
          </label>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#6b7280",
            }}
          >
            Windows の場合は Ctrl、Mac の場合は ⌘ を押しながらクリックすると複数選択できます。
          </p>
          <select
            id="desired-roles"
            multiple
            value={roles}
            onChange={handleRolesSelectChange}
            style={{
              minHeight: "160px",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px",
              fontSize: "1rem",
              backgroundColor: "#fff",
            }}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <label htmlFor="desired-industries" style={{ fontWeight: 600 }}>
            希望業界
          </label>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#6b7280",
            }}
          >
            Windows の場合は Ctrl、Mac の場合は ⌘ を押しながらクリックすると複数選択できます。
          </p>
          <select
            id="desired-industries"
            multiple
            value={industries}
            onChange={handleIndustriesSelectChange}
            style={{
              minHeight: "160px",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px",
              fontSize: "1rem",
              backgroundColor: "#fff",
            }}
          >
            {industryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <AutoSaveBadge state={desiredAutoSaveState} />
      </div>

      <StepNav
        step={5}
        nextType="link"
        nextHref={NEXT_PAGE_PATH}
        nextDisabled={nextDisabled}
        nextLabel={isSubmitting ? "保存中..." : "次へ"}
        onNextClick={handleNextClick}
      />
    </form>
  );
}
