"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import TagInput from "../_components/TagInput";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { useDraftId } from "../_components/hooks/useDraftId";
import {
  WorkItemSchema,
  WorkListSchema,
  type WorkItem,
} from "../_schemas/resume";

function emptyRow(): WorkItem {
  return {
    company: "",
    title: "",
    startYm: "",
    endYm: "",
    roles: [],
    industries: [],
    details: "",
  };
}

type RowErrors = Record<number, Partial<Record<"company" | "startYm" | "endYm", string>>>;

type ResumeResponse = {
  works?: Array<Partial<WorkItem>>;
};

export default function Step4Page() {
  const draftId = useDraftId();
  const [items, setItems] = useState<WorkItem[]>([emptyRow()]);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!draftId) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/data/resume?draftId=${draftId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`failed to fetch resume: ${res.status}`);
        const json = (await res.json()) as ResumeResponse;
        if (cancelled) return;
        if (Array.isArray(json?.works) && json.works.length > 0) {
          setItems(
            json.works.map((item) => ({
              company: item?.company ?? "",
              title: item?.title ?? "",
              startYm: item?.startYm ?? "",
              endYm: item?.endYm ?? "",
              roles: Array.isArray(item?.roles)
                ? item.roles.filter((value): value is string => typeof value === "string")
                : [],
              industries: Array.isArray(item?.industries)
                ? item.industries.filter((value): value is string => typeof value === "string")
                : [],
              details: item?.details ?? "",
            }))
          );
        } else {
          setItems([emptyRow()]);
        }
        setDirty(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load work history", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draftId]);

  const save = useCallback(
    async (data: WorkItem[]) => {
      if (!draftId) return;
      const res = await fetch("/api/data/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, works: data }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `failed to save works: ${res.status}`);
      }
    },
    [draftId]
  );

  const parsedList = useMemo(() => WorkListSchema.safeParse(items), [items]);

  useEffect(() => {
    const nextErrors: RowErrors = {};
    items.forEach((row, index) => {
      const parsed = WorkItemSchema.safeParse(row);
      if (!parsed.success) {
        nextErrors[index] = {};
        parsed.error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          if (path === "company" || path === "startYm" || path === "endYm") {
            nextErrors[index]![path as keyof RowErrors[number]] = issue.message;
          }
        });
      }
    });
    setRowErrors(nextErrors);
  }, [items]);

  const autoSaveState = useAutoSave(items, save, 2000, {
    enabled: Boolean(draftId) && parsedList.success,
  });

  const onFieldChange = useCallback(
    (
      index: number,
      key: keyof Pick<WorkItem, "company" | "title" | "startYm" | "endYm" | "details">
    ) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setDirty(true);
        setItems((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], [key]: value } as WorkItem;
          return next;
        });
      },
    []
  );

  const onTagsChange = useCallback(
    (index: number, key: "roles" | "industries") => (values: string[]) => {
      setDirty(true);
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [key]: values } as WorkItem;
        return next;
      });
    },
    []
  );

  const addRow = () => {
    setDirty(true);
    setItems((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setDirty(true);
    setItems((prev) => {
      if (prev.length === 1) return [emptyRow()];
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const showSummary = dirty && !parsedList.success;

  return (
    <div>
      <h2
        style={{
          marginBottom: "12px",
          fontSize: "1.25rem",
          fontWeight: 500,
        }}
      >
        職歴
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "16px" }}>
        会社名と開始年月は必須項目です。タグは Enter または , で追加できます。
      </p>

      {showSummary && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: "1px solid #fcd34d",
            backgroundColor: "#fffbeb",
            padding: "12px",
            fontSize: "0.875rem",
            color: "#92400e",
          }}
        >
          必須項目を入力すると次のステップに進めます。
        </div>
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        {items.map((row, index) => {
          const errors = rowErrors[index] ?? {};
          const labelPrefix = `work-${index}`;
          return (
            <fieldset
              key={`work-row-${index}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              <legend style={{ fontSize: "1rem", fontWeight: 500 }}>
                職歴 {index + 1}
              </legend>

              <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>
                  <label
                    htmlFor={`${labelPrefix}-company`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    会社名 <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
                  </label>
                  <input
                    id={`${labelPrefix}-company`}
                    value={row.company}
                    onChange={onFieldChange(index, "company")}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    aria-invalid={Boolean(errors.company)}
                    aria-describedby={errors.company ? `${labelPrefix}-company-error` : undefined}
                  />
                  {errors.company && (
                    <p
                      id={`${labelPrefix}-company-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.company}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor={`${labelPrefix}-title`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    役職 / タイトル
                  </label>
                  <input
                    id={`${labelPrefix}-title`}
                    value={row.title ?? ""}
                    onChange={onFieldChange(index, "title")}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${labelPrefix}-start`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    開始年月 (YYYY-MM) <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
                  </label>
                  <input
                    id={`${labelPrefix}-start`}
                    value={row.startYm}
                    placeholder="2024-04"
                    onChange={onFieldChange(index, "startYm")}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    aria-invalid={Boolean(errors.startYm)}
                    aria-describedby={errors.startYm ? `${labelPrefix}-start-error` : undefined}
                  />
                  {errors.startYm && (
                    <p
                      id={`${labelPrefix}-start-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.startYm}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor={`${labelPrefix}-end`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    終了年月 (任意)
                  </label>
                  <input
                    id={`${labelPrefix}-end`}
                    value={row.endYm ?? ""}
                    placeholder="2025-03"
                    onChange={onFieldChange(index, "endYm")}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    aria-invalid={Boolean(errors.endYm)}
                    aria-describedby={errors.endYm ? `${labelPrefix}-end-error` : undefined}
                  />
                  {errors.endYm && (
                    <p
                      id={`${labelPrefix}-end-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.endYm}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <TagInput
                  id={`${labelPrefix}-roles`}
                  label="担当した職種タグ"
                  value={row.roles}
                  onChange={onTagsChange(index, "roles")}
                  placeholder="例) フロントエンド, PM"
                />
                <TagInput
                  id={`${labelPrefix}-industries`}
                  label="経験した業種タグ"
                  value={row.industries}
                  onChange={onTagsChange(index, "industries")}
                  placeholder="例) SaaS, 建設"
                />
              </div>

              <div>
                <label
                  htmlFor={`${labelPrefix}-details`}
                  style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
                >
                  詳細 (任意)
                </label>
                <textarea
                  id={`${labelPrefix}-details`}
                  value={row.details ?? ""}
                  onChange={onFieldChange(index, "details")}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    minHeight: "120px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "8px 12px",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
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
                  行を削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={addRow}
          style={{
            appearance: "none",
            border: "1px solid #2563eb",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          行を追加
        </button>
      </div>

      <AutoSaveBadge state={autoSaveState} />

      <StepNav step={4} nextDisabled={!parsedList.success} />
    </div>
  );
}
