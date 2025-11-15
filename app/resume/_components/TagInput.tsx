"use client";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";

type TagInputProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export default function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hint = useMemo(() => "Enter または , でタグを追加", []);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag) return;
      if (value.some((current) => current.localeCompare(tag) === 0)) {
        setDraft("");
        return;
      }
      onChange([...value, tag]);
      setDraft("");
    },
    [onChange, value]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((current) => current !== tag));
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [onChange, value]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addTag(draft);
      } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
        event.preventDefault();
        removeTag(value[value.length - 1]);
      }
    },
    [addTag, draft, removeTag, value]
  );

  const handleBlur = useCallback(() => {
    addTag(draft);
  }, [addTag, draft]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <label
        htmlFor={id}
        style={{ fontSize: "0.875rem", fontWeight: 600 }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          borderRadius: "16px",
          padding: "8px 10px",
          background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(129,140,248,0.08))",
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.875rem",
              color: "#312e81",
              padding: "6px 12px",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
              boxShadow: "0 1px 2px rgba(79,70,229,0.18)",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                appearance: "none",
                border: "none",
                background: "rgba(79,70,229,0.12)",
                color: "#4338ca",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "0.75rem",
                borderRadius: "9999px",
              }}
              aria-label={`${tag} を削除`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder ?? hint}
          style={{
            flex: 1,
            minWidth: "96px",
            border: "none",
            outline: "none",
            fontSize: "0.875rem",
            backgroundColor: "transparent",
            padding: "6px 0",
            color: "#1f2937",
          }}
          aria-describedby={`${id}-hint`}
        />
      </div>
      <p
        id={`${id}-hint`}
        style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#6b7280" }}
      >
        {hint}
      </p>
    </div>
  );
}
