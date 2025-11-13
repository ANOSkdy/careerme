"use client";
import type { SaveState } from "./hooks/useAutoSave";

export default function AutoSaveBadge({ state }: { state: SaveState }) {
  const label =
    state === "saving"
      ? "保存中…"
      : state === "saved"
      ? "保存しました"
      : "";

  if (!label) return null;

  return (
    <div
      aria-live="polite"
      style={{ marginTop: "8px", fontSize: "0.75rem", color: "#6b7280" }}
    >
      {label}
    </div>
  );
}
