"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import { WorksFormSchema } from "../../../lib/validation/schemas";

type SaveState = "idle" | "saving" | "saved" | "error";

type FieldKey = "company" | "startYm" | "endYm" | "division" | "title";

type WorkRowState = {
  localId: string;
  recordId?: string;
  company: string;
  startYm: string;
  endYm: string;
  division: string;
  title: string;
};

type WorkListResponse = {
  items?: unknown;
};

type ResumeResponse = {
  id?: string | null;
};

const STORAGE_KEY = "resume.resumeId";

const fieldKeys: FieldKey[] = ["company", "startYm", "endYm", "division", "title"];

function createEmptyRow(localId: string): WorkRowState {
  return {
    localId,
    recordId: undefined,
    company: "",
    startYm: "",
    endYm: "",
    division: "",
    title: "",
  };
}

function toSnapshot(rows: WorkRowState[]) {
  return JSON.stringify(
    rows.map((row) => ({
      recordId: row.recordId ?? null,
      company: row.company,
      startYm: row.startYm,
      endYm: row.endYm,
      division: row.division,
      title: row.title,
    }))
  );
}

function toRowFromApi(localId: string, input: unknown): WorkRowState {
  if (!input || typeof input !== "object") {
    return createEmptyRow(localId);
  }
  const source = input as Record<string, unknown>;
  return {
    localId,
    recordId: typeof source.id === "string" && source.id ? source.id : undefined,
    company: typeof source.company === "string" ? source.company : "",
    startYm: typeof source.startYm === "string" ? source.startYm : "",
    endYm: typeof source.endYm === "string" ? source.endYm : "",
    division: typeof source.division === "string" ? source.division : "",
    title: typeof source.title === "string" ? source.title : "",
  };
}

export default function ResumeStep4Page() {
  const router = useRouter();
  const rowIdCounterRef = useRef(1);
  const [rows, setRows] = useState<WorkRowState[]>(() => [createEmptyRow("row-0")]);
  const rowsRef = useRef<WorkRowState[]>(rows);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const [touched, setTouched] = useState<
    Record<string, Partial<Record<FieldKey, boolean>>>
  >({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const lastSavedSnapshotRef = useRef<string>(toSnapshot(rows));
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const updateRowCounter = useCallback((values: WorkRowState[]) => {
    let max = rowIdCounterRef.current;
    for (const row of values) {
      const match = row.localId.match(/row-(\d+)/u);
      if (match) {
        const next = Number(match[1]) + 1;
        if (Number.isFinite(next) && next > max) {
          max = next;
        }
      }
    }
    rowIdCounterRef.current = max;
  }, []);

  const createRow = useCallback((): WorkRowState => {
    const localId = `row-${rowIdCounterRef.current++}`;
    return createEmptyRow(localId);
  }, []);

  const createRowFromApi = useCallback(
    (input: unknown): WorkRowState => {
      const localId = `row-${rowIdCounterRef.current++}`;
      return toRowFromApi(localId, input);
    },
    []
  );

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  useEffect(() => {
    updateRowCounter(rows);
  }, [rows, updateRowCounter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        resumeIdRef.current = stored;
        setResumeId(stored);
      }
    } catch (error) {
      console.warn("Failed to read resumeId from storage", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !resumeId) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, resumeId);
    } catch (error) {
      console.warn("Failed to store resumeId", error);
    }
  }, [resumeId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        if (!resumeIdRef.current) {
          const resumeRes = await fetch("/api/data/resume", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!resumeRes.ok) {
            throw new Error(`failed to load resume: ${resumeRes.status}`);
          }
          const resumeJson = (await resumeRes.json()) as ResumeResponse;
          if (cancelled) return;
          const id = typeof resumeJson.id === "string" && resumeJson.id ? resumeJson.id : null;
          if (id) {
            resumeIdRef.current = id;
            setResumeId(id);
          }
        }

        const ensuredId = resumeIdRef.current ?? (await ensureResumeId());
        if (cancelled) return;

        if (!ensuredId) {
          lastSavedSnapshotRef.current = toSnapshot(rowsRef.current);
          return;
        }

        const workRes = await fetch(
          `/api/data/work?resumeId=${encodeURIComponent(ensuredId)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!workRes.ok) {
          throw new Error(`failed to load work rows: ${workRes.status}`);
        }
        const workJson = (await workRes.json()) as WorkListResponse;
        if (cancelled) return;

        const rawItems = Array.isArray(workJson.items) ? workJson.items : [];
        const nextRows = rawItems.length
          ? rawItems.map((item) => createRowFromApi(item))
          : rowsRef.current.length
          ? rowsRef.current
          : [createRow()];

        rowsRef.current = nextRows;
        setRows(nextRows);
        setTouched({});
        lastSavedSnapshotRef.current = toSnapshot(nextRows);
        updateRowCounter(nextRows);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load work rows", error);
          setLoadError("職歴情報の取得に失敗しました");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [createRow, createRowFromApi, ensureResumeId, updateRowCounter]);

  const validationInput = useMemo(
    () =>
      rows.map((row) => ({
        company: row.company,
        startYm: row.startYm,
        endYm: row.endYm ? row.endYm : undefined,
        division: row.division ? row.division : undefined,
        title: row.title ? row.title : undefined,
      })),
    [rows]
  );

  const parsed = useMemo(() => WorksFormSchema.safeParse(validationInput), [validationInput]);

  const rowErrors = useMemo(() => {
    if (parsed.success) return {};
    const map: Record<string, Partial<Record<FieldKey, string>>> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path.length < 2) continue;
      const [index, field] = issue.path;
      if (typeof index !== "number" || typeof field !== "string") continue;
      if (!fieldKeys.includes(field as FieldKey)) continue;
      const row = rows[index];
      if (!row) continue;
      const current = map[row.localId] ?? {};
      map[row.localId] = {
        ...current,
        [field as FieldKey]: issue.message,
      };
    }
    return map;
  }, [parsed, rows]);

  const listError = useMemo(() => {
    if (parsed.success) return null;
    const issue = parsed.error.issues.find((entry) => entry.path.length === 0);
    return issue ? issue.message : null;
  }, [parsed]);

  const handleFieldChange = useCallback(
    (localId: string, field: FieldKey, value: string) => {
      setRows((prev) =>
        prev.map((row) =>
          row.localId === localId
            ? {
                ...row,
                [field]: value,
              }
            : row
        )
      );
    },
    []
  );

  const handleFieldBlur = useCallback((localId: string, field: FieldKey) => {
    setTouched((prev) => {
      const current = prev[localId] ?? {};
      if (current[field]) return prev;
      return {
        ...prev,
        [localId]: {
          ...current,
          [field]: true,
        },
      };
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createRow()]);
  }, [createRow]);

  const handleRemoveRow = useCallback(
    (localId: string, recordId?: string) => {
      setRows((prev) => prev.filter((row) => row.localId !== localId));
      setTouched((prev) => {
        if (!(localId in prev)) return prev;
        const next = { ...prev };
        delete next[localId];
        return next;
      });
      if (recordId) {
        void (async () => {
          try {
            await fetch(`/api/data/work?id=${encodeURIComponent(recordId)}`, {
              method: "DELETE",
              cache: "no-store",
            });
          } catch (error) {
            console.error("Failed to delete work record", error);
          }
        })();
      }
    },
    []
  );

  const persistRows = useCallback(
    async (
      value: WorkRowState[],
      options: { allowInvalid?: boolean } = {}
    ): Promise<boolean> => {
      const normalized = value.map((row) => ({
        localId: row.localId,
        recordId: row.recordId,
        company: row.company.trim(),
        startYm: row.startYm,
        endYm: row.endYm,
        division: row.division.trim(),
        title: row.title.trim(),
      }));
      const snapshot = JSON.stringify(
        normalized.map((row) => ({
          recordId: row.recordId ?? null,
          company: row.company,
          startYm: row.startYm,
          endYm: row.endYm,
          division: row.division,
          title: row.title,
        }))
      );

      if (snapshot === lastSavedSnapshotRef.current) {
        return true;
      }

      const schemaInput = normalized.map((row) => ({
        company: row.company,
        startYm: row.startYm,
        endYm: row.endYm ? row.endYm : undefined,
        division: row.division ? row.division : undefined,
        title: row.title ? row.title : undefined,
      }));
      const parsedRows = WorksFormSchema.safeParse(schemaInput);
      if (!parsedRows.success) {
        if (options.allowInvalid) {
          return false;
        }
        return false;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        throw new Error("resumeId を取得できませんでした");
      }

      const sanitizedRows = parsedRows.data;
      const zipped = normalized.map((row, index) => ({
        ...row,
        sanitized: sanitizedRows[index],
      }));

      const updatedIds = new Map<string, string>();
      for (const entry of zipped) {
        const payload = {
          id: entry.recordId,
          resumeId: ensuredId,
          company: entry.sanitized.company,
          startYm: entry.sanitized.startYm,
          endYm: entry.sanitized.endYm,
          division: entry.sanitized.division,
          title: entry.sanitized.title,
        };
        const res = await fetch("/api/data/work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`職歴の保存に失敗しました (${res.status})`);
        }
        const data = (await res.json()) as {
          record?: { id?: string; company?: string; startYm?: string; endYm?: string; division?: string; title?: string };
        };
        const recordId = data.record && typeof data.record.id === "string" && data.record.id
          ? data.record.id
          : entry.recordId;
        if (recordId) {
          updatedIds.set(entry.localId, recordId);
        }
      }

      const finalSnapshot = JSON.stringify(
        zipped.map((entry) => ({
          recordId: updatedIds.get(entry.localId) ?? entry.recordId ?? null,
          company: entry.sanitized.company,
          startYm: entry.sanitized.startYm,
          endYm: entry.sanitized.endYm ?? "",
          division: entry.sanitized.division ?? "",
          title: entry.sanitized.title ?? "",
        }))
      );
      lastSavedSnapshotRef.current = finalSnapshot;

      const zippedMap = new Map(
        zipped.map((entry) => [entry.localId, entry])
      );

      setRows((prev) =>
        prev.map((row) => {
          const entry = zippedMap.get(row.localId);
          if (!entry) return row;
          const sanitized = entry.sanitized;
          const newId = updatedIds.get(entry.localId) ?? entry.recordId;
          return {
            ...row,
            recordId: newId,
            company: sanitized.company,
            startYm: sanitized.startYm,
            endYm: sanitized.endYm ?? "",
            division: sanitized.division ?? "",
            title: sanitized.title ?? "",
          };
        })
      );

      return true;
    },
    [ensureResumeId]
  );

  useEffect(() => {
    if (!hasHydrated) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!parsed.success) {
      return;
    }

    if (toSnapshot(rowsRef.current) === lastSavedSnapshotRef.current) {
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      setSaveState("saving");
      persistRows(rowsRef.current)
        .then((saved) => {
          if (saved) {
            setSaveState("saved");
            if (idleTimerRef.current) {
              clearTimeout(idleTimerRef.current);
            }
            idleTimerRef.current = setTimeout(() => setSaveState("idle"), 1200);
          } else {
            setSaveState("idle");
          }
        })
        .catch((error) => {
          console.error("Failed to auto save work rows", error);
          setSaveState("error");
        })
        .finally(() => {
          autoSaveTimerRef.current = null;
        });
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [hasHydrated, parsed.success, persistRows]);

  const runForceSave = useCallback(
    async (options: { allowInvalid?: boolean } = {}) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setSaveState("saving");
      try {
        const saved = await persistRows(rowsRef.current, options);
        if (!saved && options.allowInvalid) {
          setSaveState("idle");
          return true;
        }
        if (saved) {
          if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
          }
          setSaveState("saved");
          idleTimerRef.current = setTimeout(() => setSaveState("idle"), 1200);
          return true;
        }
        setSaveState("idle");
        return false;
      } catch (error) {
        console.error("Failed to save work rows", error);
        setSaveState("error");
        return false;
      }
    },
    [persistRows]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setShowAllErrors(true);
      if (!parsed.success) return;
      const ok = await runForceSave();
      if (ok) {
        router.push("/resume/5");
      }
    },
    [parsed.success, router, runForceSave]
  );

  const handleNavClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const disabled = anchor.getAttribute("aria-disabled");
      if (href === "/resume/3" && disabled !== "true") {
        event.preventDefault();
        event.stopPropagation();
        void (async () => {
          await runForceSave({ allowInvalid: true });
          setShowAllErrors(false);
          router.push("/resume/3");
        })();
      }
    },
    [router, runForceSave]
  );

  const getFieldError = useCallback(
    (localId: string, field: FieldKey) => {
      if (!showAllErrors && !(touched[localId]?.[field])) return null;
      return rowErrors[localId]?.[field] ?? null;
    },
    [rowErrors, showAllErrors, touched]
  );

  const isSaving = saveState === "saving";
  const nextDisabled = !parsed.success || isSaving || isLoading;
  const displayListError = showAllErrors ? listError : null;

  return (
    <form onSubmit={handleSubmit} className="resume-form">
      <div onClickCapture={handleNavClickCapture}>
        <StepNav
          step={4}
          prevHref="/resume/3"
          nextType="submit"
          nextHref="/resume/5"
          nextDisabled={nextDisabled}
        />
      </div>

      <h1 className="resume-form__title">職歴</h1>
      <p className="resume-form__description">
        直近の職歴を入力してください。職歴は少なくとも1件が必要です。
      </p>

      {loadError && (
        <div className="resume-form__error" role="alert">
          {loadError}
        </div>
      )}

      {isLoading && (
        <div className="resume-form__hint" aria-live="polite">
          読み込み中です…
        </div>
      )}

      {rows.map((row, index) => {
        const companyError = getFieldError(row.localId, "company");
        const startError = getFieldError(row.localId, "startYm");
        const endError = getFieldError(row.localId, "endYm");
        return (
          <section key={row.localId} className="resume-card">
            <header className="resume-card__header">
              <h2 className="resume-card__title">職歴 {index + 1}</h2>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="resume-card__remove"
                  onClick={() => handleRemoveRow(row.localId, row.recordId)}
                >
                  削除
                </button>
              )}
            </header>

            <div className="resume-card__body">
              <label className="resume-field">
                <span className="resume-field__label">
                  会社名 <span className="resume-field__required">*</span>
                </span>
                <input
                  type="text"
                  value={row.company}
                  onChange={(event) =>
                    handleFieldChange(row.localId, "company", event.target.value)
                  }
                  onBlur={() => handleFieldBlur(row.localId, "company")}
                  aria-invalid={companyError ? "true" : undefined}
                  className={`resume-field__input${companyError ? " has-error" : ""}`}
                />
                {companyError && (
                  <span className="resume-field__error" role="alert">
                    {companyError}
                  </span>
                )}
              </label>

              <div className="resume-field-grid">
                <label className="resume-field">
                  <span className="resume-field__label">
                    入社年月 <span className="resume-field__required">*</span>
                  </span>
                  <input
                    type="month"
                    value={row.startYm}
                    onChange={(event) =>
                      handleFieldChange(row.localId, "startYm", event.target.value)
                    }
                    onBlur={() => handleFieldBlur(row.localId, "startYm")}
                    aria-invalid={startError ? "true" : undefined}
                    className={`resume-field__input${startError ? " has-error" : ""}`}
                  />
                  {startError && (
                    <span className="resume-field__error" role="alert">
                      {startError}
                    </span>
                  )}
                </label>

                <label className="resume-field">
                  <span className="resume-field__label">退社年月</span>
                  <input
                    type="month"
                    value={row.endYm}
                    onChange={(event) =>
                      handleFieldChange(row.localId, "endYm", event.target.value)
                    }
                    onBlur={() => handleFieldBlur(row.localId, "endYm")}
                    aria-invalid={endError ? "true" : undefined}
                    min={row.startYm || undefined}
                    className={`resume-field__input${endError ? " has-error" : ""}`}
                  />
                  {endError && (
                    <span className="resume-field__error" role="alert">
                      {endError}
                    </span>
                  )}
                </label>
              </div>

              <label className="resume-field">
                <span className="resume-field__label">部署 / 部門</span>
                <input
                  type="text"
                  value={row.division}
                  onChange={(event) =>
                    handleFieldChange(row.localId, "division", event.target.value)
                  }
                  onBlur={() => handleFieldBlur(row.localId, "division")}
                  className="resume-field__input"
                />
              </label>

              <label className="resume-field">
                <span className="resume-field__label">役職</span>
                <input
                  type="text"
                  value={row.title}
                  onChange={(event) =>
                    handleFieldChange(row.localId, "title", event.target.value)
                  }
                  onBlur={() => handleFieldBlur(row.localId, "title")}
                  className="resume-field__input"
                />
              </label>
            </div>
          </section>
        );
      })}

      {displayListError && (
        <div className="resume-form__error" role="alert">
          {displayListError}
        </div>
      )}

      <button type="button" className="resume-add-button" onClick={handleAddRow}>
        職歴を追加
      </button>

      <AutoSaveBadge state={saveState} />
    </form>
  );
}
