
"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";

import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import {
  BasicInfoSchema,
  type BasicInfo,
} from "../../../lib/validation/schemas";

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

type ResumeResponse = {
  id?: string | null;
  basicInfo?: BasicInfo | null;
};

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

export default function BasicInfoForm() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
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
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/data/resume", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`failed to load resume: ${res.status}`);
        }
        const data = (await res.json()) as ResumeResponse;
        if (cancelled) return;

        const id = typeof data.id === "string" && data.id ? data.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }
        if (data.basicInfo) {
          const result = BasicInfoSchema.safeParse(data.basicInfo);
          if (result.success) {
            setForm(formFromBasicInfo(result.data));
            lastSavedSnapshotRef.current = JSON.stringify(result.data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load resume basic info", error);
        }
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
        const json = (await res.json()) as ResumeResponse;
        const id = typeof json.id === "string" && json.id ? json.id : null;
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

  const saveBasicInfo = useCallback(
    async (value: BasicInfo, options: { force?: boolean } = {}) => {
      const snapshot = JSON.stringify(value);
      if (!options.force && snapshot === lastSavedSnapshotRef.current && resumeIdRef.current) {
        return true;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setSaveState("error");
        setSaveError("IDの確保に失敗しました。時間をおいて再度お試しください。");
        return false;
      }

      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ensuredId, basicInfo: value }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to save resume: ${res.status}`);
        }
        const json = (await res.json()) as ResumeResponse;
        const id = typeof json.id === "string" && json.id ? json.id : ensuredId;
        resumeIdRef.current = id;
        setResumeId(id);
        lastSavedSnapshotRef.current = snapshot;
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
        return true;
      } catch (error) {
        console.error("Failed to save basic info", error);
        setSaveState("error");
        setSaveError("保存に失敗しました。時間をおいて再試行してください。");
        return false;
      }
    },
    [ensureResumeId]
  );

  const autoSavePayload = parsed.success ? parsed.data : null;

  useAutoSave(autoSavePayload, async (value) => {
    if (!value) return;
    await saveBasicInfo(value);
  }, 2000, { enabled: Boolean(autoSavePayload) && !isLoading });

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleBlur = useCallback((field: FieldKey) => {
    setFieldTouched(field);
  }, [setFieldTouched]);

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

  const nextDisabled = !parsed.success || isLoading;

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

    const saved = await saveBasicInfo(result.data, { force: true });
    if (saved) {
      router.push("/resume/2");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px" }}>
      <div>
        <h2 className="resume-page-title">基本情報</h2>
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

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={srOnlyStyle}>性別</legend>
          <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}>
            性別 <span style={{ color: "var(--color-required, #FF4500)" }}>*</span>
          </span>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {genderOptions.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "9999px",
                  border: form.gender === option.value ? "2px solid var(--color-primary, #2563eb)" : "1px solid var(--color-border, #cccccc)",
                  backgroundColor:
                    form.gender === option.value ? "rgba(37, 99, 235, 0.1)" : "#ffffff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="gender"
                  value={option.value}
                  checked={form.gender === option.value}
                  onChange={() => handleGenderSelect(option.value)}
                  onBlur={() => handleBlur("gender")}
                  style={{ display: "none" }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {showError("gender") && (
            <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}>
              {getErrorMessage("gender")}
            </p>
          )}
        </fieldset>

        <div>
          <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}>
            生年月日 <span style={{ color: "var(--color-required, #FF4500)" }}>*</span>
          </span>
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <label style={{ flex: 1 }}>
              <span style={srOnlyStyle}>年</span>
              <select
                value={form.dob.year}
                onChange={handleDobChange("year")}
                onBlur={() => handleBlur("dob.year")}
                aria-invalid={showError("dob.year")}
                aria-describedby={showError("dob.year") ? "error-dob-year" : undefined}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: `1px solid ${showError("dob.year") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="" disabled>
                  年を選択
                </option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <span style={srOnlyStyle}>月</span>
              <select
                value={form.dob.month}
                onChange={handleDobChange("month")}
                onBlur={() => handleBlur("dob.month")}
                aria-invalid={showError("dob.month")}
                aria-describedby={showError("dob.month") ? "error-dob-month" : undefined}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: `1px solid ${showError("dob.month") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="" disabled>
                  月を選択
                </option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <span style={srOnlyStyle}>日</span>
              <select
                value={form.dob.day}
                onChange={handleDobChange("day")}
                onBlur={() => handleBlur("dob.day")}
                aria-invalid={showError("dob.day")}
                aria-describedby={showError("dob.day") ? "error-dob-day" : undefined}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: `1px solid ${showError("dob.day") ? "#dc2626" : "var(--color-border, #CCCCCC)"}`,
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="" disabled>
                  日を選択
                </option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(showError("dob.year") || showError("dob.month") || showError("dob.day")) && (
            <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}>
              {errors["dob.year"] || errors["dob.month"] || errors["dob.day"] || errors["dob"]}
            </p>
          )}
        </div>
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
        {saveError && (
          <span style={{ display: "block", marginTop: "4px", color: "#dc2626" }}>{saveError}</span>
        )}
      </div>

      <StepNav step={1} nextType="submit" nextDisabled={nextDisabled} />
    </form>
  );
}
