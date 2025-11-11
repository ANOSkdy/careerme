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
    <div className="resume-tag-input">
      <label htmlFor={id} className="resume-form__label">
        {label}
      </label>
      <div className="resume-tag-input__control">
        {value.map((tag) => (
          <span key={tag} className="resume-form__chip">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="resume-form__chip-remove"
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
          className="resume-tag-input__input"
          aria-describedby={`${id}-hint`}
        />
      </div>
      <p id={`${id}-hint`} className="resume-form__helper resume-tag-input__hint">
        {hint}
      </p>
    </div>
  );
}
