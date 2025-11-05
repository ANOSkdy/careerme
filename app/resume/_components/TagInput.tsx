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
    <div>
      <label
        htmlFor={id}
        style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "4px" }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          border: "1px solid #d1d5db",
          borderRadius: "12px",
          padding: "8px 12px",
          backgroundColor: "#ffffff",
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "9999px",
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              fontSize: "0.75rem",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: "0.75rem",
                lineHeight: 1,
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
            minWidth: "120px",
            border: "none",
            outline: "none",
            fontSize: "0.875rem",
            backgroundColor: "transparent",
            padding: "4px 0",
          }}
          aria-describedby={`${id}-hint`}
        />
      </div>
      <p id={`${id}-hint`} style={{ marginTop: "4px", fontSize: "0.75rem", color: "#6b7280" }}>
        {hint}
      </p>
    </div>
  );
}
