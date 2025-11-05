"use client";
import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutoSave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  debounceMs = 2000,
  options: { enabled?: boolean } = {}
) {
  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJson = useRef<string>("");
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return () => undefined;
    }

    const nextJson = JSON.stringify(value);
    if (nextJson === lastJson.current) return;
    lastJson.current = nextJson;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setState("saving");
      try {
        await save(value);
        setState("saved");
        setTimeout(() => setState("idle"), 1200);
      } catch (error) {
        console.error(error);
        setState("error");
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, save, debounceMs, enabled]);

  return state;
}
