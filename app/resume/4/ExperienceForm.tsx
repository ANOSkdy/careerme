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
import {
  ExperienceItemSchema,
  ExperienceListSchema,
  type ExperienceItem,
} from "../../../lib/validation/schemas";

const STORAGE_KEY = "resume.resumeId";

type ExperienceRow = ExperienceItem;

type RowErrors = Partial<Record<keyof ExperienceRow, string>>;

type ExperienceResponse = {
  ok?: boolean;
  items?: Array<{
    companyName?: string;
    jobTitle?: string;
    start?: string;
    end?: string;
    present?: boolean;
    current?: boolean;
    description?: string;
  }>;
};

type ResumeResponse = {
  certifications?: unknown;
};

type LookupResponse = {
  ok?: boolean;
  options?: Array<{ value: string; label: string }>;
};

const emptyRow: ExperienceRow = {
  companyName: "",
  jobTitle: "",
  start: "",
  end: "",
  present: false,
  description: "",
};

function toRow(raw: unknown): ExperienceRow {
  if (!raw || typeof raw !== "object") return { ...emptyRow };
  const source = raw as Record<string, unknown>;
  const present = Boolean(source.present ?? source.current);
  const endValue = present
    ? ""
    : typeof source.end === "string"
      ? source.end
      : "";

  return {
    companyName:
      typeof source.companyName === "string" ? source.companyName : "",
    jobTitle: typeof source.jobTitle === "string" ? source.jobTitle : "",
    start: typeof source.start === "string" ? source.start : "",
    end: endValue,
    present,
    description:
      typeof source.description === "string" ? source.description : "",
  };
}

function parseCertifications(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}

export default function ExperienceForm() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExperienceRow[]>([{ ...emptyRow }]);
  const rowsRef = useRef<ExperienceRow[]>([{ ...emptyRow }]);
  const touchedRowsRef = useRef<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [listError, setListError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [experienceSaveState, setExperienceSaveState] = useState<SaveState>("idle");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certificationOptions, setCertificationOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [certificationSaveState, setCertificationSaveState] =
    useState<SaveState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setResumeId(stored);
      return;
    }
    const generated =
      window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_KEY, generated);
    setResumeId(generated);
  }, []);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const validation = ExperienceListSchema.safeParse(rows);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      setListError(firstIssue?.message ?? "職歴を確認してください");
    } else {
      setListError(null);
    }

    const nextErrors: Record<number, RowErrors> = {};
    rows.forEach((row, index) => {
      const parsed = ExperienceItemSchema.safeParse(row);
      if (!parsed.success) {
        nextErrors[index] = {};
        parsed.error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (
            key === "companyName" ||
            key === "jobTitle" ||
            key === "start" ||
            key === "end"
          ) {
            nextErrors[index]![key] = issue.message;
          }
        });
      }
    });
    setRowErrors(nextErrors);
  }, [rows]);

  const hasValidList = useMemo(
    () => ExperienceListSchema.safeParse(rows).success,
    [rows]
  );

  const handleLoad = useCallback(
    async (id: string) => {
      setLoadError(null);
      try {
        const [experienceRes, resumeRes, lookupRes] = await Promise.all([
          fetch(`/api/data/experience?resumeId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/data/resume?draftId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/data/lookups?type=certifications`, {
            cache: "force-cache",
          }),
        ]);

        if (!experienceRes.ok) {
          throw new Error(`failed to load experiences (${experienceRes.status})`);
        }
        const experienceJson = (await experienceRes.json()) as ExperienceResponse;
        if (Array.isArray(experienceJson.items) && experienceJson.items.length) {
          const nextRows = experienceJson.items.map((item) => toRow(item));
          rowsRef.current = nextRows;
          setRows(nextRows);
        } else {
          rowsRef.current = [{ ...emptyRow }];
          setRows([{ ...emptyRow }]);
        }

        if (!resumeRes.ok) {
          throw new Error(`failed to load resume (${resumeRes.status})`);
        }
        const resumeJson = (await resumeRes.json()) as ResumeResponse;
        setCertifications(parseCertifications(resumeJson.certifications));

        if (!lookupRes.ok) {
          throw new Error(`failed to load lookups (${lookupRes.status})`);
        }
        const lookupJson = (await lookupRes.json()) as LookupResponse;
        if (Array.isArray(lookupJson.options)) {
          setCertificationOptions(lookupJson.options);
        } else {
          setCertificationOptions([]);
        }
      } catch (error) {
        console.error("Failed to load experience step", error);
        setLoadError("データの取得に失敗しました。時間をおいて再度お試しください。");
      }
    },
    []
  );

  useEffect(() => {
    if (!resumeId) return;
    void handleLoad(resumeId);
  }, [resumeId, handleLoad]);

  const saveExperiences = useCallback(
    async (items: ExperienceRow[]) => {
      if (!resumeId) return;
      const parsed = ExperienceListSchema.safeParse(items);
      if (!parsed.success) return;
      setExperienceSaveState("saving");
      try {
        const res = await fetch("/api/data/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId, items: parsed.data }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save experiences (${res.status})`);
        }
        setExperienceSaveState("saved");
        setTimeout(() => setExperienceSaveState("idle"), 1500);
      } catch (error) {
        console.error("Failed to save experiences", error);
        setExperienceSaveState("error");
      }
    },
    [resumeId]
  );

  const saveCertifications = useCallback(
    async (values: string[]) => {
      if (!resumeId) return;
      setCertificationSaveState("saving");
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: resumeId, certifications: values }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save certifications (${res.status})`);
        }
        setCertificationSaveState("saved");
        setTimeout(() => setCertificationSaveState("idle"), 1500);
      } catch (error) {
        console.error("Failed to save certifications", error);
        setCertificationSaveState("error");
      }
    },
    [resumeId]
  );

  const handleFieldChange = useCallback(
    (
      index: number,
      key: keyof Pick<ExperienceRow, "companyName" | "jobTitle" | "start" | "end" | "description">
    ) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setRows((prev) => {
          const next = prev.map((row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [key]: value as string,
                }
              : row
          );
          rowsRef.current = next;
          return next;
        });
      },
    []
  );

  const handleBlur = useCallback(
    (index: number) => () => {
      touchedRowsRef.current.add(index);
      const row = rowsRef.current[index];
      const parsed = ExperienceItemSchema.safeParse(row);
      if (parsed.success) {
        void saveExperiences(rowsRef.current);
      }
    },
    [saveExperiences]
  );

  const handleAddRow = () => {
    const next = [...rows, { ...emptyRow }];
    setRows(next);
    rowsRef.current = next;
    touchedRowsRef.current.add(next.length - 1);
    void saveExperiences(next);
  };

  const handleRemoveRow = (index: number) => {
    const next = rows.length === 1 ? [{ ...emptyRow }] : rows.filter((_, i) => i !== index);
    const parsed = ExperienceListSchema.safeParse(next);
    setRows(next);
    rowsRef.current = next;

    const nextTouched = new Set<number>();
    touchedRowsRef.current.forEach((value) => {
      if (value === index) return;
      nextTouched.add(value > index ? value - 1 : value);
    });
    touchedRowsRef.current = nextTouched;

    if (parsed.success) {
      void saveExperiences(next);
    }
  };

  const handleCertificationsChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    setCertifications(selected);
    void saveCertifications(selected);
  };

  const handleRemoveCertification = (value: string) => {
    const next = certifications.filter((item) => item !== value);
    setCertifications(next);
    void saveCertifications(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasValidList || !resumeId) return;
    setIsSubmitting(true);
    try {
      await saveExperiences(rowsRef.current);
      router.push("/resume/5");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2
        style={{
          marginBottom: "12px",
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--color-heading, #111827)",
        }}
      >
        職歴
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "16px" }}>
        会社名・職種・開始年月は必須です。終了年月は在籍中の場合は空欄のままにしてください。
      </p>

      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #fca5a5",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          {loadError}
        </div>
      )}

      {listError && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #fcd34d",
            backgroundColor: "#fffbeb",
            color: "#92400e",
            fontSize: "0.875rem",
          }}
        >
          {listError}
        </div>
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        {rows.map((row, index) => {
          const errors = rowErrors[index] ?? {};
          const fieldId = `experience-${index}`;
          return (
            <fieldset
              key={`experience-row-${index}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              <legend style={{ fontSize: "1rem", fontWeight: 600 }}>職歴 {index + 1}</legend>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div>
                  <label
                    htmlFor={`${fieldId}-company`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    企業名 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-company`}
                    type="text"
                    value={row.companyName}
                    onChange={handleFieldChange(index, "companyName")}
                    onBlur={handleBlur(index)}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(errors.companyName)}
                    aria-describedby={
                      errors.companyName ? `${fieldId}-company-error` : undefined
                    }
                  />
                  {errors.companyName && (
                    <p
                      id={`${fieldId}-company-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.companyName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-title`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    職種 / 役職 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-title`}
                    type="text"
                    value={row.jobTitle}
                    onChange={handleFieldChange(index, "jobTitle")}
                    onBlur={handleBlur(index)}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(errors.jobTitle)}
                    aria-describedby={
                      errors.jobTitle ? `${fieldId}-title-error` : undefined
                    }
                  />
                  {errors.jobTitle && (
                    <p
                      id={`${fieldId}-title-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.jobTitle}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-start`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    開始年月 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-start`}
                    type="month"
                    value={row.start}
                    onChange={handleFieldChange(index, "start")}
                    onBlur={handleBlur(index)}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(errors.start)}
                    aria-describedby={errors.start ? `${fieldId}-start-error` : undefined}
                  />
                  {errors.start && (
                    <p
                      id={`${fieldId}-start-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.start}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-end`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    終了年月
                  </label>
                  <input
                    id={`${fieldId}-end`}
                    type="month"
                    value={row.end ?? ""}
                    onChange={handleFieldChange(index, "end")}
                    onBlur={handleBlur(index)}
                    disabled={row.present}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                      backgroundColor: row.present ? "#f3f4f6" : "#ffffff",
                      color: row.present ? "#6b7280" : "#111827",
                    }}
                    aria-invalid={Boolean(errors.end)}
                    aria-describedby={errors.end ? `${fieldId}-end-error` : undefined}
                  />
                  {errors.end && (
                    <p
                      id={`${fieldId}-end-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.end}
                    </p>
                  )}
                  <label
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.75rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={row.present}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRows((prev) => {
                          const next = prev.map((item, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...item,
                                  present: checked,
                                  end: checked ? "" : item.end,
                                }
                              : item
                          );
                          rowsRef.current = next;
                          return next;
                        });
                        touchedRowsRef.current.add(index);
                        const row = rowsRef.current[index];
                        const parsed = ExperienceItemSchema.safeParse(row);
                        if (parsed.success) {
                          void saveExperiences(rowsRef.current);
                        }
                      }}
                    />
                    在籍中
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-description`}
                  style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                >
                  業務内容（任意）
                </label>
                <textarea
                  id={`${fieldId}-description`}
                  value={row.description ?? ""}
                  onChange={handleFieldChange(index, "description")}
                  onBlur={handleBlur(index)}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    minHeight: "120px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "8px 12px",
                    fontSize: "0.875rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  style={{
                    appearance: "none",
                    border: "1px solid #fecaca",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                  aria-label={`職歴 ${index + 1} を削除`}
                >
                  職歴を削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={handleAddRow}
          style={{
            appearance: "none",
            border: "1px solid var(--color-primary, #2563eb)",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          職歴の追加
        </button>
      </div>

      <AutoSaveBadge state={experienceSaveState} />

      <section style={{ marginTop: "32px" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "12px" }}>
          資格
        </h3>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "12px" }}>
          取得済みの資格を選択してください。複数選択できます。
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label htmlFor="resume-certifications" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            資格一覧
          </label>
          <select
            id="resume-certifications"
            multiple
            value={certifications}
            onChange={handleCertificationsChange}
            style={{
              minHeight: "160px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              padding: "8px",
              fontSize: "0.875rem",
            }}
          >
            {certificationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {certifications.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {certifications.map((value) => {
                const option = certificationOptions.find((item) => item.value === value);
                const label = option?.label ?? value;
                return (
                  <span
                    key={value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "9999px",
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: "0.75rem",
                    }}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveCertification(value)}
                      aria-label={`${label} を削除`}
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "0.75rem",
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <AutoSaveBadge state={certificationSaveState} />
      </section>

      <StepNav step={4} nextDisabled={!hasValidList || isSubmitting} />
    </form>
  );
}
