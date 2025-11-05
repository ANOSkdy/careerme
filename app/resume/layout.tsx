import type { ReactNode } from "react";

export const metadata = {
  title: "Resume Wizard",
};

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ maxWidth: "720px", margin: "0 auto", padding: "24px" }}
    >
      <header style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-primary, #111827)",
            margin: 0,
          }}
        >
          履歴書ウィザード
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "4px" }}>
          3ステップで入力・自動保存・復元に対応
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}
