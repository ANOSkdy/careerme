"use client";

import { useMemo } from "react";

export type TagOption = {
  value: string;
  label: string;
};

export type TagSelectorProps = {
  options: TagOption[];
  value: string[];
  onChange: (next: string[]) => void;
  maxSelections?: number;
  label?: string;
  disabled?: boolean;
  helperText?: string;
};

function normalizeValue(value: string[]): string[] {
  return Array.from(new Set(value.filter((item) => item)));
}

export default function TagSelector({
  options,
  value,
  onChange,
  maxSelections,
  label,
  disabled = false,
  helperText,
}: TagSelectorProps) {
  const selected = useMemo(() => normalizeValue(value), [value]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const limitReached =
    typeof maxSelections === "number" && selected.length >= maxSelections;

  const handleToggle = (optionValue: string) => {
    if (disabled) return;
    const isSelected = selectedSet.has(optionValue);
    if (isSelected) {
      onChange(selected.filter((item) => item !== optionValue));
      return;
    }
    if (limitReached) return;
    onChange([...selected, optionValue]);
  };

  return (
    <div className="tag-selector">
      {label ? (
        <div className="tag-selector__label">
          <span>{label}</span>
          {maxSelections ? (
            <span className="tag-selector__hint">最大{maxSelections}件</span>
          ) : null}
        </div>
      ) : null}
      {helperText ? (
        <p className="tag-selector__helper" aria-live="polite">
          {helperText}
        </p>
      ) : null}
      <div className="tag-selector__options" role="group">
        {options.map((option) => {
          const isSelected = selectedSet.has(option.value);
          const isDisabled = disabled || (!isSelected && limitReached);
          return (
            <button
              key={option.value}
              type="button"
              className={`tag-selector__option${
                isSelected ? " is-selected" : ""
              }${isDisabled && !isSelected ? " is-disabled" : ""}`}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
              onClick={() => handleToggle(option.value)}
              disabled={disabled}
            >
              <span className="tag-selector__option-label">{option.label}</span>
              {isSelected ? <span aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
      {selected.length ? (
        <div className="tag-selector__chips" aria-live="polite">
          {selected.map((item) => {
            const labelText = options.find((option) => option.value === item)?.label ?? item;
            return (
              <span key={item} className="tag-selector__chip">
                {labelText}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
