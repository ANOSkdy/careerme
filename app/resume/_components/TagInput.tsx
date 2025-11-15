"use client";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

type TagInputProps = {
  id: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  labelHidden?: boolean;
};

export default function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  labelHidden = false,
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const labelStyle = useMemo<CSSProperties>(() => {
    if (!labelHidden) {
      return { fontSize: "0.875rem", fontWeight: 600 };
    }
    return {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: 0,
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    };
  }, [labelHidden]);

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          border: "1px solid var(--color-border, #d1d5db)",
          borderRadius: "8px",
          padding: "6px 8px",
          backgroundColor: "#fff",
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.875rem",
              color: "#111827",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                appearance: "none",
                border: "none",
                background: "transparent",
                color: "var(--color-primary, #2563eb)",
                cursor: "pointer",
                padding: 0,
                fontSize: "0.75rem",
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
          placeholder={placeholder ?? ""}
          style={{
            flex: 1,
            minWidth: "120px",
            border: "none",
            outline: "none",
            fontSize: "0.875rem",
            backgroundColor: "transparent",
            padding: "4px 0",
          }}
        />
      </div>
    </div>
  );
}
