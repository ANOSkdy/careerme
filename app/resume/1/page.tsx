"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import ErrorSummary from "../_components/ErrorSummary";
import StepNav from "../_components/StepNav";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { useDraftId } from "../_components/hooks/useDraftId";
import { Step1Schema, type Step1 } from "../_schemas/resume";

const FIELD_LABELS: Record<keyof Step1, string> = {
  fullName: "氏名",
  email: "メールアドレス",
  phone: "電話番号",
};

export default function Step1Page() {
  const draftId = useDraftId();
  const [form, setForm] = useState<Step1>({ fullName: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
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
        if (!res.ok) throw new Error(`failed to fetch draft: ${res.status}`);
        const json = await res.json();
        if (!cancelled && json?.step1) {
          setForm((prev) => ({ ...prev, ...json.step1 }));
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load resume step1", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draftId]);

  const save = useCallback(
    async (data: Step1) => {
      if (!draftId) return;
      await fetch("/api/data/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, step: 1, data }),
        cache: "no-store",
      });
    },
    [draftId]
  );

  const autoSaveState = useAutoSave(form, save, 2000);

  const parsed = useMemo(() => Step1Schema.safeParse(form), [form]);

  useEffect(() => {
    if (parsed.success) {
      setErrors({});
    } else {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        map[issue.path.join(".")] = issue.message;
      }
      setErrors(map);
    }
  }, [parsed]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setDirty(true);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const nextDisabled = !parsed.success;
  const showSummary = dirty && Object.keys(errors).length > 0;

  return (
    <div>
      <h2
        style={{
          marginBottom: "16px",
          fontSize: "1.25rem",
          fontWeight: 500,
        }}
      >
        基本情報
      </h2>

      {showSummary && (
        <ErrorSummary
          errors={errors}
          fieldOrder={["fullName", "email", "phone"]}
          fieldLabels={FIELD_LABELS}
        />
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label
            htmlFor="fullName"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
          >
            氏名 <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            value={form.fullName}
            onChange={onChange}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              padding: "8px 12px",
            }}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "error-fullName" : undefined}
          />
          {errors.fullName && (
            <p
              id="error-fullName"
              style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
            >
              {errors.fullName}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="email"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
          >
            メールアドレス <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              padding: "8px 12px",
            }}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "error-email" : undefined}
          />
          {errors.email && (
            <p
              id="error-email"
              style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
            >
              {errors.email}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="phone"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
          >
            電話番号
          </label>
          <input
            id="phone"
            name="phone"
            value={form.phone ?? ""}
            onChange={onChange}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              padding: "8px 12px",
            }}
          />
        </div>
      </div>

      <AutoSaveBadge state={autoSaveState} />
      <StepNav step={1} nextDisabled={nextDisabled} />
    </div>
  );
}
