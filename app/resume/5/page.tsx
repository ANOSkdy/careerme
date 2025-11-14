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

import Modal from "../../../components/ui/Modal";
import TagSelector, { type TagOption } from "../../../components/ui/TagSelector";
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

type ActiveModal = "roles" | "industries" | null;

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

function toTagOptions(list: string[]): TagOption[] {
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
  const [roleOptions, setRoleOptions] = useState<TagOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<TagOption[]>([]);
  const [desiredReady, setDesiredReady] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [modalDraft, setModalDraft] = useState<string[]>([]);
  const [filterQuery, setFilterQuery] = useState<string>("");

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
        setRoleOptions(toTagOptions(roleList));
        setIndustryOptions(toTagOptions(industryList));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load desired lookups", error);
        if (!cancelled) {
          setRoleOptions(toTagOptions(limitWithFallback([], FALLBACK_ROLES, ROLE_LIMIT)));
          setIndustryOptions(
            toTagOptions(limitWithFallback([], FALLBACK_INDUSTRIES, INDUSTRY_LIMIT))
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

  const openModal = useCallback(
    (type: Exclude<ActiveModal, null>) => {
      setActiveModal(type);
      setFilterQuery("");
      setModalDraft(type === "roles" ? roles : industries);
    },
    [roles, industries]
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalDraft([]);
    setFilterQuery("");
  }, []);

  const applyModalSelection = useCallback(() => {
    if (!activeModal) return;
    const normalized = normalizeSelection(modalDraft);
    if (activeModal === "roles") {
      setRoles(normalized);
    } else if (activeModal === "industries") {
      setIndustries(normalized);
    }
    closeModal();
  }, [activeModal, modalDraft, closeModal]);

  const fieldErrorId = fieldError ? "preferredLocation-error" : undefined;
  const describedBy = [fieldErrorId].filter(Boolean).join(" ").trim() || undefined;

  const filteredOptions = useMemo(() => {
    const list = activeModal === "roles" ? roleOptions : industryOptions;
    if (!activeModal) return [];
    if (!filterQuery) return list;
    const query = filterQuery.toLowerCase();
    return list.filter((option) => option.label.toLowerCase().includes(query));
  }, [activeModal, filterQuery, roleOptions, industryOptions]);

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
                onClick={() => openModal("roles")}
                style={TERTIARY_BUTTON_STYLE}
                aria-haspopup="dialog"
                aria-controls="roles-selector-modal"
              >
                選択する
              </button>
            </div>
            {roles.length > 0 ? (
              chips(roles)
            ) : (
              <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
                選択されていません
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
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>希望業界</h3>
              <button
                type="button"
                onClick={() => openModal("industries")}
                style={TERTIARY_BUTTON_STYLE}
                aria-haspopup="dialog"
                aria-controls="industries-selector-modal"
              >
                選択する
              </button>
            </div>
            {industries.length > 0 ? (
              chips(industries)
            ) : (
              <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
                選択されていません
              </p>
            )}
          </div>

          <AutoSaveBadge state={desiredAutoSaveState} />
        </div>

        <StepNav step={5} nextType="link" nextHref={NEXT_STEP_HREF} />
      </form>

      <Modal
        open={activeModal === "roles"}
        onClose={closeModal}
        title="希望職種を選択"
        labelledBy="roles-selector-modal"
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor="roles-filter" style={{ fontWeight: 600 }}>
              フィルター
            </label>
            <input
              id="roles-filter"
              type="search"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="キーワードで絞り込み"
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #d1d5db)",
                padding: "10px 12px",
              }}
            />
          </div>
          <p aria-live="polite" style={{ fontSize: "0.875rem", color: "var(--color-secondary, #6b7280)" }}>
            選択中 {modalDraft.length}/{MAX_SELECTIONS}
          </p>
          <TagSelector
            options={filteredOptions}
            value={modalDraft}
            onChange={setModalDraft}
            maxSelections={MAX_SELECTIONS}
            helperText={`最大${MAX_SELECTIONS}件まで選択できます`}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={applyModalSelection}
              className="step-nav__button step-nav__button--primary"
            >
              決定
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeModal === "industries"}
        onClose={closeModal}
        title="希望業界を選択"
        labelledBy="industries-selector-modal"
      >
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor="industries-filter" style={{ fontWeight: 600 }}>
              フィルター
            </label>
            <input
              id="industries-filter"
              type="search"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="キーワードで絞り込み"
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #d1d5db)",
                padding: "10px 12px",
              }}
            />
          </div>
          <p aria-live="polite" style={{ fontSize: "0.875rem", color: "var(--color-secondary, #6b7280)" }}>
            選択中 {modalDraft.length}/{MAX_SELECTIONS}
          </p>
          <TagSelector
            options={filteredOptions}
            value={modalDraft}
            onChange={setModalDraft}
            maxSelections={MAX_SELECTIONS}
            helperText={`最大${MAX_SELECTIONS}件まで選択できます`}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={applyModalSelection}
              className="step-nav__button step-nav__button--primary"
            >
              決定
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
