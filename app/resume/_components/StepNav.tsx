"use client";
import Link from "next/link";
import type { CSSProperties } from "react";

export default function StepNav({
  step,
  nextDisabled,
}: {
  step: 1 | 2 | 3;
  nextDisabled?: boolean;
}) {
  const prevHref = step === 1 ? null : `/resume/${step - 1}`;
  const nextHref = step === 3 ? null : `/resume/${step + 1}`;

  const baseButtonStyle: CSSProperties = {
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    border: "1px solid #d1d5db",
    backgroundColor: "#ffffff",
    color: "#1f2937",
    textDecoration: "none",
    display: "inline-block",
    pointerEvents: "auto",
    opacity: 1,
  };

  const prevStyle: CSSProperties = {
    ...baseButtonStyle,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    opacity: prevHref ? 1 : 0.4,
    pointerEvents: prevHref ? "auto" : "none",
  };

  const nextStyle: CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: "var(--color-primary, #4A90E2)",
    borderColor: "var(--color-primary, #4A90E2)",
    color: "#ffffff",
    opacity: !nextHref || nextDisabled ? 0.5 : 1,
    pointerEvents: !nextHref || nextDisabled ? "none" : "auto",
  };

  return (
    <div
      style={{
        marginTop: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <Link aria-disabled={!prevHref} href={prevHref ?? "#"} style={prevStyle}>
        戻る
      </Link>
      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Step {step} / 3</div>
      <Link aria-disabled={!nextHref || nextDisabled} href={nextHref ?? "#"} style={nextStyle}>
        次へ
      </Link>
    </div>
  );
}
