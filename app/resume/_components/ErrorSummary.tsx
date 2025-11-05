"use client";
import { useEffect, useRef } from "react";

type Props = {
  errors: Record<string, string>;
  fieldOrder: string[];
  fieldLabels: Record<string, string>;
};

export default function ErrorSummary({ errors, fieldOrder, fieldLabels }: Props) {
  const entries = fieldOrder
    .map((key) => [key, errors[key]] as const)
    .filter(([, message]) => Boolean(message));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (entries.length > 0) {
      ref.current?.focus();
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-live="assertive"
      style={{
        marginBottom: "16px",
        borderRadius: "8px",
        border: "1px solid #fecaca",
        backgroundColor: "#fef2f2",
        padding: "12px",
        fontSize: "0.875rem",
        color: "#b91c1c",
        outline: "none",
      }}
    >
      <p style={{ fontWeight: 600, margin: 0 }}>入力エラーを確認してください。</p>
      <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
        {entries.map(([key, message]) => (
          <li key={key} style={{ marginBottom: "4px" }}>
            <a style={{ textDecoration: "underline" }} href={`#${key}`}>
              {fieldLabels[key] ?? key}
            </a>
            ：{message}
          </li>
        ))}
      </ul>
    </div>
  );
}
