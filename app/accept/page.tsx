import Link from 'next/link'

export default function AcceptPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f9fc',
        padding: '40px 16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.1)',
          padding: '36px 32px',
          color: 'var(--color-text)',
          lineHeight: 1.7,
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>利用上の注意と同意</h1>
          <p style={{ fontSize: 15 }}>
            本サービスは、個人情報の保護に関する法律（個人情報保護法）その他関連法令を遵守し、適切な管理のもとで運営しています。
          </p>
        </header>
        <p style={{ fontSize: 15, marginBottom: 16 }}>
          入力いただく職務経歴や個人情報は、職務経歴書を生成する目的のみに利用し、法令に基づく場合を除き第三者に提供いたしません。
        </p>
        <p style={{ fontSize: 15, marginBottom: 32 }}>
          本サービスを継続してご利用いただくことで、上記内容およびプライバシーポリシーに同意いただいたものとみなします。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Link
            href="/resume/1"
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '14px 18px',
              borderRadius: 999,
              fontWeight: 600,
              color: '#fff',
              backgroundColor: 'var(--color-primary)',
              textDecoration: 'none',
              boxShadow: '0 10px 20px rgba(58, 117, 196, 0.18)',
            }}
          >
            同意して作成を始める
          </Link>
          <Link
            href="/"
            style={{
              fontSize: 14,
              color: 'var(--color-secondary)',
              textDecoration: 'underline',
              textAlign: 'center',
            }}
          >
            戻る
          </Link>
        </div>
      </section>
    </main>
  )
}
