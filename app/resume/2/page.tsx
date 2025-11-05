"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import ErrorSummary from "../_components/ErrorSummary";
import StepNav from "../_components/StepNav";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { useDraftId } from "../_components/hooks/useDraftId";
import { Step2Schema, type Step2 } from "../_schemas/resume";

const FIELD_LABELS: Record<keyof Step2, string> = {
  status: "現在の状況",
  note: "補足",
};

export default function Step2Page() {
  const draftId = useDraftId();
  const [form, setForm] = useState<Step2>({ status: "employed", note: "" });
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
        if (!cancelled && json?.step2) {
          setForm((prev) => ({ ...prev, ...json.step2 }));
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load resume step2", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draftId]);

  const save = useCallback(
    async (data: Step2) => {
      if (!draftId) return;
      await fetch("/api/data/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, step: 2, data }),
        cache: "no-store",
      });
    },
    [draftId]
  );

  const autoSaveState = useAutoSave(form, save, 2000);

  const parsed = useMemo(() => Step2Schema.safeParse(form), [form]);

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

  const onStatusChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, status: event.target.value as Step2["status"] }));
  };

  const onNoteChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, note: event.target.value }));
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
        状況
      </h2>

      {showSummary && (
        <ErrorSummary
          errors={errors}
          fieldOrder={["status", "note"]}
          fieldLabels={FIELD_LABELS}
        />
      )}

      <fieldset
        id="status"
        style={{
          display: "grid",
          gap: "8px",
          border: "1px solid transparent",
          padding: 0,
          margin: 0,
        }}
      >
        <legend
          style={{ marginBottom: "8px", display: "block", fontSize: "0.875rem", fontWeight: 500 }}
        >
          現在の状況 <span style={{ color: "var(--color-required, #ef4444)" }}>*</span>
        </legend>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="radio"
            name="status"
            value="employed"
            checked={form.status === "employed"}
            onChange={onStatusChange}
            aria-describedby={errors.status ? "error-status" : undefined}
          />
          在職中
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="radio"
            name="status"
            value="seeking"
            checked={form.status === "seeking"}
            onChange={onStatusChange}
            aria-describedby={errors.status ? "error-status" : undefined}
          />
          求職中
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="radio"
            name="status"
            value="student"
            checked={form.status === "student"}
            onChange={onStatusChange}
            aria-describedby={errors.status ? "error-status" : undefined}
          />
          学生
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="radio"
            name="status"
            value="other"
            checked={form.status === "other"}
            onChange={onStatusChange}
            aria-describedby={errors.status ? "error-status" : undefined}
          />
          その他
        </label>
        {errors.status && (
          <p id="error-status" style={{ fontSize: "0.75rem", color: "#dc2626" }}>
            {errors.status}
          </p>
        )}
      </fieldset>

      <div style={{ marginTop: "16px" }}>
        <label
          htmlFor="note"
          style={{ display: "block", fontSize: "0.875rem", fontWeight: 500 }}
        >
          補足
        </label>
        <textarea
          id="note"
          name="note"
          value={form.note ?? ""}
          onChange={onNoteChange}
          rows={4}
          style={{
            marginTop: "4px",
            width: "100%",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            padding: "8px 12px",
            resize: "vertical",
          }}
          aria-invalid={Boolean(errors.note)}
          aria-describedby={errors.note ? "error-note" : undefined}
        />
        {errors.note && (
          <p
            id="error-note"
            style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
          >
            {errors.note}
          </p>
        )}
      </div>

      <AutoSaveBadge state={autoSaveState} />
      <StepNav step={2} nextDisabled={nextDisabled} />
    </div>
  );
}
