"use client";
import { startTransition, useEffect, useState } from "react";

const STORAGE_KEY = "resume.draftId";

export function useDraftId() {
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      startTransition(() => setDraftId(existing));
      return;
    }
    const id =
      (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
    window.localStorage.setItem(STORAGE_KEY, id);
    startTransition(() => setDraftId(id));
  }, []);

  return draftId;
}
