
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import type { SaveState } from "../_components/hooks/useAutoSave";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import {
  BasicInfoSchema,
  type BasicInfo,
} from "../../../lib/validation/schemas";

const genderOptions: { value: BasicInfo["gender"]; label: string }[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "none", label: "選択しない" },
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
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
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

  const handleGenderChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value as BasicInfo["gender"];
      if (value === "male" || value === "female" || value === "none") {
        setForm((prev) => ({ ...prev, gender: value }));
      }
    },
    []
  );

  return (
    <form style={{ display: "grid", gap: "24px" }} noValidate>
      <div>
        <h2 className="resume-page-title">基本情報</h2>
        <p style={{ color: "var(--color-secondary, #6b7280)", fontSize: "0.875rem" }}>
          氏名と生年月日を入力してください。入力途中でも「次へ」で次に進めます。
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label
            htmlFor="lastName"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}
          >
            姓
          </label>
          <input
            id="lastName"
            name="lastName"
            value={form.lastName}
            onChange={handleInputChange("lastName")}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #CCCCCC)",
              padding: "10px 14px",
              fontSize: "1rem",
            }}
            placeholder="例：山田"
          />
        </div>

        <div>
          <label
            htmlFor="firstName"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}
          >
            名
          </label>
          <input
            id="firstName"
            name="firstName"
            value={form.firstName}
            onChange={handleInputChange("firstName")}
            style={{
              marginTop: "4px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #CCCCCC)",
              padding: "10px 14px",
              fontSize: "1rem",
            }}
            placeholder="例：太郎"
          />
        </div>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={srOnlyStyle}>性別</legend>
          <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}>
            性別
          </span>
          <div
            role="radiogroup"
            aria-label="性別"
            className="gender-options"
          >
            {genderOptions.map((option) => (
              <div key={option.value} className="gender-option">
                <input
                  id={`gender-${option.value}`}
                  type="radio"
                  name="gender"
                  value={option.value}
                  checked={form.gender === option.value}
                  onChange={handleGenderChange}
                  className="gender-option__input"
                />
                <label htmlFor={`gender-${option.value}`} className="gender-option__label">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div>
          <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text, #333333)" }}>
            生年月日
          </span>
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <label style={{ flex: 1 }}>
              <span style={srOnlyStyle}>年</span>
              <select
                value={form.dob.year}
                onChange={handleDobChange("year")}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #CCCCCC)",
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="">年を選択</option>
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
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #CCCCCC)",
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="">月を選択</option>
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
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #CCCCCC)",
                  padding: "10px 12px",
                  fontSize: "1rem",
                }}
              >
                <option value="">日を選択</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          </div>
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

      <div>
        <a href="/resume/2" className="link-button link-button--primary">
          次へ
        </a>
      </div>
    </form>
  );
}
