"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BasicInfo, BasicInfoPartial } from "../../../lib/validation/schemas";
import {
  BasicInfoPartialSchema,
  BasicInfoSchema,
} from "../../../lib/validation/schemas";
import StepNav from "../_components/StepNav";

const STORAGE_KEY = "resume.resumeId";

const genderOptions: { value: BasicInfo["gender"]; label: string }[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "none", label: "未選択" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1899 }, (_, index) => 1900 + index).reverse();
const months = Array.from({ length: 12 }, (_, index) => index + 1);

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function getDaysInMonth(year: number | null, month: number | null) {
  if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) {
    return 31;
  }
  return new Date(year, month, 0).getDate();
}

type FormState = {
  lastName: string;
  firstName: string;
  gender: BasicInfo["gender"];
  dob: {
    year: string;
    month: string;
    day: string;
  };
};

type FieldKey = "lastName" | "firstName" | "gender" | "dob.year" | "dob.month" | "dob.day";

const initialForm: FormState = {
  lastName: "",
  firstName: "",
  gender: "none",
  dob: { year: "", month: "", day: "" },
};

function formFromBasicInfo(value: BasicInfo): FormState {
  return {
    lastName: value.lastName ?? "",
    firstName: value.firstName ?? "",
    gender: value.gender ?? "none",
    dob: {
      year: value.dob?.year ? String(value.dob.year) : "",
      month: value.dob?.month ? String(value.dob.month) : "",
      day: value.dob?.day ? String(value.dob.day) : "",
    },
  };
}

function formFromPartialBasicInfo(value: BasicInfoPartial): FormState {
  return {
    lastName: value.lastName ?? "",
    firstName: value.firstName ?? "",
    gender: value.gender ?? "none",
    dob: {
      year: value.dob?.year ? String(value.dob.year) : "",
      month: value.dob?.month ? String(value.dob.month) : "",
      day: value.dob?.day ? String(value.dob.day) : "",
    },
  };
}

function extractBasicInfo(payload: unknown):
  | { form: FormState; snapshot: string | null }
  | null {
  const candidates = [
    (payload as { basicInfo?: unknown })?.basicInfo,
    (payload as { data?: { basicInfo?: unknown } })?.data?.basicInfo,
    (payload as { fields?: { basicInfo?: unknown } })?.fields?.basicInfo,
    (payload as { step1?: unknown })?.step1,
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const full = BasicInfoSchema.safeParse(candidate);
    if (full.success) {
      return { form: formFromBasicInfo(full.data), snapshot: JSON.stringify(full.data) };
    }
    const partial = BasicInfoPartialSchema.safeParse(candidate);
    if (partial.success) {
      return { form: formFromPartialBasicInfo(partial.data), snapshot: null };
    }
  }

  return null;
}

export default function BasicInfoForm() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    lastName: false,
    firstName: false,
    gender: false,
    "dob.year": false,
    "dob.month": false,
    "dob.day": false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
    if (!resumeId) return;
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ id: resumeId, draftId: resumeId });
        const res = await fetch(`/api/data/resume?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          console.warn("Failed to fetch resume", res.status);
          return;
        }
        const data = await res.json();
        const basicInfo = extractBasicInfo(data);
        if (!cancelled && basicInfo) {
          setForm(basicInfo.form);
          if (basicInfo.snapshot) {
            setLastSavedSnapshot(basicInfo.snapshot);
          } else {
            setLastSavedSnapshot(null);
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load resume basic info", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resumeId]);

  const parsed = useMemo(() => BasicInfoSchema.safeParse(form), [form]);

  useEffect(() => {
    if (parsed.success) {
      setErrors({});
    } else {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        map[key] = issue.message;
      }
      setErrors(map);
    }
  }, [parsed]);

  const yearNumber = Number.parseInt(form.dob.year, 10);
  const monthNumber = Number.parseInt(form.dob.month, 10);
  const maxDay = getDaysInMonth(
    Number.isNaN(yearNumber) ? null : yearNumber,
    Number.isNaN(monthNumber) ? null : monthNumber
  );
  const days = Array.from({ length: maxDay }, (_, index) => index + 1);

  useEffect(() => {
    const dayNumber = Number.parseInt(form.dob.day, 10);
    if (form.dob.day && (!dayNumber || dayNumber > maxDay)) {
      setForm((prev) => ({
        ...prev,
        dob: { ...prev.dob, day: "" },
      }));
    }
  }, [maxDay, form.dob.day]);

  const saveData = useCallback(
    async (values: BasicInfo, skipIfUnchanged = false) => {
      if (!resumeId) return false;
      const snapshot = JSON.stringify(values);
      if (skipIfUnchanged && snapshot === lastSavedSnapshot) {
        return true;
      }
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: resumeId,
            lastName: values.lastName,
            firstName: values.firstName,
            dob: values.dob,
            gender: values.gender,
          }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to save: ${res.status}`);
        }
        setSaveState("saved");
        setLastSavedSnapshot(snapshot);
        return true;
      } catch (error) {
        console.error("Failed to save resume basic info", error);
        setSaveState("error");
        setSaveError("保存に失敗しました。時間をおいて再試行してください。");
        return false;
      }
    },
    [resumeId, lastSavedSnapshot]
  );

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleBlur = useCallback(
    (field: FieldKey) => {
      setFieldTouched(field);
      if (parsed.success && resumeId) {
        void saveData(parsed.data, true);
      }
    },
    [parsed, resumeId, saveData, setFieldTouched]
  );

  const handleInputChange = (field: "lastName" | "firstName") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleDobChange = (field: "year" | "month" | "day") =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.target;
      setForm((prev) => ({
        ...prev,
        dob: {
          ...prev.dob,
          [field]: value,
        },
      }));
    };

  const handleGenderSelect = (value: BasicInfo["gender"]) => {
    setForm((prev) => ({ ...prev, gender: value }));
    setFieldTouched("gender");
  };

  const showError = (field: FieldKey) => {
    const key = field;
    const message = errors[key] ?? (field.startsWith("dob") ? errors["dob"] : undefined);
    return Boolean(message) && (touched[field] || submitAttempted);
  };

  const getErrorMessage = (field: FieldKey) => {
    const key = field;
    return errors[key] ?? (field.startsWith("dob") ? errors["dob"] : undefined);
  };

  const nextDisabled = !parsed.success || isSubmitting || isLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);

    const result = BasicInfoSchema.safeParse(form);
    if (!result.success) {
      const allTouched: Record<FieldKey, boolean> = {
        lastName: true,
        firstName: true,
        gender: true,
        "dob.year": true,
        "dob.month": true,
        "dob.day": true,
      };
      setTouched(allTouched);
      return;
    }

    setIsSubmitting(true);
    const success = await saveData(result.data, false);
    setIsSubmitting(false);
    if (success) {
      router.push("/resume/2");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px" }}>
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-text, #333333)",
            marginBottom: "16px",
          }}
        >
          基本情報
        </h1>
        <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
          氏名と生年月日を入力してください。必要事項の入力後、「次へ」で次に進めます。
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label
            htmlFor="lastName"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}
          >
            姓 <span style={{ color: "var(--color-required, #FF4500)" }}>*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            value={form.lastName}
            onChange={handleInputChange("lastName")}
            onBlur={() => handleBlur("lastName")}
            aria-invalid={showError("lastName")}
            aria-describedby={showError("lastName") ? "error-lastName" : undefined}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: `1px solid ${showError("lastName") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
              padding: "10px 14px",
              fontSize: "1rem",
            }}
            placeholder="例：山田"
          />
          {showError("lastName") && (
            <p id="error-lastName" style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}>
              {getErrorMessage("lastName")}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="firstName"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}
          >
            名 <span style={{ color: "var(--color-required, #FF4500)" }}>*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            value={form.firstName}
            onChange={handleInputChange("firstName")}
            onBlur={() => handleBlur("firstName")}
            aria-invalid={showError("firstName")}
            aria-describedby={showError("firstName") ? "error-firstName" : undefined}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: `1px solid ${showError("firstName") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
              padding: "10px 14px",
              fontSize: "1rem",
            }}
            placeholder="例：太郎"
          />
          {showError("firstName") && (
            <p id="error-firstName" style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}>
              {getErrorMessage("firstName")}
            </p>
          )}
        </div>
      </div>

      <fieldset
        style={{
          border: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: "12px",
        }}
      >
        <legend
          style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}
        >
          生年月日 <span style={{ color: "var(--color-required, #FF4500)" }}>*</span>
        </legend>
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          <div>
            <label htmlFor="dob-year" style={srOnlyStyle}>
              生年
            </label>
            <select
              id="dob-year"
              name="dob-year"
              value={form.dob.year}
              onChange={handleDobChange("year")}
              onBlur={() => handleBlur("dob.year")}
              aria-invalid={showError("dob.year")}
              aria-describedby={showError("dob.year") ? "error-dob" : undefined}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: `1px solid ${showError("dob.year") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                padding: "10px 12px",
                fontSize: "1rem",
                backgroundColor: "var(--color-bg, #FFFFFF)",
              }}
            >
              <option value="" disabled>
                年
              </option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dob-month" style={srOnlyStyle}>
              月
            </label>
            <select
              id="dob-month"
              name="dob-month"
              value={form.dob.month}
              onChange={handleDobChange("month")}
              onBlur={() => handleBlur("dob.month")}
              aria-invalid={showError("dob.month")}
              aria-describedby={showError("dob.month") ? "error-dob" : undefined}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: `1px solid ${showError("dob.month") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                padding: "10px 12px",
                fontSize: "1rem",
                backgroundColor: "var(--color-bg, #FFFFFF)",
              }}
            >
              <option value="" disabled>
                月
              </option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dob-day" style={srOnlyStyle}>
              日
            </label>
            <select
              id="dob-day"
              name="dob-day"
              value={form.dob.day}
              onChange={handleDobChange("day")}
              onBlur={() => handleBlur("dob.day")}
              aria-invalid={showError("dob.day")}
              aria-describedby={showError("dob.day") ? "error-dob" : undefined}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: `1px solid ${showError("dob.day") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                padding: "10px 12px",
                fontSize: "1rem",
                backgroundColor: "var(--color-bg, #FFFFFF)",
              }}
            >
              <option value="" disabled>
                日
              </option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(showError("dob.year") || showError("dob.month") || showError("dob.day")) && (
          <p id="error-dob" style={{ fontSize: "0.75rem", color: "#dc2626" }}>
            {getErrorMessage("dob.year") || getErrorMessage("dob.month") || getErrorMessage("dob.day")}
          </p>
        )}
      </fieldset>

      <div style={{ display: "grid", gap: "12px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}>
          性別
        </span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }} role="group" aria-label="性別">
          {genderOptions.map((option) => {
            const isActive = form.gender === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleGenderSelect(option.value)}
                onBlur={() => handleBlur("gender")}
                aria-pressed={isActive}
                style={{
                  padding: "10px 16px",
                  borderRadius: "9999px",
                  border: `1px solid ${isActive ? "var(--color-primary, #3A75C4)" : "var(--color-border, #CCCCCC)"}`,
                  backgroundColor: isActive
                    ? "var(--color-primary, #3A75C4)"
                    : "var(--color-bg, #FFFFFF)",
                  color: isActive ? "#ffffff" : "var(--color-text, #333333)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  transition: "background-color 0.2s ease, color 0.2s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {saveError && (
          <p role="alert" style={{ fontSize: "0.75rem", color: "#dc2626" }}>
            {saveError}
          </p>
        )}
      </div>

      <div
        aria-live="polite"
        style={{
          fontSize: "0.75rem",
          color: "var(--color-secondary, #6b7280)",
        }}
      >
        {saveState === "saving" && "保存中…"}
        {saveState === "saved" && "保存しました"}
        {saveState === "error" && "保存に失敗しました"}
      </div>
      <StepNav
        step={1}
        nextType="submit"
        nextDisabled={nextDisabled}
        nextLabel={isSubmitting ? "送信中…" : "次へ"}
      />
    </form>
  );
}
