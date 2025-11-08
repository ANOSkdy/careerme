"use client";

import { forwardRef } from "react";

export type MonthYearSelectProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
};

const MonthYearSelect = forwardRef<HTMLInputElement, MonthYearSelectProps>(
  (
    {
      value,
      onChange,
      id,
      name,
      required = false,
      min,
      max,
      disabled = false,
      placeholder,
    },
    ref
  ) => {
    return (
      <input
        ref={ref}
        type="month"
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        className="month-year-input"
      />
    );
  }
);

MonthYearSelect.displayName = "MonthYearSelect";

export default MonthYearSelect;
