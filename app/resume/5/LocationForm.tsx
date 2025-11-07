"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";

import { createPreferredLocationSchema } from "../../../lib/validation/schemas";

type Option = { value: string; label: string };

type LookupResponse = {
  options?: Array<{ value?: string; label?: string } | string>;
  records?: Array<{ value?: string; label?: string }>;
};

type ResumeResponse = {
  preferredLocation?: unknown;
  desired?: { locations?: unknown } | null;
  data?: { preferredLocation?: unknown };
  fields?: { preferredLocation?: unknown };
};

const STORAGE_KEY = "resume.resumeId";
const ERROR_MESSAGE = "希望勤務地を選択してください";

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

function extractPreferredLocation(payload: ResumeResponse | null | undefined): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates: unknown[] = [
    payload.preferredLocation,
    payload.data?.preferredLocation,
    payload.fields?.preferredLocation,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const desired = payload.desired;
  if (desired && typeof desired === "object") {
    const locations = (desired as { locations?: unknown }).locations;
    if (Array.isArray(locations)) {
      for (const location of locations) {
        if (typeof location === "string" && location.trim()) {
          return location.trim();
        }
      }
    }
  }

  return null;
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
        const location = extractPreferredLocation(json);
        if (location) {
          setValue(location);
          lastSavedRef.current = location;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load preferred location", error);
        if (!cancelled) {
          setLoadError("データの取得に失敗しました。時間をおいて再度お試しください。");
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
      const message =
        validation.error.formErrors.fieldErrors.preferredLocation?.[0] || ERROR_MESSAGE;
      setFieldError(message);
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
          const message =
            result.error.formErrors.fieldErrors.preferredLocation?.[0] || ERROR_MESSAGE;
          setFieldError(message);
        }
      }
    },
    [schema, touched]
  );

  const handleBlur = useCallback(async () => {
    if (!touched) {
      setTouched(true);
    }
    const result = schema.safeParse({ preferredLocation: value });
    if (!result.success) {
      const message =
        result.error.formErrors.fieldErrors.preferredLocation?.[0] || ERROR_MESSAGE;
      setFieldError(message);
      return;
    }
    setFieldError(null);
    const location = result.data.preferredLocation;
    if (location !== lastSavedRef.current) {
      await persist(location);
    }
  }, [schema, touched, value, persist]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      setTouched(true);
      const result = schema.safeParse({ preferredLocation: value });
      if (!result.success) {
        const message =
          result.error.formErrors.fieldErrors.preferredLocation?.[0] || ERROR_MESSAGE;
        setFieldError(message);
        return;
      }
      if (!resumeId) {
        setSubmitError("保存に必要なIDの取得に失敗しました。ページを再読み込みしてください。");
        return;
      }
      setFieldError(null);
      setIsSubmitting(true);
      const ok = await persist(result.data.preferredLocation, { silent: true });
      setIsSubmitting(false);
      if (!ok) {
        setSubmitError("保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      router.push("/cv/2");
    },
    [schema, value, resumeId, persist, router]
  );

  const isValid = validation.success;
  const nextDisabled = !isValid || isSubmitting || !resumeId;
  const fieldErrorId = fieldError ? "preferredLocation-error" : undefined;
  const loadErrorId = loadError ? "preferredLocation-load-error" : undefined;
  const lookupErrorId = lookupError ? "preferredLocation-lookup-error" : undefined;
  const describedBy = [fieldErrorId, lookupErrorId, loadErrorId]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;

  return (
    <form onSubmit={handleSubmit} aria-describedby={loadErrorId} noValidate>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-text-strong, #111827)",
            marginBottom: "8px",
          }}
        >
          希望勤務地
        </h2>
        <p style={{ color: "var(--color-text-muted, #6b7280)", fontSize: "0.875rem" }}>
          希望する勤務地を選択してください。選択後は自動的に保存されます。
        </p>
        {loadError && (
          <p
            id={loadErrorId}
            role="alert"
            style={{ marginTop: "8px", color: "#dc2626", fontSize: "0.875rem" }}
          >
            {loadError}
          </p>
        )}
        {lookupError && (
          <p
            id={lookupErrorId}
            role="alert"
            style={{ marginTop: "8px", color: "#b45309", fontSize: "0.875rem" }}
          >
            {lookupError}
          </p>
        )}
        {submitError && (
          <p
            role="alert"
            style={{ marginTop: "8px", color: "#dc2626", fontSize: "0.875rem" }}
          >
            {submitError}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label
            htmlFor="preferredLocation"
            style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
          >
            希望勤務地 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="preferredLocation"
            name="preferredLocation"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={touched && Boolean(fieldError)}
            aria-describedby={describedBy}
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
              style={{ marginTop: "4px", color: "#dc2626", fontSize: "0.875rem" }}
            >
              {fieldError}
            </p>
          )}
          {!fieldError && saveStatus !== "idle" && (
            <p
              style={{ marginTop: "4px", color: "#6b7280", fontSize: "0.75rem" }}
              aria-live="polite"
            >
              {saveStatus === "saving" && "自動保存中..."}
              {saveStatus === "saved" && "保存しました"}
              {saveStatus === "error" && "自動保存に失敗しました。"}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <Link
          href="/resume/4"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "0.875rem",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            color: "#1f2937",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          戻る
        </Link>
        <button
          type="submit"
          disabled={nextDisabled}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            fontSize: "0.875rem",
            border: "1px solid var(--color-primary, #4A90E2)",
            backgroundColor: "var(--color-primary, #4A90E2)",
            color: "#ffffff",
            opacity: nextDisabled ? 0.5 : 1,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            transition: "opacity 0.2s ease", 
          }}
        >
          {isSubmitting ? "保存中..." : "次へ"}
        </button>
      </div>
    </form>
  );
}
