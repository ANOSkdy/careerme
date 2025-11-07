"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import {
  ExperienceListSchema,
  ResumeSchema,
  type ExperienceItem,
} from "../../../lib/validation/schemas";

const STORAGE_KEY = "resume.resumeId";

const emptyRow: ExperienceItem = {
  companyName: "",
  jobTitle: "",
  start: "",
  end: "",
  present: false,
  description: "",
};

const FormSchema = z.object({
  experiences: ExperienceListSchema,
  certifications: ResumeSchema.shape.certifications.default([]),
});

type FormValues = z.infer<typeof FormSchema>;

type ExperienceResponse = {
  items?: unknown;
};

type ResumeResponse = {
  certifications?: unknown;
};

type LookupResponse = {
  options?: Array<{ value: string; label: string }>;
};

type CertificationOption = { value: string; label: string };

function toExperienceRow(raw: unknown): ExperienceItem {
  if (!raw || typeof raw !== "object") return { ...emptyRow };
  const source = raw as Record<string, unknown>;
  const present = Boolean(source.present ?? source.current);
  const endValue = present
    ? ""
    : typeof source.end === "string"
      ? source.end
      : "";

  return {
    companyName:
      typeof source.companyName === "string" ? source.companyName : "",
    jobTitle: typeof source.jobTitle === "string" ? source.jobTitle : "",
    start: typeof source.start === "string" ? source.start : "",
    end: endValue,
    present,
    description:
      typeof source.description === "string" ? source.description : "",
  };
}

function normalizeExperienceItems(raw: unknown): ExperienceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => toExperienceRow(item));
}

function parseCertifications(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}

function getListError(errors: unknown): string | null {
  if (!errors || Array.isArray(errors)) return null;
  const record = errors as { root?: { message?: string } };
  return record.root?.message ?? null;
}

export default function ExperienceForm() {
  const router = useRouter();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [certificationOptions, setCertificationOptions] = useState<
    CertificationOption[]
  >([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [experienceTouched, setExperienceTouched] = useState(false);
  const [certificationTouched, setCertificationTouched] = useState(false);
  const [experienceSaveState, setExperienceSaveState] =
    useState<SaveState>("idle");
  const [certificationSaveState, setCertificationSaveState] =
    useState<SaveState>("idle");

  const experienceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const certificationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const experienceIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const certificationIdleRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastSavedExperiencesRef = useRef<string>("");
  const lastSavedCertificationsRef = useRef<string>("");

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      experiences: [{ ...emptyRow }],
      certifications: [],
    },
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors, isValid, isSubmitting },
  } = methods;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "experiences",
  });

  const experiencesWatch = useWatch({ control, name: "experiences" });
  const certificationsWatch = useWatch({ control, name: "certifications" });

  const listError = useMemo(
    () => getListError(errors.experiences),
    [errors.experiences]
  );

  useEffect(() => {
    return () => {
      if (experienceDebounceRef.current) {
        clearTimeout(experienceDebounceRef.current);
      }
      if (certificationDebounceRef.current) {
        clearTimeout(certificationDebounceRef.current);
      }
      if (experienceIdleRef.current) {
        clearTimeout(experienceIdleRef.current);
      }
      if (certificationIdleRef.current) {
        clearTimeout(certificationIdleRef.current);
      }
    };
  }, []);

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

  const saveExperiences = useCallback(
    async (items: ExperienceItem[]) => {
      if (!resumeId) return;
      if (experienceIdleRef.current) {
        clearTimeout(experienceIdleRef.current);
        experienceIdleRef.current = null;
      }
      setExperienceSaveState("saving");
      try {
        const res = await fetch("/api/data/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId, items }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save experiences (${res.status})`);
        }
        lastSavedExperiencesRef.current = JSON.stringify(items);
        setExperienceSaveState("saved");
        experienceIdleRef.current = setTimeout(() => {
          setExperienceSaveState("idle");
          experienceIdleRef.current = null;
        }, 1500);
      } catch (error) {
        console.error("Failed to save experiences", error);
        setExperienceSaveState("error");
      }
    },
    [resumeId]
  );

  const saveCertifications = useCallback(
    async (values: string[]) => {
      if (!resumeId) return;
      if (certificationIdleRef.current) {
        clearTimeout(certificationIdleRef.current);
        certificationIdleRef.current = null;
      }
      setCertificationSaveState("saving");
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: resumeId, certifications: values }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save certifications (${res.status})`);
        }
        lastSavedCertificationsRef.current = JSON.stringify(values);
        setCertificationSaveState("saved");
        certificationIdleRef.current = setTimeout(() => {
          setCertificationSaveState("idle");
          certificationIdleRef.current = null;
        }, 1500);
      } catch (error) {
        console.error("Failed to save certifications", error);
        setCertificationSaveState("error");
      }
    },
    [resumeId]
  );

  const handleLoad = useCallback(
    async (id: string) => {
      setLoadError(null);
      setHasLoaded(false);
      try {
        const [experienceRes, resumeRes, lookupRes] = await Promise.all([
          fetch(`/api/data/experience?resumeId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/data/resume?draftId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/data/lookups?type=certifications`, {
            cache: "force-cache",
          }),
        ]);

        if (!experienceRes.ok) {
          throw new Error(`failed to load experiences (${experienceRes.status})`);
        }
        const experienceJson = (await experienceRes.json()) as ExperienceResponse;
        const normalizedItems = normalizeExperienceItems(experienceJson.items);
        const experienceItems =
          normalizedItems.length > 0 ? normalizedItems : [{ ...emptyRow }];

        if (!resumeRes.ok) {
          throw new Error(`failed to load resume (${resumeRes.status})`);
        }
        const resumeJson = (await resumeRes.json()) as ResumeResponse;
        const certificationValues = parseCertifications(
          resumeJson.certifications
        );

        if (!lookupRes.ok) {
          throw new Error(`failed to load lookups (${lookupRes.status})`);
        }
        const lookupJson = (await lookupRes.json()) as LookupResponse;
        setCertificationOptions(lookupJson.options ?? []);

        reset({
          experiences: experienceItems,
          certifications: certificationValues,
        });
        replace(experienceItems);
        setValue("certifications", certificationValues, {
          shouldValidate: true,
          shouldDirty: false,
        });

        lastSavedExperiencesRef.current = JSON.stringify(experienceItems);
        lastSavedCertificationsRef.current = JSON.stringify(certificationValues);
        setExperienceTouched(false);
        setCertificationTouched(false);
        setHasLoaded(true);
      } catch (error) {
        console.error("Failed to load experience step", error);
        setLoadError(
          "データの取得に失敗しました。時間をおいて再度お試しください。"
        );
        reset({ experiences: [{ ...emptyRow }], certifications: [] });
        replace([{ ...emptyRow }]);
        setCertificationOptions([]);
        lastSavedExperiencesRef.current = "";
        lastSavedCertificationsRef.current = "";
        setExperienceTouched(false);
        setCertificationTouched(false);
        setHasLoaded(true);
      }
    },
    [replace, reset, setValue]
  );

  useEffect(() => {
    if (!resumeId) return;
    void handleLoad(resumeId);
  }, [resumeId, handleLoad]);

  useEffect(() => {
    if (!resumeId || !hasLoaded || !experienceTouched) return;
    const parsed = ExperienceListSchema.safeParse(experiencesWatch);
    if (!parsed.success) return;

    const nextJson = JSON.stringify(parsed.data);
    if (nextJson === lastSavedExperiencesRef.current) return;

    if (experienceDebounceRef.current) {
      clearTimeout(experienceDebounceRef.current);
    }
    experienceDebounceRef.current = setTimeout(() => {
      void saveExperiences(parsed.data);
      experienceDebounceRef.current = null;
    }, 800);

    return () => {
      if (experienceDebounceRef.current) {
        clearTimeout(experienceDebounceRef.current);
        experienceDebounceRef.current = null;
      }
    };
  }, [
    experiencesWatch,
    experienceTouched,
    hasLoaded,
    resumeId,
    saveExperiences,
  ]);

  useEffect(() => {
    if (!resumeId || !hasLoaded || !certificationTouched) return;
    const values = Array.isArray(certificationsWatch)
      ? certificationsWatch.filter((value): value is string => typeof value === "string")
      : [];

    const nextJson = JSON.stringify(values);
    if (nextJson === lastSavedCertificationsRef.current) return;

    if (certificationDebounceRef.current) {
      clearTimeout(certificationDebounceRef.current);
    }
    certificationDebounceRef.current = setTimeout(() => {
      void saveCertifications(values);
      certificationDebounceRef.current = null;
    }, 600);

    return () => {
      if (certificationDebounceRef.current) {
        clearTimeout(certificationDebounceRef.current);
        certificationDebounceRef.current = null;
      }
    };
  }, [
    certificationsWatch,
    certificationTouched,
    hasLoaded,
    resumeId,
    saveCertifications,
  ]);

  const handleAddRow = () => {
    append({ ...emptyRow });
    setExperienceTouched(true);
    void trigger("experiences");
  };

  const handleRemoveRow = (index: number) => {
    if (fields.length <= 1) {
      replace([{ ...emptyRow }]);
    } else {
      remove(index);
    }
    setExperienceTouched(true);
    void trigger("experiences");
  };

  const handleRemoveCertification = (value: string) => {
    const current = Array.isArray(certificationsWatch)
      ? certificationsWatch
      : [];
    const next = current.filter((item) => item !== value);
    setValue("certifications", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setCertificationTouched(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!resumeId) return;
    await saveExperiences(data.experiences);
    router.push("/resume/5");
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2
        style={{
          marginBottom: "12px",
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "var(--color-heading, #111827)",
        }}
      >
        職歴
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "16px" }}>
        会社名・職種・開始年月は必須です。終了年月は在籍中の場合は空欄のままにしてください。
      </p>

      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #fca5a5",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          {loadError}
        </div>
      )}

      {listError && (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #fcd34d",
            backgroundColor: "#fffbeb",
            color: "#92400e",
            fontSize: "0.875rem",
          }}
        >
          {listError}
        </div>
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        {fields.map((field, index) => {
          const fieldId = `experience-${field.id}`;
          const watchedRow = Array.isArray(experiencesWatch)
            ? experiencesWatch[index]
            : undefined;
          const present = Boolean(watchedRow?.present);
          const fieldErrors = Array.isArray(errors.experiences)
            ? ((errors.experiences[index] ?? {}) as Partial<
                Record<keyof ExperienceItem, { message?: string }>
              >)
            : undefined;

          const companyNameError = fieldErrors?.companyName?.message;
          const jobTitleError = fieldErrors?.jobTitle?.message;
          const startError = fieldErrors?.start?.message;
          const endError = fieldErrors?.end?.message;

          const commonRegisterOptions = {
            onBlur: () => {
              setExperienceTouched(true);
              void trigger("experiences");
            },
            onChange: () => {
              setExperienceTouched(true);
            },
          } as const;

          const companyField = register(
            `experiences.${index}.companyName`,
            commonRegisterOptions
          );
          const jobField = register(
            `experiences.${index}.jobTitle`,
            commonRegisterOptions
          );
          const startField = register(
            `experiences.${index}.start`,
            commonRegisterOptions
          );
          const endField = register(`experiences.${index}.end`, {
            ...commonRegisterOptions,
          });
          const descriptionField = register(
            `experiences.${index}.description`,
            commonRegisterOptions
          );
          const presentField = register(`experiences.${index}.present`, {
            onBlur: () => {
              setExperienceTouched(true);
              void trigger("experiences");
            },
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              const checked = event.target.checked;
              setExperienceTouched(true);
              if (checked) {
                setValue(`experiences.${index}.end`, "", {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
              void trigger("experiences");
            },
          });

          return (
            <fieldset
              key={field.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              <legend style={{ fontSize: "1rem", fontWeight: 600 }}>
                職歴 {index + 1}
              </legend>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div>
                  <label
                    htmlFor={`${fieldId}-company`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    企業名 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-company`}
                    type="text"
                    {...companyField}
                    value={watchedRow?.companyName ?? ""}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(companyNameError)}
                    aria-describedby={
                      companyNameError ? `${fieldId}-company-error` : undefined
                    }
                  />
                  {companyNameError && (
                    <p
                      id={`${fieldId}-company-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {companyNameError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-title`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    職種 / 役職 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-title`}
                    type="text"
                    {...jobField}
                    value={watchedRow?.jobTitle ?? ""}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(jobTitleError)}
                    aria-describedby={
                      jobTitleError ? `${fieldId}-title-error` : undefined
                    }
                  />
                  {jobTitleError && (
                    <p
                      id={`${fieldId}-title-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {jobTitleError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-start`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    開始年月 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${fieldId}-start`}
                    type="month"
                    {...startField}
                    value={watchedRow?.start ?? ""}
                    required
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                    }}
                    aria-invalid={Boolean(startError)}
                    aria-describedby={startError ? `${fieldId}-start-error` : undefined}
                  />
                  {startError && (
                    <p
                      id={`${fieldId}-start-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {startError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${fieldId}-end`}
                    style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                  >
                    終了年月
                  </label>
                  <input
                    id={`${fieldId}-end`}
                    type="month"
                    {...endField}
                    value={watchedRow?.end ?? ""}
                    disabled={present}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "0.875rem",
                      backgroundColor: present ? "#f3f4f6" : "#ffffff",
                      cursor: present ? "not-allowed" : "text",
                    }}
                    aria-invalid={Boolean(endError)}
                    aria-describedby={endError ? `${fieldId}-end-error` : undefined}
                  />
                  {endError && (
                    <p
                      id={`${fieldId}-end-error`}
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {endError}
                    </p>
                  )}
                </div>

                <div style={{ alignSelf: "end" }}>
                  <label
                    htmlFor={`${fieldId}-present`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    <input
                      id={`${fieldId}-present`}
                      type="checkbox"
                      {...presentField}
                      checked={present}
                    />
                    在籍中
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-description`}
                  style={{ display: "block", fontSize: "0.875rem", fontWeight: 600 }}
                >
                  業務内容（任意）
                </label>
                <textarea
                  id={`${fieldId}-description`}
                  {...descriptionField}
                  value={watchedRow?.description ?? ""}
                  rows={4}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "8px 12px",
                    fontSize: "0.875rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
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
                  職歴を削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={handleAddRow}
          style={{
            appearance: "none",
            border: "1px solid var(--color-primary, #2563eb)",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#ffffff",
            padding: "8px 20px",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          職歴の追加
        </button>
      </div>

      <AutoSaveBadge state={experienceSaveState} />

      <section style={{ marginTop: "32px" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "12px" }}>
          資格
        </h3>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "12px" }}>
          取得済みの資格を選択してください。複数選択できます。
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label
            htmlFor="resume-certifications"
            style={{ fontSize: "0.875rem", fontWeight: 600 }}
          >
            資格一覧
          </label>
          <Controller
            control={control}
            name="certifications"
            render={({ field }) => (
              <select
                id="resume-certifications"
                multiple
                value={field.value ?? []}
                onChange={(event) => {
                  const selected = Array.from(event.target.selectedOptions).map(
                    (option) => option.value
                  );
                  field.onChange(selected);
                  setCertificationTouched(true);
                }}
                onBlur={() => {
                  field.onBlur();
                  setCertificationTouched(true);
                }}
                style={{
                  minHeight: "160px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  padding: "8px",
                  fontSize: "0.875rem",
                }}
              >
                {certificationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          />

          {Array.isArray(certificationsWatch) && certificationsWatch.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {certificationsWatch.map((value) => {
                const option = certificationOptions.find(
                  (item) => item.value === value
                );
                const label = option?.label ?? value;
                return (
                  <span
                    key={value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "9999px",
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: "0.75rem",
                    }}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveCertification(value)}
                      aria-label={`${label} を削除`}
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "0.75rem",
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <AutoSaveBadge state={certificationSaveState} />
      </section>

      <StepNav step={4} nextDisabled={!isValid || isSubmitting} />
    </form>
  );
}
