import Link from "next/link"

const cautions = [
  "生成される職務経歴書の内容は正確性を保証するものではありません。",
  "個人情報が含まれる場合は必ず内容を確認し、必要に応じて修正してください。",
  "社外共有の前に、社内ポリシーおよび法令に照らして適切性を確認してください。",
]

export default function Home() {
  return (
    <section
      style={{
        display: "grid",
        gap: "var(--space-lg)",
        background: "var(--color-bg)",
        borderRadius: "1.25rem",
        padding: "var(--space-xl) var(--space-lg)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <header style={{ display: "grid", gap: "var(--space-sm)" }}>
        <p
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
          }}
        >
          Consent &amp; Notice
        </p>
        <div style={{ display: "grid", gap: "var(--space-xs)" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>AI職務経歴書</h1>
          <p style={{ fontSize: "1rem", lineHeight: 1.7 }}>
            AI を活用した職務経歴書作成ツールです。ご利用前に注意事項をご確認ください。
          </p>
        </div>
      </header>
      <ul style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.95rem", lineHeight: 1.7 }}>
        {cautions.map((caution) => (
          <li key={caution}>{caution}</li>
        ))}
      </ul>
      <div style={{ display: "grid", gap: "var(--space-sm)" }}>
        <Link href="/resume/1" className="link-button link-button--primary">
          作成を始める
        </Link>
        <Link href="/accept" className="link-button link-button--ghost">
          利用上の注意と同意
        </Link>
      </div>
    </section>
  )
}
