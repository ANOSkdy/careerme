"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { useDraftId } from "../_components/hooks/useDraftId";
import {
  EducationItem,
  EducationItemSchema,
  EducationListSchema,
} from "../_schemas/resume";

function emptyRow(): EducationItem {
  return {
    school: "",
    degree: "",
    start: "",
    end: "",
    current: false,
    description: "",
  };
}

type RowErrors = Record<number, Record<string, string>>;

type EducationResponse = {
  ok?: boolean;
  items?: Array<Partial<EducationItem> & { id?: string }>;
};

export default function Step3Page() {
  const draftId = useDraftId();
  const [items, setItems] = useState<EducationItem[]>([emptyRow()]);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!draftId) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/data/education?draftId=${draftId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`failed to fetch education: ${res.status}`);
        const json = (await res.json()) as EducationResponse;
        if (cancelled) return;
        if (Array.isArray(json?.items) && json.items.length > 0) {
          const normalized = json.items.map((item) => ({
            school: item.school ?? "",
            degree: item.degree ?? "",
            start: item.start ?? "",
            end: item.end ?? "",
            current: Boolean(item.current),
            description: item.description ?? "",
          }));
          setItems(normalized);
        } else {
          setItems([emptyRow()]);
        }
        setDirty(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load education entries", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draftId]);

  const save = useCallback(
    async (data: EducationItem[]) => {
      if (!draftId) return;
      const res = await fetch("/api/data/education", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, items: data }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `failed to save education: ${res.status}`);
      }
    },
    [draftId]
  );

  const parsedList = useMemo(() => EducationListSchema.safeParse(items), [items]);

  useEffect(() => {
    const nextErrors: RowErrors = {};
    items.forEach((row, index) => {
      const parsed = EducationItemSchema.safeParse(row);
      if (!parsed.success) {
        nextErrors[index] = {};
        parsed.error.issues.forEach((issue) => {
          const path = issue.path.join(".") || "_";
          nextErrors[index][path] = issue.message;
        });
      }
    });
    setRowErrors(nextErrors);
  }, [items]);

  const autoSaveState = useAutoSave(items, save, 2000, {
    enabled: parsedList.success,
  });

  const onTextChange = useCallback(
    (index: number, key: keyof Omit<EducationItem, "current">) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setDirty(true);
        setItems((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], [key]: value } as EducationItem;
          return next;
        });
      },
    []
  );

  const onCurrentChange = useCallback(
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setDirty(true);
      setItems((prev) => {
        const next = [...prev];
        const updated: EducationItem = {
          ...next[index],
          current: checked,
          end: checked ? "" : next[index].end,
        };
        next[index] = updated;
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

  const nextDisabled = !parsedList.success;
  const showSummary = dirty && !parsedList.success;

  return (
    <div>
      <h2
        style={{
          marginBottom: "16px",
          fontSize: "1.25rem",
          fontWeight: 500,
        }}
      >
        学歴
      </h2>

      {showSummary && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: "1px solid #fecaca",
            backgroundColor: "#fef2f2",
            padding: "12px",
            fontSize: "0.875rem",
            color: "#b91c1c",
          }}
        >
          入力内容に不備があります。各行を確認してください。
        </div>
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        {items.map((row, index) => {
          const errors = rowErrors[index] ?? {};
          return (
            <fieldset
              key={`education-row-${index}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              <legend style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                学歴 {index + 1}
              </legend>
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label
                    htmlFor={`school-${index}`}
                    style={{ fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    学校名 <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
                  </label>
                  <input
                    id={`school-${index}`}
                    value={row.school}
                    onChange={onTextChange(index, "school")}
                    style={{
                      marginTop: "4px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    aria-invalid={Boolean(errors.school)}
                    aria-describedby={errors.school ? `error-school-${index}` : undefined}
                  />
                  {errors.school && (
                    <p
                      id={`error-school-${index}`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.school}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label
                    htmlFor={`degree-${index}`}
                    style={{ fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    学部・学位
                  </label>
                  <input
                    id={`degree-${index}`}
                    value={row.degree ?? ""}
                    onChange={onTextChange(index, "degree")}
                    style={{
                      marginTop: "4px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label
                    htmlFor={`start-${index}`}
                    style={{ fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    開始 <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
                  </label>
                  <input
                    id={`start-${index}`}
                    type="month"
                    value={row.start ?? ""}
                    onChange={onTextChange(index, "start")}
                    style={{
                      marginTop: "4px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    aria-invalid={Boolean(errors.start)}
                    aria-describedby={errors.start ? `error-start-${index}` : undefined}
                  />
                  {errors.start && (
                    <p
                      id={`error-start-${index}`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.start}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label
                    htmlFor={`end-${index}`}
                    style={{ fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    終了
                  </label>
                  <input
                    id={`end-${index}`}
                    type="month"
                    value={row.end ?? ""}
                    onChange={onTextChange(index, "end")}
                    style={{
                      marginTop: "4px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                    }}
                    disabled={Boolean(row.current)}
                    aria-invalid={Boolean(errors.end)}
                    aria-describedby={errors.end ? `error-end-${index}` : undefined}
                  />
                  {errors.end && (
                    <p
                      id={`error-end-${index}`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.end}
                    </p>
                  )}
                  <label
                    style={{
                      marginTop: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(row.current)}
                      onChange={onCurrentChange(index)}
                    />
                    在学中（終了なし）
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <label
                  htmlFor={`description-${index}`}
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  補足
                </label>
                <textarea
                  id={`description-${index}`}
                  value={row.description ?? ""}
                  onChange={onTextChange(index, "description")}
                  rows={3}
                  style={{
                    marginTop: "4px",
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
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.8125rem",
                    backgroundColor: "#ffffff",
                  }}
                >
                  削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={addRow}
          style={{
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "0.875rem",
            border: "none",
            color: "#ffffff",
            backgroundColor: "var(--color-primary, #4A90E2)",
          }}
        >
          行を追加
        </button>
        <AutoSaveBadge state={autoSaveState} />
      </div>

      <StepNav step={3} nextDisabled={nextDisabled} />
    </div>
  );
}
