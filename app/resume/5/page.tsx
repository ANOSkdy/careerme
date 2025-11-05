"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AutoSaveBadge from "../_components/AutoSaveBadge";
import StepNav from "../_components/StepNav";
import TagInput from "../_components/TagInput";
import { useAutoSave } from "../_components/hooks/useAutoSave";
import { useDraftId } from "../_components/hooks/useDraftId";
import { DesiredSchema, type Desired } from "../_schemas/resume";

type ResumeResponse = {
  desired?: Partial<Desired>;
};

const emptyDesired: Desired = { roles: [], industries: [], locations: [] };

export default function Step5Page() {
  const draftId = useDraftId();
  const [form, setForm] = useState<Desired>(emptyDesired);

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
        if (!res.ok) throw new Error(`failed to fetch resume: ${res.status}`);
        const json = (await res.json()) as ResumeResponse;
        if (!cancelled && json?.desired) {
          setForm({
            roles: Array.isArray(json.desired.roles)
              ? json.desired.roles.filter((value): value is string => typeof value === "string")
              : [],
            industries: Array.isArray(json.desired.industries)
              ? json.desired.industries.filter((value): value is string => typeof value === "string")
              : [],
            locations: Array.isArray(json.desired.locations)
              ? json.desired.locations.filter((value): value is string => typeof value === "string")
              : [],
          });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Failed to load desired preferences", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draftId]);

  const save = useCallback(
    async (data: Desired) => {
      if (!draftId) return;
      const res = await fetch("/api/data/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, desired: data }),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `failed to save desired conditions: ${res.status}`);
      }
    },
    [draftId]
  );

  const parsed = useMemo(() => DesiredSchema.safeParse(form), [form]);

  const autoSaveState = useAutoSave(form, save, 2000, {
    enabled: Boolean(draftId) && parsed.success,
  });

  const onTagsChange = useCallback(
    (key: keyof Desired) => (values: string[]) => {
      setForm((prev) => ({ ...prev, [key]: values }));
    },
    []
  );

  return (
    <div>
      <h2
        style={{
          marginBottom: "12px",
          fontSize: "1.25rem",
          fontWeight: 500,
        }}
      >
        希望条件
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "16px" }}>
        役割・業界・勤務地をタグで入力してください。Enter または , で確定します。
      </p>

      <div
        style={{
          display: "grid",
          gap: "16px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#ffffff",
        }}
      >
        <TagInput
          id="desired-roles"
          label="希望する役割"
          value={form.roles}
          onChange={onTagsChange("roles")}
          placeholder="例) PM, データサイエンティスト"
        />
        <TagInput
          id="desired-industries"
          label="希望する業界"
          value={form.industries}
          onChange={onTagsChange("industries")}
          placeholder="例) SaaS, 建設, 物流"
        />
        <TagInput
          id="desired-locations"
          label="希望する勤務地"
          value={form.locations}
          onChange={onTagsChange("locations")}
          placeholder="例) 札幌, 東京, リモート"
        />
      </div>

      <AutoSaveBadge state={autoSaveState} />

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
          fontSize: "0.875rem",
          color: "#374151",
        }}
      >
        これで入力は完了です。内容を確認してから次のステップへ進んでください。
      </div>

      <StepNav step={5} nextDisabled />
    </div>
  );
}
