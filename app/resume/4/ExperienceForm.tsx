"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { z } from "zod";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import type { SaveState } from "../_components/hooks/useAutoSave";
import StepNav from "../_components/StepNav";
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

type ExperienceFieldErrors = Partial<Record<keyof ExperienceItem, string>>;

type ValidationSnapshot = {
  isValid: boolean;
  experienceErrors: ExperienceFieldErrors[];
  listError: string | null;
};

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

function createValidationSnapshot(values: FormValues): ValidationSnapshot {
  const baseErrors: ExperienceFieldErrors[] = values.experiences.map(() => ({}));
  const result = FormSchema.safeParse(values);

  if (result.success) {
    return {
      isValid: true,
      experienceErrors: baseErrors,
      listError: null,
    };
  }

  let listError: string | null = null;
  const experienceErrors = [...baseErrors];

  for (const issue of result.error.issues) {
    if (issue.path[0] !== "experiences") continue;

    if (issue.path.length === 1) {
      listError ??= issue.message;
      continue;
    }

    const index = issue.path[1];
    const field = issue.path[2];

    if (typeof index === "number") {
      while (experienceErrors.length <= index) {
        experienceErrors.push({});
      }

      if (typeof field === "string") {
        const current = experienceErrors[index] ?? {};
        experienceErrors[index] = {
          ...current,
          [field as keyof ExperienceItem]: issue.message,
        };
      }
    }
  }

  return {
    isValid: false,
    experienceErrors,
    listError,
  };
}

export default function ExperienceForm() {
  const router = useRouter();

  const [resumeId, setResumeId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({
    experiences: [{ ...emptyRow }],
    certifications: [],
  });
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const pendingExperiencesRef = useRef<ExperienceItem[] | null>(null);
  const pendingCertificationsRef = useRef<string[] | null>(null);
  const isUnmountingRef = useRef(false);

  const validation = useMemo(
    () => createValidationSnapshot(formValues),
    [formValues]
  );

  const experiences = formValues.experiences;
  const certifications = useMemo(() => {
    return Array.isArray(formValues.certifications)
      ? formValues.certifications
      : [];
  }, [formValues.certifications]);
  const experienceErrors = validation.experienceErrors;
  const listError = experienceTouched ? validation.listError : null;

  useLayoutEffect(() => {
    return () => {
      isUnmountingRef.current = true;
    };
  }, []);

  useEffect(() => {
    return () => {
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
      if (!isUnmountingRef.current) {
        setExperienceSaveState("saving");
      }
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
        if (!isUnmountingRef.current) {
          setExperienceSaveState("saved");
          experienceIdleRef.current = setTimeout(() => {
            if (isUnmountingRef.current) {
              experienceIdleRef.current = null;
              return;
            }
            setExperienceSaveState("idle");
            experienceIdleRef.current = null;
          }, 1500);
        }
      } catch (error) {
        console.error("Failed to save experiences", error);
        if (!isUnmountingRef.current) {
          setExperienceSaveState("error");
        }
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
      if (!isUnmountingRef.current) {
        setCertificationSaveState("saving");
      }
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
        if (!isUnmountingRef.current) {
          setCertificationSaveState("saved");
          certificationIdleRef.current = setTimeout(() => {
            if (isUnmountingRef.current) {
              certificationIdleRef.current = null;
              return;
            }
            setCertificationSaveState("idle");
            certificationIdleRef.current = null;
          }, 1500);
        }
      } catch (error) {
        console.error("Failed to save certifications", error);
        if (!isUnmountingRef.current) {
          setCertificationSaveState("error");
        }
      }
    },
    [resumeId]
  );

  const handleLoad = useCallback(async (id: string) => {
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

      setFormValues({
        experiences: experienceItems,
        certifications: certificationValues,
      });

      lastSavedExperiencesRef.current = JSON.stringify(experienceItems);
      lastSavedCertificationsRef.current = JSON.stringify(certificationValues);
      setExperienceTouched(false);
      setCertificationTouched(false);
      setExperienceSaveState("idle");
      setCertificationSaveState("idle");
      setHasLoaded(true);
    } catch (error) {
      console.error("Failed to load experience step", error);
      setLoadError(
        "データの取得に失敗しました。時間をおいて再度お試しください。"
      );
      setFormValues({ experiences: [{ ...emptyRow }], certifications: [] });
      setCertificationOptions([]);
      lastSavedExperiencesRef.current = "";
      lastSavedCertificationsRef.current = "";
      setExperienceTouched(false);
      setCertificationTouched(false);
      setExperienceSaveState("idle");
      setCertificationSaveState("idle");
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!resumeId) return;
    void handleLoad(resumeId);
  }, [resumeId, handleLoad]);
  useEffect(() => {
    if (!resumeId || !hasLoaded || !experienceTouched) return;
    const parsed = ExperienceListSchema.safeParse(experiences);
    if (!parsed.success) return;

    const nextJson = JSON.stringify(parsed.data);
    if (nextJson === lastSavedExperiencesRef.current) return;

    const payload = parsed.data;
    pendingExperiencesRef.current = payload;
    if (experienceDebounceRef.current) {
      clearTimeout(experienceDebounceRef.current);
    }
    experienceDebounceRef.current = setTimeout(() => {
      pendingExperiencesRef.current = null;
      experienceDebounceRef.current = null;
      void saveExperiences(payload);
    }, 800);

    return () => {
      if (experienceDebounceRef.current) {
        clearTimeout(experienceDebounceRef.current);
        experienceDebounceRef.current = null;
        if (isUnmountingRef.current && pendingExperiencesRef.current) {
          const pending = pendingExperiencesRef.current;
          pendingExperiencesRef.current = null;
          void saveExperiences(pending);
        }
      }
    };
  }, [
    resumeId,
    hasLoaded,
    experienceTouched,
    experiences,
    saveExperiences,
  ]);

  useEffect(() => {
    if (!resumeId || !hasLoaded || !certificationTouched) return;
    const values = certifications;
    const nextJson = JSON.stringify(values);
    if (nextJson === lastSavedCertificationsRef.current) return;

    pendingCertificationsRef.current = values;
    if (certificationDebounceRef.current) {
      clearTimeout(certificationDebounceRef.current);
    }
    certificationDebounceRef.current = setTimeout(() => {
      pendingCertificationsRef.current = null;
      certificationDebounceRef.current = null;
      void saveCertifications(values);
    }, 600);

    return () => {
      if (certificationDebounceRef.current) {
        clearTimeout(certificationDebounceRef.current);
        certificationDebounceRef.current = null;
        if (isUnmountingRef.current && pendingCertificationsRef.current) {
          const pending = pendingCertificationsRef.current;
          pendingCertificationsRef.current = null;
          void saveCertifications(pending);
        }
      }
    };
  }, [
    resumeId,
    hasLoaded,
    certificationTouched,
    certifications,
    saveCertifications,
  ]);

  const handleExperienceFieldChange = useCallback(
    <K extends keyof ExperienceItem>(
      index: number,
      key: K,
      value: ExperienceItem[K]
    ) => {
      setExperienceTouched(true);
      setFormValues((prev) => {
        const next = prev.experiences.map((item, idx) => {
          if (idx !== index) return item;
          return { ...item, [key]: value };
        });
        return { ...prev, experiences: next };
      });
    },
    []
  );

  const handlePresentToggle = useCallback(
    (index: number, checked: boolean) => {
      setExperienceTouched(true);
      setFormValues((prev) => {
        const next = prev.experiences.map((item, idx) => {
          if (idx !== index) return item;
          return {
            ...item,
            present: checked,
            end: checked ? "" : item.end ?? "",
          };
        });
        return { ...prev, experiences: next };
      });
    },
    []
  );

  const handleAddRow = () => {
    setExperienceTouched(true);
    setFormValues((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { ...emptyRow }],
    }));
  };

  const handleRemoveRow = (index: number) => {
    setExperienceTouched(true);
    setFormValues((prev) => {
      const next = prev.experiences.filter((_, idx) => idx !== index);
      return {
        ...prev,
        experiences: next.length > 0 ? next : [{ ...emptyRow }],
      };
    });
  };

  const handleCertificationChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const selected = Array.from(event.target.selectedOptions).map(
      (option) => option.value
    );
    setCertificationTouched(true);
    setFormValues((prev) => ({
      ...prev,
      certifications: selected,
    }));
  };

  const handleRemoveCertification = (value: string) => {
    setCertificationTouched(true);
    setFormValues((prev) => {
      const current = Array.isArray(prev.certifications)
        ? prev.certifications
        : [];
      const next = current.filter((item) => item !== value);
      return { ...prev, certifications: next };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExperienceTouched(true);
    setCertificationTouched(true);
    const parsed = FormSchema.safeParse({
      experiences,
      certifications,
    });

    if (!parsed.success) {
      return;
    }

    if (!resumeId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await saveExperiences(parsed.data.experiences);
      router.push("/resume/5");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNextDisabled = !validation.isValid || isSubmitting;
  const loadErrorId = loadError ? "experience-load-error" : undefined;
  const listErrorId = listError ? "experience-list-error" : undefined;
  const formDescriptionIds = [loadErrorId, listErrorId]
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;
  return (
    <form
      onSubmit={handleSubmit}
      className="resume-form"
      aria-describedby={formDescriptionIds}
      noValidate
    >
      <header className="resume-form__header">
        <h2 className="resume-page-title">職歴</h2>
        <p className="resume-form__description">
          これまでの職歴を入力してください。現在の職務に在籍中の場合は「在籍中」にチェックを入れてください。
        </p>
        {loadError && (
          <p
            id={loadErrorId}
            role="alert"
            className="resume-form__message resume-form__message--error"
          >
            {loadError}
          </p>
        )}
      </header>

      {listError && (
        <p
          id={listErrorId}
          role="alert"
          className="resume-form__message resume-form__message--error"
        >
          {listError}
        </p>
      )}

      <div className="resume-form__section">
        {experiences.map((row, index) => {
          const fieldId = `experience-${index}`;
          const present = Boolean(row.present);
          const fieldErrors = experienceTouched
            ? experienceErrors[index] ?? {}
            : {};

          const companyNameError = fieldErrors.companyName;
          const jobTitleError = fieldErrors.jobTitle;
          const startError = fieldErrors.start;
          const endError = fieldErrors.end;

          const companyInputClass = `resume-form__input${
            companyNameError ? " resume-form__control--error" : ""
          }`;
          const jobTitleInputClass = `resume-form__input${
            jobTitleError ? " resume-form__control--error" : ""
          }`;
          const startInputClass = `resume-form__input${
            startError ? " resume-form__control--error" : ""
          }`;
          const endInputClass = `resume-form__input${
            endError ? " resume-form__control--error" : ""
          }`;

          return (
            <fieldset key={fieldId} className="resume-form__fieldset">
              <legend className="resume-form__legend">職歴 {index + 1}</legend>

              <div className="resume-form__field-grid">
                <div className="resume-form__field">
                  <label htmlFor={`${fieldId}-company`} className="resume-form__label">
                    企業名 <span className="resume-form__required">*</span>
                  </label>
                  <input
                    id={`${fieldId}-company`}
                    type="text"
                    value={row.companyName ?? ""}
                    onChange={(event) =>
                      handleExperienceFieldChange(
                        index,
                        "companyName",
                        event.target.value
                      )
                    }
                    onBlur={() => setExperienceTouched(true)}
                    required
                    className={companyInputClass}
                    aria-invalid={Boolean(companyNameError)}
                    aria-describedby={
                      companyNameError ? `${fieldId}-company-error` : undefined
                    }
                  />
                  {companyNameError && (
                    <p
                      id={`${fieldId}-company-error`}
                      role="alert"
                      className="resume-form__message resume-form__message--error"
                    >
                      {companyNameError}
                    </p>
                  )}
                </div>

                <div className="resume-form__field">
                  <label htmlFor={`${fieldId}-title`} className="resume-form__label">
                    職種 / 役職 <span className="resume-form__required">*</span>
                  </label>
                  <input
                    id={`${fieldId}-title`}
                    type="text"
                    value={row.jobTitle ?? ""}
                    onChange={(event) =>
                      handleExperienceFieldChange(
                        index,
                        "jobTitle",
                        event.target.value
                      )
                    }
                    onBlur={() => setExperienceTouched(true)}
                    required
                    className={jobTitleInputClass}
                    aria-invalid={Boolean(jobTitleError)}
                    aria-describedby={
                      jobTitleError ? `${fieldId}-title-error` : undefined
                    }
                  />
                  {jobTitleError && (
                    <p
                      id={`${fieldId}-title-error`}
                      role="alert"
                      className="resume-form__message resume-form__message--error"
                    >
                      {jobTitleError}
                    </p>
                  )}
                </div>

                <div className="resume-form__field">
                  <label htmlFor={`${fieldId}-start`} className="resume-form__label">
                    開始年月 <span className="resume-form__required">*</span>
                  </label>
                  <input
                    id={`${fieldId}-start`}
                    type="month"
                    value={row.start ?? ""}
                    onChange={(event) =>
                      handleExperienceFieldChange(
                        index,
                        "start",
                        event.target.value
                      )
                    }
                    onBlur={() => setExperienceTouched(true)}
                    required
                    className={startInputClass}
                    aria-invalid={Boolean(startError)}
                    aria-describedby={startError ? `${fieldId}-start-error` : undefined}
                  />
                  {startError && (
                    <p
                      id={`${fieldId}-start-error`}
                      role="alert"
                      className="resume-form__message resume-form__message--error"
                    >
                      {startError}
                    </p>
                  )}
                </div>

                <div className="resume-form__field">
                  <label htmlFor={`${fieldId}-end`} className="resume-form__label">
                    終了年月
                  </label>
                  <input
                    id={`${fieldId}-end`}
                    type="month"
                    value={row.end ?? ""}
                    onChange={(event) =>
                      handleExperienceFieldChange(
                        index,
                        "end",
                        event.target.value
                      )
                    }
                    onBlur={() => setExperienceTouched(true)}
                    disabled={present}
                    className={endInputClass}
                    aria-invalid={Boolean(endError)}
                    aria-describedby={endError ? `${fieldId}-end-error` : undefined}
                  />
                  {endError && (
                    <p
                      id={`${fieldId}-end-error`}
                      role="alert"
                      className="resume-form__message resume-form__message--error"
                    >
                      {endError}
                    </p>
                  )}
                </div>
              </div>

              <div className="resume-form__checkbox-row">
                <input
                  id={`${fieldId}-present`}
                  type="checkbox"
                  checked={present}
                  onChange={(event) =>
                    handlePresentToggle(index, event.target.checked)
                  }
                  onBlur={() => setExperienceTouched(true)}
                />
                <label htmlFor={`${fieldId}-present`}>在籍中</label>
              </div>

              <div className="resume-form__field">
                <label htmlFor={`${fieldId}-description`} className="resume-form__label">
                  業務内容（任意）
                </label>
                <textarea
                  id={`${fieldId}-description`}
                  value={row.description ?? ""}
                  onChange={(event) =>
                    handleExperienceFieldChange(
                      index,
                      "description",
                      event.target.value
                    )
                  }
                  onBlur={() => setExperienceTouched(true)}
                  rows={4}
                  className="resume-form__textarea"
                />
              </div>

              <div className="resume-form__actions">
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  className="resume-form__link-button"
                  aria-label={`職歴 ${index + 1} を削除`}
                >
                  職歴を削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div>
        <button type="button" onClick={handleAddRow} className="resume-form__add-button">
          ＋ 職歴を追加
        </button>
      </div>

      <AutoSaveBadge state={experienceSaveState} />

      <section className="resume-form__section">
        <h3 className="resume-form__subtitle">資格</h3>
        <p className="resume-form__helper">
          取得済みの資格を選択してください。複数選択できます。
        </p>

        <div className="resume-form__section">
          <label htmlFor="resume-certifications" className="resume-form__label">
            資格一覧
          </label>
          <select
            id="resume-certifications"
            multiple
            value={certifications}
            onChange={handleCertificationChange}
            onBlur={() => setCertificationTouched(true)}
            className="resume-form__select resume-form__select--multi"
          >
            {certificationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {Array.isArray(certifications) && certifications.length > 0 && (
            <div className="resume-form__chip-list">
              {certifications.map((value) => {
                const option = certificationOptions.find(
                  (item) => item.value === value
                );
                const label = option?.label ?? value;
                return (
                  <span key={value} className="resume-form__chip">
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveCertification(value)}
                      aria-label={`${label} を削除`}
                      className="resume-form__chip-remove"
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

      <StepNav step={4} nextType="submit" nextDisabled={isNextDisabled} />
    </form>
  );
}
