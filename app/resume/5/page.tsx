"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { ZodError } from "zod";

import { createPreferredLocationSchema } from "../../../lib/validation/schemas";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { DesiredSchema } from "../_schemas/resume";
import { FALLBACK_INDUSTRIES, FALLBACK_ROLES } from "./choices";

type Option = { value: string; label: string };

type LookupResponse = {
  options?: Array<{ value?: string; label?: string } | string>;
  records?: Array<{ value?: string; label?: string }>;
};

type LookupCollectionsResponse = {
  roles?: unknown;
  industries?: unknown;
};

type ResumeResponse = {
  preferredLocation?: unknown;
  desired?: unknown;
  data?: { preferredLocation?: unknown; desired?: unknown };
  fields?: { preferredLocation?: unknown; desired?: unknown };
};

type DesiredSnapshot = {
  preferredLocation: string | null;
  roles: string[];
  industries: string[];
  locations: string[];
};

type ActivePicker = "roles" | "industries" | null;

const STORAGE_KEY = "resume.resumeId";
const ERROR_MESSAGE = "希望勤務地を選択してください";
const NEXT_STEP_HREF = "/cv/2";
const MAX_SELECTIONS = 10;
const ROLE_LIMIT = 30;
const INDUSTRY_LIMIT = 20;

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--color-primary, #2563eb)",
  color: "#fff",
  borderRadius: "9999px",
  padding: "4px 12px",
  fontSize: "0.875rem",
  fontWeight: 600,
};

const CHIP_LIST_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const TERTIARY_BUTTON_STYLE: CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid var(--color-border, #d1d5db)",
  borderRadius: "9999px",
  color: "var(--color-primary, #2563eb)",
  padding: "6px 12px",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
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

function extractLookupStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of input) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
      continue;
    }
    if (!candidate || typeof candidate !== "object") continue;
    const value =
      typeof (candidate as { value?: unknown }).value === "string"
        ? ((candidate as { value?: string }).value ?? "").trim()
        : "";
    const label =
      typeof (candidate as { label?: unknown }).label === "string"
        ? ((candidate as { label?: string }).label ?? "").trim()
        : "";
    const normalized = value || label;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function limitWithFallback(
  primary: string[],
  fallback: readonly string[],
  limit: number
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const addItems = (items: Iterable<string>) => {
    for (const item of items) {
      if (result.length >= limit) break;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length >= limit) break;
    }
  };

  addItems(primary);
  if (result.length < limit) {
    addItems(fallback);
  }

  return result.slice(0, limit);
}

function toOptions(list: string[]): Option[] {
  return list.map((item) => ({ value: item, label: item }));
}

function normalizeSelection(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of values) {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= MAX_SELECTIONS) break;
  }
  return normalized;
}

export default function ResumeStep5Page() {
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [value, setValue] = useState<string>("");
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [roles, setRoles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [roleOptions, setRoleOptions] = useState<Option[]>([]);
  const [industryOptions, setIndustryOptions] = useState<Option[]>([]);
  const [desiredReady, setDesiredReady] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<ActivePicker>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

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
    let cancelled = false;
    const controller = new AbortController();

    async function loadRoleLookups() {
      try {
        const res = await fetch(`/api/data/lookups`, {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load desired lookups: ${res.status}`);
        }
        const json = (await res.json()) as LookupCollectionsResponse;
        if (cancelled) return;
        const roleList = limitWithFallback(
          extractLookupStrings(json.roles),
          FALLBACK_ROLES,
          ROLE_LIMIT
        );
        const industryList = limitWithFallback(
          extractLookupStrings(json.industries),
          FALLBACK_INDUSTRIES,
          INDUSTRY_LIMIT
        );
        setRoleOptions(toOptions(roleList));
        setIndustryOptions(toOptions(industryList));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load desired lookups", error);
        if (!cancelled) {
          setRoleOptions(toOptions(limitWithFallback([], FALLBACK_ROLES, ROLE_LIMIT)));
          setIndustryOptions(
            toOptions(limitWithFallback([], FALLBACK_INDUSTRIES, INDUSTRY_LIMIT))
          );
        }
      }
    }

    void loadRoleLookups();

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
        setRoles(snapshot.roles.slice(0, MAX_SELECTIONS));
        setIndustries(snapshot.industries.slice(0, MAX_SELECTIONS));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load preferred location", error);
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

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

  const toggleDropdown = useCallback((type: Exclude<ActivePicker, null>) => {
    setActiveDropdown((prev) => (prev === type ? null : type));
  }, []);

  const toggleSelection = useCallback(
    (type: Exclude<ActivePicker, null>, optionValue: string) => {
      const updater = type === "roles" ? setRoles : setIndustries;
      updater((prev) => {
        const exists = prev.includes(optionValue);
        if (exists) {
          return prev.filter((item) => item !== optionValue);
        }
        if (prev.length >= MAX_SELECTIONS) {
          return prev;
        }
        return normalizeSelection([...prev, optionValue]);
      });
    },
    []
  );

  const clearSelections = useCallback((type: Exclude<ActivePicker, null>) => {
    if (type === "roles") {
      setRoles([]);
    } else {
      setIndustries([]);
    }
  }, []);

  useEffect(() => {
    if (activeDropdown !== "roles") {
      setRoleFilter("");
    }
    if (activeDropdown !== "industries") {
      setIndustryFilter("");
    }
  }, [activeDropdown]);

  const filteredRoleOptions = useMemo(() => {
    const query = roleFilter.trim().toLowerCase();
    if (!query) return roleOptions;
    return roleOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [roleFilter, roleOptions]);

  const filteredIndustryOptions = useMemo(() => {
    const query = industryFilter.trim().toLowerCase();
    if (!query) return industryOptions;
    return industryOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [industryFilter, industryOptions]);

  const fieldErrorId = fieldError ? "preferredLocation-error" : undefined;
  const describedBy = [fieldErrorId].filter(Boolean).join(" ").trim() || undefined;

  const isRoleDropdownOpen = activeDropdown === "roles";
  const isIndustryDropdownOpen = activeDropdown === "industries";

  const renderDropdown = (
    type: Exclude<ActivePicker, null>,
    optionsList: Option[],
    selectedValues: string[],
    filterValue: string,
    onFilterChange: (value: string) => void
  ) => {
    const selectionSet = new Set(selectedValues);
    const filterId = `${type}-filter`;
    return (
      <div
        id={`${type}-dropdown`}
        role="group"
        style={{
          display: "grid",
          gap: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          border: "1px solid var(--color-border, #d1d5db)",
          borderRadius: "12px",
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <label htmlFor={filterId} style={{ fontWeight: 600, fontSize: "0.875rem" }}>
            キーワードで絞り込み
          </label>
          <input
            id={filterId}
            type="search"
            value={filterValue}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder="キーワードを入力"
            style={{
              width: "100%",
              borderRadius: "9999px",
              border: "1px solid var(--color-border, #d1d5db)",
              padding: "10px 14px",
              fontSize: "0.95rem",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "0.875rem", color: "var(--color-secondary, #6b7280)" }}>
            選択中 {selectedValues.length}/{MAX_SELECTIONS}
          </span>
          <button
            type="button"
            onClick={() => clearSelections(type)}
            disabled={selectedValues.length === 0}
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--color-border, #d1d5db)",
              borderRadius: "9999px",
              padding: "6px 12px",
              fontSize: "0.8rem",
              color: selectedValues.length === 0 ? "#9ca3af" : "var(--color-primary, #2563eb)",
            }}
          >
            クリア
          </button>
        </div>
        <div
          role="listbox"
          aria-multiselectable
          style={{
            maxHeight: "50vh",
            overflowY: "auto",
            display: "grid",
            gap: "8px",
            paddingRight: "4px",
          }}
        >
          {optionsList.length === 0 ? (
            <p
              style={{ fontSize: "0.875rem", color: "var(--color-secondary, #6b7280)" }}
              aria-live="polite"
            >
              条件に一致する候補がありません
            </p>
          ) : (
            optionsList.map((option) => {
              const isSelected = selectionSet.has(option.value);
              const disableOption = !isSelected && selectedValues.length >= MAX_SELECTIONS;
              return (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    backgroundColor: isSelected
                      ? "rgba(37, 99, 235, 0.08)"
                      : "rgba(15, 23, 42, 0.02)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(type, option.value)}
                    disabled={disableOption}
                    aria-label={option.label}
                    style={{ width: "20px", height: "20px" }}
                  />
                  <span style={{ flex: 1, fontSize: "0.95rem" }}>{option.label}</span>
                  {isSelected ? <span aria-hidden="true">✓</span> : null}
                </label>
              );
            })
          )}
        </div>
        <button
          type="button"
          onClick={() => setActiveDropdown(null)}
          className="step-nav__button step-nav__button--primary"
          style={{ justifySelf: "stretch" }}
        >
          完了
        </button>
      </div>
    );
  };

  const chips = (items: string[]) => (
    <div style={CHIP_LIST_STYLE} role="list" aria-live="polite">
      {items.map((item) => (
        <span key={item} style={CHIP_STYLE} role="listitem">
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <>
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

          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>希望職種</h3>
              <button
                type="button"
                onClick={() => toggleDropdown("roles")}
                style={TERTIARY_BUTTON_STYLE}
                aria-expanded={isRoleDropdownOpen}
                aria-controls="roles-dropdown"
              >
                {isRoleDropdownOpen ? "閉じる" : "選択する"}
              </button>
            </div>
            {roles.length > 0 ? (
              chips(roles)
            ) : (
              <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
                選択されていません
              </p>
            )}
            {isRoleDropdownOpen
              ? renderDropdown(
                  "roles",
                  filteredRoleOptions,
                  roles,
                  roleFilter,
                  setRoleFilter
                )
              : null}
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>希望業界</h3>
              <button
                type="button"
                onClick={() => toggleDropdown("industries")}
                style={TERTIARY_BUTTON_STYLE}
                aria-expanded={isIndustryDropdownOpen}
                aria-controls="industries-dropdown"
              >
                {isIndustryDropdownOpen ? "閉じる" : "選択する"}
              </button>
            </div>
            {industries.length > 0 ? (
              chips(industries)
            ) : (
              <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
                選択されていません
              </p>
            )}
            {isIndustryDropdownOpen
              ? renderDropdown(
                  "industries",
                  filteredIndustryOptions,
                  industries,
                  industryFilter,
                  setIndustryFilter
                )
              : null}
          </div>

          <AutoSaveBadge state={desiredAutoSaveState} />
        </div>

        <StepNav step={5} nextType="link" nextHref={NEXT_STEP_HREF} />
      </form>
    </>
  );
}
