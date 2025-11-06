import Link from 'next/link'

const cautions = [
  '生成される職務経歴書の内容は正確性を保証するものではありません。',
  '個人情報が含まれる場合は必ず内容を確認し、必要に応じて修正してください。',
  '社外共有の前に、社内ポリシーおよび法令に照らして適切性を確認してください。',
]

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-ai)',
        padding: '32px 16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          boxShadow: '0 16px 32px rgba(0, 0, 0, 0.08)',
          padding: '32px 28px',
          color: 'var(--color-text)',
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-secondary)',
              marginBottom: 8,
            }}
          >
            Consent & Notice
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text)',
            }}
          >
            AI職務経歴書
          </h1>
          <p style={{ fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
            AI を活用した職務経歴書作成ツールです。ご利用前に注意事項をご確認ください。
          </p>
        </header>
        <ul style={{ margin: '0 0 24px', paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
          {cautions.map((caution) => (
            <li key={caution} style={{ marginBottom: 8 }}>
              {caution}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              boxShadow: '0 10px 20px rgba(58, 117, 196, 0.2)',
            }}
          >
            作成を始める
          </Link>
          <Link
            href="/accept"
            style={{
              fontSize: 14,
              color: 'var(--color-text)',
              textDecoration: 'underline',
              textAlign: 'center',
            }}
          >
            利用上の注意と同意
          </Link>
        </div>
      </section>
    </main>
  )
}
