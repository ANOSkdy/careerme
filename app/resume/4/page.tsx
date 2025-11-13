"use client";

import { useState } from "react";

import MonthYearSelect from "../../../components/form/MonthYearSelect";
import StepNav from "../_components/StepNav";

type WorkRow = {
  key: string;
  company: string;
  division: string;
  title: string;
  startYm: string;
  endYm: string;
  description: string;
};

function createRowKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function createEmptyRow(): WorkRow {
  return {
    key: createRowKey(),
    company: "",
    division: "",
    title: "",
    startYm: "",
    endYm: "",
    description: "",
  };
}

export default function ResumeStep4Page() {
  const [rows, setRows] = useState<WorkRow[]>([createEmptyRow()]);

  const updateRow = (index: number, field: keyof Omit<WorkRow, "key">, value: string) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate style={{ display: "grid", gap: "24px" }}>
      <div>
        <h2 className="resume-page-title">職歴</h2>
        <p style={{ marginTop: "4px", fontSize: "0.95rem", color: "var(--color-muted, #6b7280)" }}>
          これまでのご経験を入力してください。
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {rows.map((row, index) => (
          <div
            key={row.key}
            style={{
              border: "1px solid var(--color-border, #d1d5db)",
              borderRadius: "12px",
              padding: "16px",
              display: "grid",
              gap: "12px",
              backgroundColor: "#ffffff",
            }}
          >
            <p style={{ fontWeight: 600, color: "var(--color-text-strong, #111827)" }}>
              職歴 {index + 1}
            </p>

            <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
              会社名
              <input
                id={`company-${row.key}`}
                name={`company-${row.key}`}
                type="text"
                value={row.company}
                onChange={(event) => updateRow(index, "company", event.target.value)}
                placeholder="株式会社キャリミー"
                autoComplete="organization"
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #d1d5db)",
                  padding: "10px 12px",
                }}
              />
            </label>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <label
                style={{
                  flex: 1,
                  minWidth: "140px",
                  display: "grid",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                部署
                <input
                  id={`division-${row.key}`}
                  type="text"
                  value={row.division}
                  onChange={(event) => updateRow(index, "division", event.target.value)}
                  placeholder="プロダクト本部"
                  style={{
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #d1d5db)",
                    padding: "10px 12px",
                  }}
                />
              </label>
              <label
                style={{
                  flex: 1,
                  minWidth: "140px",
                  display: "grid",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                役職
                <input
                  id={`title-${row.key}`}
                  type="text"
                  value={row.title}
                  onChange={(event) => updateRow(index, "title", event.target.value)}
                  placeholder="プロジェクトマネージャー"
                  style={{
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #d1d5db)",
                    padding: "10px 12px",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <label
                style={{
                  flex: 1,
                  minWidth: "140px",
                  display: "grid",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                入社年月
                <MonthYearSelect
                  id={`start-${row.key}`}
                  value={row.startYm}
                  onChange={(value) => updateRow(index, "startYm", value)}
                />
              </label>
              <label
                style={{
                  flex: 1,
                  minWidth: "140px",
                  display: "grid",
                  gap: "4px",
                  fontWeight: 600,
                }}
              >
                退社年月
                <MonthYearSelect
                  id={`end-${row.key}`}
                  value={row.endYm}
                  onChange={(value) => updateRow(index, "endYm", value)}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: "4px", fontWeight: 600 }}>
              業務内容
              <textarea
                id={`description-${row.key}`}
                value={row.description}
                onChange={(event) => updateRow(index, "description", event.target.value)}
                placeholder="担当業務や成果などを記載してください"
                rows={5}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #d1d5db)",
                  padding: "12px",
                  resize: "vertical",
                  minHeight: "140px",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                disabled={rows.length <= 1}
                style={{
                  backgroundColor: "#ffffff",
                  color: "var(--color-primary, #2563eb)",
                  border: "1px solid rgba(37, 99, 235, 0.3)",
                  borderRadius: "9999px",
                  padding: "0.5rem 1rem",
                  fontWeight: 600,
                  cursor: rows.length <= 1 ? "not-allowed" : "pointer",
                  minHeight: "auto",
                  opacity: rows.length <= 1 ? 0.5 : 1,
                  backgroundImage: "none",
                }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={handleAddRow}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px dashed var(--color-primary, #2563eb)",
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            color: "var(--color-primary, #2563eb)",
            borderRadius: "9999px",
            padding: "10px 18px",
            fontWeight: 600,
          }}
        >
          ＋ 職歴を追加
        </button>
      </div>

      <div style={{ marginTop: "8px" }}>
        <StepNav
          step={4}
          totalSteps={5}
          prevHref="/resume/3"
          nextHref="/resume/5"
          nextType="link"
          nextDisabled={false}
        />
      </div>
    </form>
  );
}
