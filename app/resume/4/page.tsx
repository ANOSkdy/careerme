"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import MonthYearSelect from "../../../components/form/MonthYearSelect";
import TagSelector, { type TagOption } from "../../../components/ui/TagSelector";
import {
  WorkHistoryListSchema,
  type WorkHistoryItem,
  type WorkHistoryListItem,
} from "../../../lib/validation/schemas";

const MAX_ROLES = 10;
const MAX_INDUSTRIES = 10;
const MAX_QUALIFICATIONS = 10;

const WORK_API_BASE = "/api/data/work";

function createRowKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

type WorkFormRow = {
  key: string;
  id: string | null;
  company: string;
  division: string;
  title: string;
  startYm: string;
  endYm: string;
  roles: string[];
  industries: string[];
  qualifications: string[];
};

type RowField = "company" | "startYm" | "endYm" | "roles" | "industries" | "qualifications";

type RowErrors = Partial<Record<RowField, string>>;

type ValidationSnapshot = {
  isValid: boolean;
  parsed: WorkHistoryListItem[] | null;
  rowErrors: RowErrors[];
  listError: string | null;
};

type LookupOptions = {
  roles: TagOption[];
  industries: TagOption[];
  qualifications: TagOption[];
};

type WorkApiResponse = {
  ok?: boolean;
  items?: Array<{
    id?: string;
    company?: string;
    division?: string;
    title?: string;
    startYm?: string;
    endYm?: string;
    roles?: string[];
    industries?: string[];
    qualifications?: string[];
  }>;
};

type ResumeResponse = {
  id?: string | null;
};

type LookupResponse = {
  options?: Record<string, TagOption[]>;
};

function createEmptyRow(): WorkFormRow {
  return {
    key: createRowKey(),
    id: null,
    company: "",
    division: "",
    title: "",
    startYm: "",
    endYm: "",
    roles: [],
    industries: [],
    qualifications: [],
  };
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeServerRow(raw: unknown): WorkFormRow {
  if (!raw || typeof raw !== "object") {
    return createEmptyRow();
  }
  const source = raw as Record<string, unknown>;
  return {
    key: createRowKey(),
    id: typeof source.id === "string" && source.id ? source.id : null,
    company: typeof source.company === "string" ? source.company : "",
    division: typeof source.division === "string" ? source.division : "",
    title: typeof source.title === "string" ? source.title : "",
    startYm: typeof source.startYm === "string" ? source.startYm : "",
    endYm: typeof source.endYm === "string" ? source.endYm : "",
    roles: normalizeArray(source.roles),
    industries: normalizeArray(source.industries),
    qualifications: normalizeArray(source.qualifications),
  };
}

function serializeWorkData(data: WorkHistoryItem): string {
  return JSON.stringify({
    company: data.company,
    division: data.division ?? "",
    title: data.title ?? "",
    startYm: data.startYm,
    endYm: data.endYm ?? null,
    roles: data.roles ?? [],
    industries: data.industries ?? [],
    qualifications: data.qualifications ?? [],
  });
}

function mapToSchemaInput(row: WorkFormRow) {
  return {
    id: row.id ?? undefined,
    company: row.company,
    division: row.division,
    title: row.title,
    startYm: row.startYm,
    endYm: row.endYm,
    roles: row.roles,
    industries: row.industries,
    qualifications: row.qualifications,
  };
}

function createValidationSnapshot(rows: WorkFormRow[]): ValidationSnapshot {
  const rowErrors: RowErrors[] = rows.map(() => ({}));
  const parsedInput = rows.map((row) => mapToSchemaInput(row));
  const result = WorkHistoryListSchema.safeParse(parsedInput);
  if (result.success) {
    return { isValid: true, parsed: result.data, rowErrors, listError: null };
  }

  let listError: string | null = null;
  for (const issue of result.error.issues) {
    if (!issue.path.length) {
      listError ??= issue.message;
      continue;
    }
    const [maybeIndex] = issue.path;
    if (typeof maybeIndex !== "number") {
      listError ??= issue.message;
      continue;
    }
    const index = maybeIndex;
    if (!rowErrors[index]) {
      rowErrors[index] = {};
    }
    const fieldPath = issue.path[1];
    if (typeof fieldPath === "string" && (fieldPath as RowField)) {
      const field = fieldPath as RowField;
      rowErrors[index][field] ??= issue.message;
    } else if (issue.path.length > 2) {
      const parentField = issue.path[1];
      if (typeof parentField === "string" && (parentField as RowField)) {
        const field = parentField as RowField;
        rowErrors[index][field] ??= issue.message;
      }
    }
  }

  return { isValid: false, parsed: null, rowErrors, listError };
}

export default function ResumeStep4Page() {
  const router = useRouter();
  const [rows, setRows] = useState<WorkFormRow[]>([createEmptyRow()]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const [lookupOptions, setLookupOptions] = useState<LookupOptions>({
    roles: [],
    industries: [],
    qualifications: [],
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string>("[]");
  const serverStateRef = useRef<Map<string, string>>(new Map());
  const parsedRowsRef = useRef<WorkHistoryListItem[] | null>(null);
  const rowKeysRef = useRef<string[]>(rows.map((row) => row.key));

  const validation = useMemo(() => createValidationSnapshot(rows), [rows]);

  useEffect(() => {
    rowKeysRef.current = rows.map((row) => row.key);
  }, [rows]);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  useEffect(() => {
    parsedRowsRef.current = validation.parsed ?? null;
  }, [validation.parsed]);

  const ensureResumeId = useCallback(async () => {
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
    }
  }, []);

  const loadWorkRows = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${WORK_API_BASE}?resumeId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`failed to load work history: ${res.status}`);
      }
      const data = (await res.json()) as WorkApiResponse;
      const items = Array.isArray(data.items) ? data.items : [];
      const normalized = items.map((item) => normalizeServerRow(item));
      serverStateRef.current.clear();

      const rowsToSet = normalized.length ? normalized : [createEmptyRow()];
      setRows(rowsToSet);

      const parsed = WorkHistoryListSchema.safeParse(rowsToSet.map((row) => mapToSchemaInput(row)));
      if (parsed.success) {
        parsedRowsRef.current = parsed.data;
        lastSavedSnapshotRef.current = JSON.stringify(parsed.data);
        parsed.data.forEach((row) => {
          if (row.id) {
            const { id: rowId, ...rest } = row;
            serverStateRef.current.set(rowId, serializeWorkData(rest));
          }
        });
      } else {
        parsedRowsRef.current = null;
        lastSavedSnapshotRef.current = "[]";
      }
    } catch (error) {
      console.error("Failed to load work history", error);
      setRows([createEmptyRow()]);
      serverStateRef.current.clear();
      lastSavedSnapshotRef.current = "[]";
      throw error;
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
          if (!cancelled && lookupJson?.options) {
            setLookupOptions((prev) => ({
              ...prev,
              roles: lookupJson.options.roles ?? prev.roles,
              industries: lookupJson.options.industries ?? prev.industries,
              qualifications: lookupJson.options.qualifications ?? prev.qualifications,
            }));
          }
        }

        const resumeRes = await fetch("/api/data/resume", { cache: "no-store" });
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

        if (id) {
          await loadWorkRows(id);
        } else {
          setRows([createEmptyRow()]);
          serverStateRef.current.clear();
          lastSavedSnapshotRef.current = "[]";
        }
      } catch (error) {
        console.error("Failed to bootstrap work history", error);
        if (!cancelled) {
          setLoadError("職歴情報の読み込みに失敗しました。");
          setRows([createEmptyRow()]);
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
  }, [ensureResumeId, loadWorkRows]);

  const saveRows = useCallback(
    async (rowsToSave: WorkHistoryListItem[], rowKeys: string[]): Promise<boolean> => {
      const resumeIdValue = resumeIdRef.current;
      if (!resumeIdValue || !rowsToSave.length) return true;
      setSaveState("saving");
      const nextRows = rowsToSave.map((row) => ({ ...row }));
      const seenIds = new Set<string>();
      try {
        for (let index = 0; index < rowsToSave.length; index += 1) {
          const current = rowsToSave[index];
          const { id, ...data } = current;
          const payload: WorkHistoryItem = {
            company: data.company,
            division: data.division ?? "",
            title: data.title ?? "",
            startYm: data.startYm,
            endYm: data.endYm ?? undefined,
            roles: data.roles ?? [],
            industries: data.industries ?? [],
            qualifications: data.qualifications ?? [],
          };
          const serialized = serializeWorkData(payload);
          if (id) {
            seenIds.add(id);
            if (serverStateRef.current.get(id) === serialized) {
              continue;
            }
            const res = await fetch(WORK_API_BASE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, resumeId: resumeIdValue, data: payload }),
              cache: "no-store",
            });
            if (!res.ok) {
              throw new Error(`failed to update work: ${res.status}`);
            }
            serverStateRef.current.set(id, serialized);
          } else {
            const res = await fetch(WORK_API_BASE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resumeId: resumeIdValue, data: payload }),
              cache: "no-store",
            });
            if (!res.ok) {
              throw new Error(`failed to create work: ${res.status}`);
            }
            const json = (await res.json()) as { id?: string | null };
            const newId = typeof json.id === "string" && json.id ? json.id : null;
            if (newId) {
              seenIds.add(newId);
              nextRows[index] = { ...nextRows[index], id: newId };
              serverStateRef.current.set(newId, serialized);
              const rowKey = rowKeys[index];
              if (rowKey) {
                setRows((prev) =>
                  prev.map((row) => (row.key === rowKey ? { ...row, id: newId } : row))
                );
              }
            }
          }
        }

        const knownIds = Array.from(serverStateRef.current.keys());
        for (const existingId of knownIds) {
          if (!seenIds.has(existingId)) {
            const res = await fetch(`${WORK_API_BASE}?id=${encodeURIComponent(existingId)}`, {
              method: "DELETE",
              cache: "no-store",
            });
            if (!res.ok) {
              throw new Error(`failed to delete work: ${res.status}`);
            }
            serverStateRef.current.delete(existingId);
          }
        }

        lastSavedSnapshotRef.current = JSON.stringify(nextRows);
        parsedRowsRef.current = nextRows;
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1200);
        return true;
      } catch (error) {
        console.error("Failed to save work history", error);
        setSaveState("error");
        return false;
      }
    },
    []
  );

  const flushSaves = useCallback(async () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    const parsed = parsedRowsRef.current;
    const resumeIdValue = resumeIdRef.current;
    if (!resumeIdValue || !parsed || !parsed.length) {
      return true;
    }
    const snapshot = JSON.stringify(parsed);
    if (snapshot === lastSavedSnapshotRef.current) {
      return true;
    }
    return saveRows(parsed, rowKeysRef.current);
  }, [saveRows]);

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
    if (!resumeIdRef.current || !validation.parsed || !validation.parsed.length) {
      return;
    }
    const snapshot = JSON.stringify(validation.parsed);
    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      void saveRows(validation.parsed ?? [], rowKeysRef.current);
    }, 2000);
  }, [validation.parsed, saveRows]);

  const markTouched = useCallback((rowKey: string, field: RowField) => {
    setTouchedFields((prev) => {
      if (prev[`${rowKey}:${field}`]) return prev;
      return { ...prev, [`${rowKey}:${field}`]: true };
    });
  }, []);

  const shouldShowError = useCallback(
    (rowKey: string, field: RowField) =>
      submitted || Boolean(touchedFields[`${rowKey}:${field}`]),
    [submitted, touchedFields]
  );

  const handleInputChange = useCallback(
    (index: number, field: keyof WorkFormRow, value: string | string[]) => {
      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== index) return row;
          if (Array.isArray(value)) {
            return { ...row, [field]: value } as WorkFormRow;
          }
          return { ...row, [field]: value };
        })
      );
    },
    []
  );

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const handleRemoveRow = useCallback((index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitError(null);
      setSubmitted(true);
      if (!validation.isValid || !validation.parsed) {
        return;
      }
      const success = await flushSaves();
      if (!success) {
        setSubmitError("保存に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      router.push("/resume/5");
    },
    [flushSaves, router, validation.isValid, validation.parsed]
  );

  const handleCompanyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, index: number) => {
      handleInputChange(index, "company", event.target.value);
    },
    [handleInputChange]
  );

  const handleDivisionChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, index: number) => {
      handleInputChange(index, "division", event.target.value);
    },
    [handleInputChange]
  );

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, index: number) => {
      handleInputChange(index, "title", event.target.value);
    },
    [handleInputChange]
  );

  const handleStartChange = useCallback(
    (value: string, index: number) => {
      handleInputChange(index, "startYm", value);
    },
    [handleInputChange]
  );

  const handleEndChange = useCallback(
    (value: string, index: number) => {
      handleInputChange(index, "endYm", value);
    },
    [handleInputChange]
  );

  const handleRolesChange = useCallback(
    (values: string[], index: number) => {
      handleInputChange(index, "roles", values.slice(0, MAX_ROLES));
      markTouched(rows[index]?.key ?? "", "roles");
    },
    [handleInputChange, markTouched, rows]
  );

  const handleIndustriesChange = useCallback(
    (values: string[], index: number) => {
      handleInputChange(index, "industries", values.slice(0, MAX_INDUSTRIES));
      markTouched(rows[index]?.key ?? "", "industries");
    },
    [handleInputChange, markTouched, rows]
  );

  const handleQualificationsChange = useCallback(
    (values: string[], index: number) => {
      handleInputChange(index, "qualifications", values.slice(0, MAX_QUALIFICATIONS));
      markTouched(rows[index]?.key ?? "", "qualifications");
    },
    [handleInputChange, markTouched, rows]
  );

  return (
    <div className="resume-step">
      <h1 className="resume-step__title">職歴</h1>
      <p className="resume-step__description">これまでのご経験を入力してください。</p>
      <div className="resume-step__status">
        <AutoSaveBadge state={saveState} />
      </div>
      {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
      <form className="resume-form" onSubmit={handleSubmit} noValidate>
        <div className="work-list">
          {rows.map((row, index) => {
            const errors = validation.rowErrors[index] ?? {};
            return (
              <fieldset key={row.key} className="work-entry">
                <legend className="work-entry__legend">職歴 {index + 1}</legend>
                <div className="form-field">
                  <label htmlFor={`company-${row.key}`} className="form-label">
                    会社名<span className="form-required">*</span>
                  </label>
                  <input
                    id={`company-${row.key}`}
                    name={`company-${row.key}`}
                    type="text"
                    value={row.company}
                    onChange={(event) => handleCompanyChange(event, index)}
                    onBlur={() => markTouched(row.key, "company")}
                    className={`form-input${
                      errors.company && shouldShowError(row.key, "company") ? " has-error" : ""
                    }`}
                    placeholder="株式会社キャリアミー"
                    autoComplete="organization"
                  />
                  {errors.company && shouldShowError(row.key, "company") ? (
                    <p className="form-error" role="alert">
                      {errors.company}
                    </p>
                  ) : null}
                </div>
                <div className="form-field-grid">
                  <div className="form-field">
                    <label htmlFor={`division-${row.key}`} className="form-label">
                      部署
                    </label>
                    <input
                      id={`division-${row.key}`}
                      type="text"
                      value={row.division}
                      onChange={(event) => handleDivisionChange(event, index)}
                      placeholder="プロダクト本部"
                      className="form-input"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor={`title-${row.key}`} className="form-label">
                      役職
                    </label>
                    <input
                      id={`title-${row.key}`}
                      type="text"
                      value={row.title}
                      onChange={(event) => handleTitleChange(event, index)}
                      placeholder="プロジェクトマネージャー"
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-field-grid">
                  <div className="form-field">
                    <label htmlFor={`start-${row.key}`} className="form-label">
                      入社年月<span className="form-required">*</span>
                    </label>
                    <MonthYearSelect
                      id={`start-${row.key}`}
                      value={row.startYm}
                      onChange={(value) => handleStartChange(value, index)}
                    />
                    {errors.startYm && shouldShowError(row.key, "startYm") ? (
                      <p className="form-error" role="alert">
                        {errors.startYm}
                      </p>
                    ) : null}
                  </div>
                  <div className="form-field">
                    <label htmlFor={`end-${row.key}`} className="form-label">
                      退社年月
                    </label>
                    <MonthYearSelect
                      id={`end-${row.key}`}
                      value={row.endYm}
                      onChange={(value) => handleEndChange(value, index)}
                    />
                    {errors.endYm && shouldShowError(row.key, "endYm") ? (
                      <p className="form-error" role="alert">
                        {errors.endYm}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="form-field">
                  <TagSelector
                    options={lookupOptions.roles}
                    value={row.roles}
                    onChange={(values) => handleRolesChange(values, index)}
                    maxSelections={MAX_ROLES}
                    label="担当職種"
                    helperText="最大10件まで選択できます"
                  />
                  {errors.roles && shouldShowError(row.key, "roles") ? (
                    <p className="form-error" role="alert">
                      {errors.roles}
                    </p>
                  ) : null}
                </div>
                <div className="form-field">
                  <TagSelector
                    options={lookupOptions.industries}
                    value={row.industries}
                    onChange={(values) => handleIndustriesChange(values, index)}
                    maxSelections={MAX_INDUSTRIES}
                    label="担当業界"
                    helperText="最大10件まで選択できます"
                  />
                  {errors.industries && shouldShowError(row.key, "industries") ? (
                    <p className="form-error" role="alert">
                      {errors.industries}
                    </p>
                  ) : null}
                </div>
                <div className="form-field">
                  <TagSelector
                    options={lookupOptions.qualifications}
                    value={row.qualifications}
                    onChange={(values) => handleQualificationsChange(values, index)}
                    maxSelections={MAX_QUALIFICATIONS}
                    label="保有資格"
                    helperText="最大10件まで選択できます"
                  />
                  {errors.qualifications && shouldShowError(row.key, "qualifications") ? (
                    <p className="form-error" role="alert">
                      {errors.qualifications}
                    </p>
                  ) : null}
                </div>
                <div className="work-entry__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleRemoveRow(index)}
                    disabled={rows.length <= 1}
                  >
                    削除
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="work-actions">
          <button type="button" className="button button--secondary" onClick={handleAddRow}>
            ＋ 職歴を追加
          </button>
        </div>
        {validation.listError && submitted ? (
          <p className="form-error" role="alert">
            {validation.listError}
          </p>
        ) : null}
        {submitError ? (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        ) : null}
        <StepNav
          step={4}
          totalSteps={5}
          prevHref="/resume/3"
          nextHref="/resume/5"
          nextType="submit"
          nextDisabled={isLoading || !validation.isValid}
        />
      </form>
    </div>
  );
}
