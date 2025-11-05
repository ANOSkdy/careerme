"use client";
import StepNav from "../_components/StepNav";

export default function Step3Page() {
  return (
    <div>
      <h2
        style={{
          marginBottom: "16px",
          fontSize: "1.25rem",
          fontWeight: 500,
        }}
      >
        学歴（プレースホルダ）
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#4b5563", marginBottom: "16px" }}>
        学歴の行追加/削除・保存は後半PRで実装。現状はウィザードの遷移・ガードのみを担保します。
      </p>
      <div
        style={{
          marginTop: "24px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          padding: "12px",
          fontSize: "0.875rem",
          color: "#4b5563",
        }}
      >
        Coming soon: education list editor (add/remove rows, Zod validation, REST to /api/data/education)
      </div>
      <StepNav step={3} />
    </div>
  );
}
