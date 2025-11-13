
"use client";

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
import StepNav from "../_components/StepNav";
import type { SaveState } from "../_components/hooks/useAutoSave";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import {
  EducationItemSchema,
  EducationListSchema,
} from "../../../lib/validation/schemas";
import type { z } from "zod";

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

type EducationItem = z.infer<typeof EducationItemSchema>;

type RowErrors = Record<number, Partial<Record<keyof EducationItem, string>>>;

type ResumeResponse = {
  id?: string | null;
  highestEducation?: string | null;
};

type EducationResponse = {
  ok?: boolean;
  items?: Array<{
    schoolName?: string;
    faculty?: string;
    school?: string;
    degree?: string;
    start?: string;
    end?: string;
    present?: boolean;
    current?: boolean;
  }>;
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

function prepareEducationPayload(items: EducationItem[]) {
  return items.map((item) => ({
    schoolName: item.schoolName,
    faculty: item.faculty ?? "",
    start: item.start,
    end: item.present ? "" : item.end ?? "",
    present: Boolean(item.present),
  }));
}

export default function EducationForm() {
  const router = useRouter();
  const [items, setItems] = useState<EducationItem[]>([defaultItem]);
  const itemsRef = useRef<EducationItem[]>([defaultItem]);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [listError, setListError] = useState<string | null>(null);
  const [finalEducation, setFinalEducation] = useState<FinalEducation | "">("");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const ensureIdPromiseRef = useRef<Promise<string | null> | null>(null);
  const lastEducationSnapshotRef = useRef<string | null>(null);
  const lastHighestSnapshotRef = useRef<string | null>(null);
  const [educationSaveState, setEducationSaveState] = useState<SaveState>("idle");
  const [finalSaveState, setFinalSaveState] = useState<SaveState>("idle");
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    resumeIdRef.current = resumeId;
  }, [resumeId]);

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
        const data = (await res.json()) as ResumeResponse;
        const id = typeof data.id === "string" && data.id ? data.id : null;
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

  useEffect(() => {
    let cancelled = false;
    setIsHydrating(true);

    (async () => {
      try {
        const resumeRes = await fetch("/api/data/resume", { cache: "no-store" });
        if (!resumeRes.ok) {
          throw new Error(`failed to load resume: ${resumeRes.status}`);
        }
        const resumeJson = (await resumeRes.json()) as ResumeResponse;
        if (cancelled) return;

        let id = typeof resumeJson.id === "string" && resumeJson.id ? resumeJson.id : null;
        if (id) {
          resumeIdRef.current = id;
          setResumeId(id);
        }
        if (resumeJson.highestEducation) {
          if (finalEducationOptions.includes(resumeJson.highestEducation as FinalEducation)) {
            setFinalEducation(resumeJson.highestEducation as FinalEducation);
            lastHighestSnapshotRef.current = resumeJson.highestEducation;
          }
        }

        if (!id) {
          id = await ensureResumeId();
        }

        if (!id) {
          itemsRef.current = [defaultItem];
          setItems([defaultItem]);
          lastEducationSnapshotRef.current = null;
          setLoadError(null);
          return;
        }

        const educationRes = await fetch(`/api/data/education?resumeId=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!educationRes.ok) {
          throw new Error(`failed to load education: ${educationRes.status}`);
        }
        const educationJson = (await educationRes.json()) as EducationResponse;
        if (cancelled) return;

        const normalized = Array.isArray(educationJson.items)
          ? educationJson.items.map((item) => normalizeEducationItem(item))
          : [];
        const nextItems = normalized.length ? normalized : [defaultItem];
        itemsRef.current = nextItems;
        setItems(nextItems);
        lastEducationSnapshotRef.current = normalized.length
          ? JSON.stringify(prepareEducationPayload(normalized))
          : JSON.stringify([]);
        setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load education data", error);
          setLoadError(null);
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureResumeId]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const listValidation = useMemo(() => EducationListSchema.safeParse(items), [items]);

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

    if (!listValidation.success) {
      const issue = listValidation.error.issues[0];
      setListError(issue?.message ?? "入力内容に不備があります");
    } else {
      setListError(null);
    }
  }, [items, listValidation]);

  const saveEducation = useCallback(
    async (value: EducationItem[], options: { force?: boolean } = {}) => {
      const payload = prepareEducationPayload(value);
      const snapshot = JSON.stringify(payload);
      if (!options.force && snapshot === lastEducationSnapshotRef.current && resumeIdRef.current) {
        return true;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setEducationSaveState("error");
        return false;
      }

      setEducationSaveState("saving");
      try {
        const res = await fetch("/api/data/education", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeId: ensuredId, items: payload }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to save education: ${res.status}`);
        }
        resumeIdRef.current = ensuredId;
        setResumeId(ensuredId);
        lastEducationSnapshotRef.current = snapshot;
        setEducationSaveState("saved");
        setTimeout(() => setEducationSaveState("idle"), 1200);
        return true;
      } catch (error) {
        console.error("Failed to save education", error);
        setEducationSaveState("error");
        return false;
      }
    },
    [ensureResumeId]
  );

  const saveHighestEducation = useCallback(
    async (value: FinalEducation, options: { force?: boolean } = {}) => {
      if (!options.force && value === lastHighestSnapshotRef.current && resumeIdRef.current) {
        return true;
      }

      const ensuredId = await ensureResumeId();
      if (!ensuredId) {
        setFinalSaveState("error");
        return false;
      }

      setFinalSaveState("saving");
      try {
        const res = await fetch("/api/data/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ensuredId, highestEducation: value }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`failed to save highest education: ${res.status}`);
        }
        const json = (await res.json()) as ResumeResponse;
        const id = typeof json.id === "string" && json.id ? json.id : ensuredId;
        resumeIdRef.current = id;
        setResumeId(id);
        lastHighestSnapshotRef.current = value;
        setFinalSaveState("saved");
        setTimeout(() => setFinalSaveState("idle"), 1200);
        return true;
      } catch (error) {
        console.error("Failed to save highest education", error);
        setFinalSaveState("error");
        return false;
      }
    },
    [ensureResumeId]
  );

  const autoSaveEducationPayload = listValidation.success ? listValidation.data : null;
  useAutoSave(autoSaveEducationPayload, async (value) => {
    if (!value) return;
    await saveEducation(value);
  }, 2000, { enabled: Boolean(autoSaveEducationPayload) && !isHydrating });

  const autoSaveHighestPayload = finalEducation ? finalEducation : null;
  useAutoSave(autoSaveHighestPayload, async (value) => {
    if (!value) return;
    await saveHighestEducation(value);
  }, 2000, { enabled: Boolean(autoSaveHighestPayload) && !isHydrating });

  const updateItems = useCallback((updater: (prev: EducationItem[]) => EducationItem[]) => {
    setItems((prev) => {
      const next = updater(prev);
      itemsRef.current = next;
      return next;
    });
  }, []);

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

  const handlePresentChange = useCallback(
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      updateItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          present: checked,
          end: checked ? "" : next[index].end,
        };
        return next;
      });
    },
    [updateItems]
  );

  const handleAddRow = useCallback(() => {
    updateItems((prev) => [...prev, { ...defaultItem }]);
  }, [updateItems]);

  const handleRemoveRow = useCallback(
    (index: number) => {
      updateItems((prev) => {
        if (prev.length === 1) return [{ ...defaultItem }];
        return prev.filter((_, rowIndex) => rowIndex !== index);
      });
    },
    [updateItems]
  );

  const handleFinalEducationChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFinalEducation(event.target.value as FinalEducation | "");
  }, []);

  const infoMessage = useMemo(() => {
    if (isHydrating) return "入力済みの学歴を読み込み中です";
    if (loadError) return loadError;
    return null;
  }, [isHydrating, loadError]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!listValidation.success) {
        return;
      }

      try {
        const savedEducation = await saveEducation(listValidation.data, { force: true });
        if (!savedEducation) {
          throw new Error("failed to save education rows");
        }

        if (finalEducation) {
          const savedHighest = await saveHighestEducation(finalEducation as FinalEducation, {
            force: true,
          });
          if (!savedHighest) {
            throw new Error("failed to save highest education");
          }
        }

        router.push("/resume/4");
      } catch (error) {
        console.error("Failed to submit education form", error);
      }
    },
    [finalEducation, listValidation, router, saveEducation, saveHighestEducation]
  );

  return (
    <form onSubmit={handleSubmit} aria-describedby={infoMessage ? "education-status" : undefined}>
      <div style={{ marginBottom: "24px" }}>
        <h2 className="resume-page-title">学歴</h2>
        {infoMessage && (
          <p
            id="education-status"
            role={loadError ? "alert" : "status"}
            style={{ marginTop: "8px", fontSize: "0.875rem", color: loadError ? "#dc2626" : "#555" }}
          >
            {infoMessage}
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

      <div className="final-education" style={{ marginBottom: "32px" }}>
        <fieldset className="final-education__fieldset">
          <legend className="final-education__legend">最終学歴</legend>
          <div className="final-education__options">
            {finalEducationOptions.map((option) => (
              <label key={option} className="final-education__option">
                <input
                  type="radio"
                  name="finalEducation"
                  value={option}
                  checked={finalEducation === option}
                  onChange={handleFinalEducationChange}
                  className="final-education__input"
                />
                <span className="final-education__label">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {finalSaveState !== "idle" && (
          <p style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--color-secondary, #6b7280)" }}>
            {finalSaveState === "saving" && "最終学歴を保存中…"}
            {finalSaveState === "saved" && "最終学歴を保存しました"}
          </p>
        )}
      </div>

      <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
        {items.map((item, index) => (
          <div
            key={index}
            data-education-card="true"
            data-education-card-id={String(index)}
            style={{
              border: "1px solid var(--color-border, #d1d5db)",
              borderRadius: "12px",
              padding: "16px",
              display: "grid",
              gap: "12px",
            }}
          >
            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontWeight: 600 }}>
                学校名
                <input
                  value={item.schoolName}
                  onChange={handleItemChange(index, "schoolName")}
                  aria-invalid={Boolean(rowErrors[index]?.schoolName)}
                  aria-describedby={rowErrors[index]?.schoolName ? `error-school-${index}` : undefined}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    borderRadius: "8px",
                    border: `1px solid ${rowErrors[index]?.schoolName ? "#dc2626" : "var(--color-border, #d1d5db)"}`,
                    padding: "10px 12px",
                  }}
                />
              </label>
              {rowErrors[index]?.schoolName && (
                <p
                  id={`error-school-${index}`}
                  role="alert"
                  style={{ fontSize: "0.75rem", color: "#dc2626" }}
                >
                  {rowErrors[index]!.schoolName}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontWeight: 600 }}>
                学部・学科
                <input
                  value={item.faculty}
                  onChange={handleItemChange(index, "faculty")}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    borderRadius: "8px",
                    border: `1px solid ${rowErrors[index]?.faculty ? "#dc2626" : "var(--color-border, #d1d5db)"}`,
                    padding: "10px 12px",
                  }}
                />
              </label>
              {rowErrors[index]?.faculty && (
                <p
                  role="alert"
                  style={{ fontSize: "0.75rem", color: "#dc2626" }}
                >
                  {rowErrors[index]!.faculty}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: "140px" }}>
                入学年月
                <input
                  type="month"
                  value={item.start}
                  onChange={handleItemChange(index, "start")}
                  aria-invalid={Boolean(rowErrors[index]?.start)}
                  aria-describedby={rowErrors[index]?.start ? `error-start-${index}` : undefined}
                  style={{
                    marginTop: "4px",
                    width: "100%",
                    borderRadius: "8px",
                    border: `1px solid ${rowErrors[index]?.start ? "#dc2626" : "var(--color-border, #d1d5db)"}`,
                    padding: "10px 12px",
                  }}
                />
              </label>
              {!item.present && (
                <label style={{ flex: 1, minWidth: "140px" }}>
                  卒業年月
                  <input
                    type="month"
                    value={item.end}
                    onChange={handleItemChange(index, "end")}
                    aria-invalid={Boolean(rowErrors[index]?.end)}
                    aria-describedby={rowErrors[index]?.end ? `error-end-${index}` : undefined}
                    style={{
                      marginTop: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      border: `1px solid ${rowErrors[index]?.end ? "#dc2626" : "var(--color-border, #d1d5db)"}`,
                      padding: "10px 12px",
                    }}
                  />
                </label>
              )}
            </div>
            {(rowErrors[index]?.start || rowErrors[index]?.end) && (
              <p
                role="alert"
                style={{ fontSize: "0.75rem", color: "#dc2626" }}
              >
                {rowErrors[index]?.start ?? rowErrors[index]?.end}
              </p>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={item.present}
                onChange={handlePresentChange(index)}
              />
              在学中
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => handleRemoveRow(index)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--color-primary, #2563eb)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                削除
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          data-education-add="true"
          onClick={handleAddRow}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px dashed var(--color-primary, #2563eb)",
            background: "rgba(37, 99, 235, 0.08)",
            color: "var(--color-primary, #2563eb)",
            borderRadius: "9999px",
            padding: "10px 18px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          学校を追加
        </button>
      </div>

      <AutoSaveBadge state={educationSaveState} />

      <StepNav step={3} nextType="link" nextHref="/resume/4" />
    </form>
  );
}
