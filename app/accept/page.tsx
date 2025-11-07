import Link from "next/link"

export default function AcceptPage() {
  return (
    <section
      style={{
        display: "grid",
        gap: "var(--space-lg)",
        background: "var(--color-bg)",
        borderRadius: "1.25rem",
        padding: "var(--space-xl) var(--space-lg)",
        boxShadow: "var(--shadow-soft)",
        lineHeight: 1.7,
      }}
    >
      <header style={{ display: "grid", gap: "var(--space-xs)" }}>
        <h1 style={{ fontSize: "1.625rem", fontWeight: 700 }}>利用上の注意と同意</h1>
        <p style={{ fontSize: "0.95rem" }}>
          本サービスは、個人情報の保護に関する法律（個人情報保護法）その他関連法令を遵守し、適切な管理のもとで運営しています。
        </p>
      </header>
      <p style={{ fontSize: "0.95rem" }}>
        入力いただく職務経歴や個人情報は、職務経歴書を生成する目的のみに利用し、法令に基づく場合を除き第三者に提供いたしません。
      </p>
      <p style={{ fontSize: "0.95rem" }}>
        本サービスを継続してご利用いただくことで、上記内容およびプライバシーポリシーに同意いただいたものとみなします。
      </p>
      <div style={{ display: "grid", gap: "var(--space-sm)" }}>
        <Link href="/resume/1" className="link-button link-button--primary">
          同意して作成を始める
        </Link>
        <Link href="/" className="link-button link-button--ghost">
          戻る
        </Link>
      </div>
    </section>
  )
}
