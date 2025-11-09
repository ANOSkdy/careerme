"use client";

import Link from "next/link";
import { useState } from "react";

type SchoolCard = { id: number };

const finalEducationOptions = [
  { value: "junior_high", label: "中学" },
  { value: "high_school", label: "高校" },
  { value: "vocational", label: "専門" },
  { value: "college", label: "短大" },
  { value: "university", label: "大学" },
  { value: "graduate", label: "大学院" },
  { value: "other", label: "その他" },
];

export default function ResumeStep3Page() {
  const [schools, setSchools] = useState<SchoolCard[]>([{ id: 1 }]);

  const handleAddSchool = () => {
    setSchools((prev) => [...prev, { id: Date.now() }]);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm text-[var(--color-text-muted,#6b7280)]">STEP 3 / 6</p>
        <h1 className="text-2xl font-bold text-[var(--color-text,#111827)]">学歴</h1>
        <p className="text-sm text-[var(--color-text-muted,#6b7280)]">
          最終学歴と学校の情報を入力してください。
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text,#111827)]">最終学歴</h2>
        <div
          role="radiogroup"
          aria-label="最終学歴"
          className="flex flex-wrap gap-3"
        >
          {finalEducationOptions.map((option) => (
            <div key={option.value}>
              <input
                id={`final-education-${option.value}`}
                type="radio"
                name="finalEducation"
                value={option.value}
                className="peer sr-only"
                defaultChecked={option.value === "high_school"}
              />
              <label
                htmlFor={`final-education-${option.value}`}
                className="inline-flex items-center rounded-full border border-[var(--color-border,#e5e7eb)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text,#111827)] transition-colors peer-checked:border-transparent peer-checked:bg-[var(--color-primary,#2563eb)] peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-primary,#2563eb)]"
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text,#111827)]">学校情報</h2>
          <button
            type="button"
            onClick={handleAddSchool}
            className="rounded-lg border border-[var(--color-border,#e5e7eb)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text,#111827)] shadow-sm transition-colors hover:bg-[var(--color-surface-hover,#f9fafb)]"
          >
            学校を追加
          </button>
        </div>

        <div className="space-y-6">
          {schools.map((school, index) => (
            <div
              key={school.id}
              className="space-y-4 rounded-2xl border border-[var(--color-border,#e5e7eb)] bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text,#111827)]">
                    学校名
                  </span>
                  <input
                    type="text"
                    name={`schools[${index}][name]`}
                    className="w-full rounded-lg border border-[var(--color-border,#e5e7eb)] bg-white px-3 py-2 text-sm text-[var(--color-text,#111827)] focus:border-[var(--color-primary,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#2563eb)]/20"
                    placeholder="例：キャリア未来高校"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text,#111827)]">
                    学部・学科
                  </span>
                  <input
                    type="text"
                    name={`schools[${index}][department]`}
                    className="w-full rounded-lg border border-[var(--color-border,#e5e7eb)] bg-white px-3 py-2 text-sm text-[var(--color-text,#111827)] focus:border-[var(--color-primary,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#2563eb)]/20"
                    placeholder="例：情報工学科"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text,#111827)]">
                    入学年月
                  </span>
                  <input
                    type="month"
                    name={`schools[${index}][start]`}
                    className="w-full rounded-lg border border-[var(--color-border,#e5e7eb)] bg-white px-3 py-2 text-sm text-[var(--color-text,#111827)] focus:border-[var(--color-primary,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#2563eb)]/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text,#111827)]">
                    卒業(予定)年月
                  </span>
                  <input
                    type="month"
                    name={`schools[${index}][end]`}
                    className="w-full rounded-lg border border-[var(--color-border,#e5e7eb)] bg-white px-3 py-2 text-sm text-[var(--color-text,#111827)] focus:border-[var(--color-primary,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#2563eb)]/20"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-4 flex justify-end">
        <Link
          href="/resume/4"
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary,#2563eb)] px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover,#1d4ed8)]"
        >
          次へ
        </Link>
      </footer>
    </main>
  );
}
