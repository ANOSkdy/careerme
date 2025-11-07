"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import AutoSaveBadge from "../_components/AutoSaveBadge";
import type { SaveState } from "../_components/hooks/useAutoSave";
import {
  EducationItemSchema,
  EducationListSchema,
  ResumeStatusSchema,
} from "../../../lib/validation/schemas";
import { z } from "zod";

const STORAGE_KEY = "resume.resumeId";

const finalEducationOptions = [
  "院卒",
  "大卒",
  "短大",
  "専門",
  "高専",
  "高卒",
  "その他",
] as const;

type FinalEducation = (typeof finalEducationOptions)[number];

type EducationItem = {
  schoolName: string;
  faculty: string;
  start: string;
  end: string;
  present: boolean;
};

type RowErrors = Record<number, Partial<Record<keyof EducationItem, string>>>;

type EducationResponse = {
  items?: Array<{
    schoolName?: string;
    school?: string;
    faculty?: string;
    degree?: string;
    start?: string;
    end?: string;
    present?: boolean;
    current?: boolean;
  }>;
};

type ResumeStep2Response = {
  step2?: {
    status?: string;
    note?: string;
  } | null;
};

type ResumeStatusSnapshot = {
  eduStatus?: z.infer<typeof ResumeStatusSchema>["eduStatus"];
  joinTiming?: z.infer<typeof ResumeStatusSchema>["joinTiming"];
  jobChangeCount?: z.infer<typeof ResumeStatusSchema>["jobChangeCount"];
  finalEducation?: FinalEducation;
  version?: string;
};

const defaultItem: EducationItem = {
  schoolName: "",
  faculty: "",
  start: "",
  end: "",
  present: false,
};

function normalizeEducationItem(raw: unknown): EducationItem {
  if (!raw || typeof raw !== "object") return { ...defaultItem };
  const candidate = raw as Record<string, unknown>;
  const present = Boolean(
    typeof candidate.present === "boolean" ? candidate.present : candidate.current
  );
  const end = present
    ? ""
    : typeof candidate.end === "string"
      ? candidate.end
      : "";

  return {
    schoolName:
      typeof candidate.schoolName === "string" && candidate.schoolName.trim()
        ? candidate.schoolName
        : typeof candidate.school === "string"
          ? candidate.school
          : "",
    faculty:
      typeof candidate.faculty === "string"
        ? candidate.faculty
        : typeof candidate.degree === "string"
          ? candidate.degree
          : "",
    start: typeof candidate.start === "string" ? candidate.start : "",
    end,
    present,
  };
}

function parseResumeStatusNote(note: unknown): ResumeStatusSnapshot | null {
  if (typeof note !== "string" || !note) return null;
  try {
    const parsed = JSON.parse(note);
    if (!parsed || typeof parsed !== "object") return null;

    const snapshot: ResumeStatusSnapshot = {};
    const data = parsed as Record<string, unknown>;
    if (typeof data.eduStatus === "string") {
      snapshot.eduStatus = data.eduStatus as ResumeStatusSnapshot["eduStatus"];
    }
    if (typeof data.joinTiming === "string") {
      snapshot.joinTiming = data.joinTiming as ResumeStatusSnapshot["joinTiming"];
    }
    if (typeof data.jobChangeCount === "string") {
      snapshot.jobChangeCount = data.jobChangeCount as ResumeStatusSnapshot["jobChangeCount"];
    }
    if (typeof data.version === "string") {
      snapshot.version = data.version;
    }
    if (typeof data.finalEducation === "string") {
      if (finalEducationOptions.includes(data.finalEducation as FinalEducation)) {
        snapshot.finalEducation = data.finalEducation as FinalEducation;
      }
    }
    return snapshot;
  } catch (error) {
    console.warn("Failed to parse resume status note", error);
    return null;
  }
}

function createNotePayload(
  snapshot: ResumeStatusSnapshot | null,
  finalEducation: FinalEducation
) {
  const base: Record<string, unknown> = {};
  if (snapshot?.eduStatus) base.eduStatus = snapshot.eduStatus;
  if (snapshot?.joinTiming) base.joinTiming = snapshot.joinTiming;
  if (snapshot?.jobChangeCount) base.jobChangeCount = snapshot.jobChangeCount;
  base.finalEducation = finalEducation;
  base.version = snapshot?.version ?? "resume-status/v2";
  return base;
}

export default function EducationForm() {
  const router = useRouter();
  const [items, setItems] = useState<EducationItem[]>([defaultItem]);
  const itemsRef = useRef<EducationItem[]>([defaultItem]);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [listError, setListError] = useState<string | null>(null);
  const [finalEducation, setFinalEducation] = useState<FinalEducation | "">("");
  const [focusedFinalEducation, setFocusedFinalEducation] = useState<FinalEducation | null>(
    null
  );
  const [finalTouched, setFinalTouched] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const resumeStatusRef = useRef<ResumeStatusSnapshot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      resumeIdRef.current = stored;
      setResumeId(stored);
      return;
    }
    const generated =
      window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_KEY, generated);
    resumeIdRef.current = generated;
    setResumeId(generated);
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!resumeId) return;

    let cancelled = false;
    const controller = new AbortController();
    setIsHydrating(true);
    setLoadError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ resumeId });
        const resumeParams = new URLSearchParams({ id: resumeId, draftId: resumeId });

        const [educationRes, resumeRes] = await Promise.all([
          fetch(`/api/data/education?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/data/resume?${resumeParams.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!educationRes.ok) {
          throw new Error(`failed to fetch education: ${educationRes.status}`);
        }
        if (!resumeRes.ok) {
          throw new Error(`failed to fetch resume: ${resumeRes.status}`);
        }

        const educationJson = (await educationRes.json()) as EducationResponse;
        const resumeJson = (await resumeRes.json()) as ResumeStep2Response;

        if (cancelled) return;

        const normalizedItems = Array.isArray(educationJson?.items)
          ? educationJson.items.map((item) => normalizeEducationItem(item))
          : [];

        const nextItems = normalizedItems.length ? normalizedItems : [defaultItem];
        itemsRef.current = nextItems;
        setItems(nextItems);

        const snapshot = parseResumeStatusNote(resumeJson?.step2?.note ?? null);
        resumeStatusRef.current = snapshot;
        setFinalEducation(snapshot?.finalEducation ?? "");
        setFocusedFinalEducation(null);
        setFinalTouched(false);
        setSubmitError(null);
        setSaveState("idle");
        setIsHydrating(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load education data", error);
        if (!cancelled) {
          setLoadError("学歴情報の取得に失敗しました");
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [resumeId]);

  useEffect(() => {
    const nextErrors: RowErrors = {};
    items.forEach((item, index) => {
      const parsed = EducationItemSchema.safeParse(item);
      if (!parsed.success) {
        nextErrors[index] = {};
        parsed.error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (typeof key === "string") {
            nextErrors[index]![key as keyof EducationItem] = issue.message;
          }
        });
      }
    });
    setRowErrors(nextErrors);

    const listResult = EducationListSchema.safeParse(items);
    if (!listResult.success) {
      const issue = listResult.error.issues[0];
      setListError(issue?.message ?? "入力内容に不備があります");
    } else {
      setListError(null);
    }
  }, [items]);

  const ensureResumeId = useCallback(() => {
    if (resumeIdRef.current) return resumeIdRef.current;
    if (typeof window === "undefined") return null;
    const generated = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    window.localStorage.setItem(STORAGE_KEY, generated);
    resumeIdRef.current = generated;
    setResumeId(generated);
    return generated;
  }, []);

  const persistEducation = useCallback(
    async (override?: EducationItem[]): Promise<boolean> => {
      const id = ensureResumeId();
      if (!id) return false;
      const target = override ?? itemsRef.current;
      const parsed = EducationListSchema.safeParse(target);
      if (!parsed.success) return false;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setSaveState("saving");
      try {
        const payload = target.map((item) => ({
          ...item,
          faculty: item.faculty ?? "",
          end: item.present ? "" : item.end ?? "",
        }));
        const res = await fetch("/api/data/education", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId: id, items: payload }),
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save education: ${res.status}`);
        }
        setSaveState("saved");
        saveTimerRef.current = setTimeout(() => {
          setSaveState("idle");
          saveTimerRef.current = null;
        }, 1200);
        return true;
      } catch (error) {
        console.error("Failed to save education", error);
        setSaveState("error");
        return false;
      }
    },
    [ensureResumeId]
  );

  const updateItems = useCallback(
    (updater: (prev: EducationItem[]) => EducationItem[], options?: { persist?: boolean }) => {
      let nextState: EducationItem[] = itemsRef.current;
      setItems((prev) => {
        const next = updater(prev);
        nextState = next;
        return next;
      });
      itemsRef.current = nextState;
      if (options?.persist) {
        void persistEducation(nextState);
      }
    },
    [persistEducation]
  );

  const handleItemChange = useCallback(
    (index: number, key: keyof Omit<EducationItem, "present">) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        updateItems((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], [key]: value } as EducationItem;
          return next;
        });
      },
    [updateItems]
  );

  const handleItemBlur = useCallback(() => {
    void persistEducation();
  }, [persistEducation]);

  const handlePresentChange = useCallback(
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      updateItems(
        (prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            present: checked,
            end: checked ? "" : next[index].end,
          };
          return next;
        },
        { persist: true }
      );
    },
    [updateItems]
  );

  const handleAddRow = useCallback(() => {
    updateItems((prev) => [...prev, { ...defaultItem }], { persist: true });
  }, [updateItems]);

  const handleRemoveRow = useCallback(
    (index: number) => {
      updateItems(
        (prev) => {
          if (prev.length === 1) return [{ ...defaultItem }];
          return prev.filter((_, rowIndex) => rowIndex !== index);
        },
        { persist: true }
      );
    },
    [updateItems]
  );

  const handleFinalEducationChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFinalTouched(true);
    setFinalEducation(event.target.value as FinalEducation | "");
  }, []);

  const nextDisabled =
    isHydrating || isSubmitting || finalEducation === "" || Boolean(listError);

  const infoMessage = useMemo(() => {
    if (isHydrating) return "入力済みの学歴を読み込み中です";
    if (loadError) return loadError;
    return null;
  }, [isHydrating, loadError]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFinalTouched(true);
      setSubmitError(null);

      const listResult = EducationListSchema.safeParse(itemsRef.current);
      if (!listResult.success || finalEducation === "") {
        return;
      }

      setIsSubmitting(true);
      try {
        const saved = await persistEducation(itemsRef.current);
        if (!saved) {
          throw new Error("failed to save education rows");
        }

        const id = ensureResumeId();
        if (!id) {
          throw new Error("resume id missing");
        }

        const notePayload = createNotePayload(resumeStatusRef.current, finalEducation as FinalEducation);
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftId: id,
            step: 2 as const,
            data: {
              status: "student" as const,
              note: JSON.stringify(notePayload),
            },
          }),
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `failed to save final education: ${res.status}`);
        }

        resumeStatusRef.current = {
          ...resumeStatusRef.current,
          finalEducation: finalEducation as FinalEducation,
          version: notePayload.version as string | undefined,
        };

        router.push("/resume/4");
      } catch (error) {
        console.error("Failed to submit education form", error);
        setSubmitError("最終学歴の保存に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setIsSubmitting(false);
      }
    },
    [ensureResumeId, finalEducation, persistEducation, router]
  );

  return (
    <form onSubmit={handleSubmit} aria-describedby={infoMessage ? "education-status" : undefined}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-text-strong, #111827)",
            marginBottom: "12px",
          }}
        >
          学歴
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #6b7280)" }}>
          在籍期間と学校名を入力してください。入力内容はフィールドから離れたタイミングで自動保存されます。
        </p>
        {infoMessage && (
          <p
            id="education-status"
            role="status"
            style={{ marginTop: "8px", fontSize: "0.875rem", color: loadError ? "#dc2626" : "#6b7280" }}
          >
            {infoMessage}
          </p>
        )}
        {submitError && (
          <p
            role="alert"
            style={{
              marginTop: "12px",
              color: "#dc2626",
              fontSize: "0.875rem",
            }}
          >
            {submitError}
          </p>
        )}
        {listError && !isHydrating && (
          <div
            role="alert"
            style={{
              marginTop: "16px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
              padding: "12px",
              fontSize: "0.875rem",
              color: "#b91c1c",
            }}
          >
            {listError}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "24px" }}>
        <span
          id="final-education-label"
          style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
        >
          最終学歴 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
        </span>
        <div
          role="radiogroup"
          aria-labelledby="final-education-label"
          aria-invalid={finalTouched && finalEducation === ""}
          aria-describedby={
            finalTouched && finalEducation === "" ? "error-finalEducation" : undefined
          }
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}
        >
          {finalEducationOptions.map((option) => {
            const checked = finalEducation === option;
            const isFocused = focusedFinalEducation === option;
            return (
              <label
                key={option}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  border: checked
                    ? "2px solid var(--color-primary, #2563eb)"
                    : isFocused
                      ? "2px solid rgba(37, 99, 235, 0.6)"
                      : "1px solid var(--color-border, #d1d5db)",
                  padding: "10px 14px",
                  backgroundColor: checked ? "rgba(37, 99, 235, 0.08)" : "#ffffff",
                  color: checked
                    ? "var(--color-primary, #2563eb)"
                    : "var(--color-text-strong, #111827)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  transition: "border-color 0.2s ease, background-color 0.2s ease",
                  boxShadow: isFocused
                    ? "0 0 0 4px rgba(37, 99, 235, 0.15)"
                    : "none",
                }}
              >
                <input
                  type="radio"
                  name="finalEducation"
                  value={option}
                  checked={checked}
                  onChange={handleFinalEducationChange}
                  onFocus={() => setFocusedFinalEducation(option)}
                  onBlur={() => {
                    setFinalTouched(true);
                    setFocusedFinalEducation(null);
                  }}
                  disabled={isSubmitting}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
        {finalTouched && finalEducation === "" && (
          <p
            id="error-finalEducation"
            role="alert"
            style={{ marginTop: "4px", color: "#dc2626", fontSize: "0.875rem" }}
          >
            最終学歴を選択してください
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {items.map((item, index) => {
          const errors = rowErrors[index] ?? {};
          const rowId = `education-${index}`;

          return (
            <fieldset
              key={`${rowId}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
                backgroundColor: "#ffffff",
              }}
            >
              <legend style={{ fontSize: "1rem", fontWeight: 600 }}>学校 {index + 1}</legend>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div>
                  <label htmlFor={`${rowId}-school`} style={{ display: "block", fontWeight: 600, fontSize: "0.9rem" }}>
                    学校名 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${rowId}-school`}
                    type="text"
                    value={item.schoolName}
                    onChange={handleItemChange(index, "schoolName")}
                    onBlur={handleItemBlur}
                    aria-invalid={Boolean(errors.schoolName)}
                    aria-describedby={errors.schoolName ? `${rowId}-school-error` : undefined}
                    disabled={isSubmitting}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border, #d1d5db)",
                      padding: "8px 12px",
                    }}
                  />
                  {errors.schoolName && (
                    <p
                      id={`${rowId}-school-error`}
                      role="alert"
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.schoolName}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${rowId}-faculty`} style={{ display: "block", fontWeight: 600, fontSize: "0.9rem" }}>
                    学部・学科 (任意)
                  </label>
                  <input
                    id={`${rowId}-faculty`}
                    type="text"
                    value={item.faculty}
                    onChange={handleItemChange(index, "faculty")}
                    onBlur={handleItemBlur}
                    disabled={isSubmitting}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border, #d1d5db)",
                      padding: "8px 12px",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor={`${rowId}-start`} style={{ display: "block", fontWeight: 600, fontSize: "0.9rem" }}>
                    入学年月 <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id={`${rowId}-start`}
                    type="month"
                    value={item.start}
                    onChange={handleItemChange(index, "start")}
                    onBlur={handleItemBlur}
                    aria-invalid={Boolean(errors.start)}
                    aria-describedby={errors.start ? `${rowId}-start-error` : undefined}
                    disabled={isSubmitting}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border, #d1d5db)",
                      padding: "8px 12px",
                    }}
                  />
                  {errors.start && (
                    <p
                      id={`${rowId}-start-error`}
                      role="alert"
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.start}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${rowId}-end`} style={{ display: "block", fontWeight: 600, fontSize: "0.9rem" }}>
                    卒業年月 (任意)
                  </label>
                  <input
                    id={`${rowId}-end`}
                    type="month"
                    value={item.end}
                    onChange={handleItemChange(index, "end")}
                    onBlur={handleItemBlur}
                    aria-invalid={Boolean(errors.end)}
                    aria-describedby={errors.end ? `${rowId}-end-error` : undefined}
                    disabled={isSubmitting || item.present}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border, #d1d5db)",
                      padding: "8px 12px",
                      backgroundColor: item.present ? "#f3f4f6" : "#fff",
                    }}
                  />
                  {errors.end && (
                    <p
                      id={`${rowId}-end-error`}
                      role="alert"
                      style={{ marginTop: "4px", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      {errors.end}
                    </p>
                  )}
                  <label
                    style={{
                      marginTop: "8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.present}
                      onChange={handlePresentChange(index)}
                      disabled={isSubmitting}
                    />
                    在学中 (終了年月なし)
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleRemoveRow(index)}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    backgroundColor: "#fff",
                    color: "#1f2937",
                    cursor: "pointer",
                  }}
                  disabled={isSubmitting && items.length === 1}
                >
                  削除
                </button>
              </div>
            </fieldset>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={handleAddRow}
          style={{
            borderRadius: "9999px",
            padding: "10px 20px",
            fontSize: "0.9rem",
            border: "none",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#fff",
            cursor: "pointer",
          }}
          disabled={isSubmitting}
        >
          学校を追加
        </button>
        <AutoSaveBadge state={saveState} />
      </div>

      <div
        style={{
          marginTop: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <Link
          href="/resume/2"
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            textDecoration: "none",
            color: "#1f2937",
            backgroundColor: "#fff",
            fontSize: "0.9rem",
          }}
        >
          戻る
        </Link>
        <button
          type="submit"
          disabled={nextDisabled}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: "var(--color-primary, #2563eb)",
            color: "#fff",
            fontSize: "0.95rem",
            opacity: nextDisabled ? 0.6 : 1,
            cursor: nextDisabled ? "not-allowed" : "pointer",
          }}
        >
          次へ
        </button>
      </div>
    </form>
  );
}
