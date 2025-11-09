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
    <div className="resume-step">
      <h1 className="resume-step__title">職歴</h1>
      <p className="resume-step__description">これまでのご経験を入力してください。</p>
      <form className="resume-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <div className="work-list">
          {rows.map((row, index) => (
            <fieldset key={row.key} className="work-entry">
              <legend className="work-entry__legend">職歴 {index + 1}</legend>
              <div className="form-field">
                <label htmlFor={`company-${row.key}`} className="form-label">
                  会社名
                </label>
                <input
                  id={`company-${row.key}`}
                  name={`company-${row.key}`}
                  type="text"
                  value={row.company}
                  onChange={(event) => updateRow(index, "company", event.target.value)}
                  className="form-input"
                  placeholder="株式会社キャリアミー"
                  autoComplete="organization"
                />
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
                    onChange={(event) => updateRow(index, "division", event.target.value)}
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
                    onChange={(event) => updateRow(index, "title", event.target.value)}
                    placeholder="プロジェクトマネージャー"
                    className="form-input"
                  />
                </div>
              </div>
              <div className="form-field-grid">
                <div className="form-field">
                  <label htmlFor={`start-${row.key}`} className="form-label">
                    入社年月
                  </label>
                  <MonthYearSelect
                    id={`start-${row.key}`}
                    value={row.startYm}
                    onChange={(value) => updateRow(index, "startYm", value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`end-${row.key}`} className="form-label">
                    退社年月
                  </label>
                  <MonthYearSelect
                    id={`end-${row.key}`}
                    value={row.endYm}
                    onChange={(value) => updateRow(index, "endYm", value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor={`description-${row.key}`} className="form-label">
                  業務内容
                </label>
                <textarea
                  id={`description-${row.key}`}
                  value={row.description}
                  onChange={(event) => updateRow(index, "description", event.target.value)}
                  className="form-textarea"
                  placeholder="担当業務や成果などを記載してください"
                  rows={5}
                />
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
          ))}
        </div>
        <div className="work-actions">
          <button type="button" className="button button--secondary" onClick={handleAddRow}>
            ＋ 職歴を追加
          </button>
        </div>
        <StepNav
          step={4}
          totalSteps={5}
          prevHref="/resume/3"
          nextHref="/resume/5"
          nextType="link"
          nextDisabled={false}
        />
      </form>
    </div>
  );
}
