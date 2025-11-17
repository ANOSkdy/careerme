import Link from 'next/link'

export default function PcHome() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1>PC メニュー</h1>
      <ul>
        <li>
          <Link href="/pc/schedule">スケジュール管理</Link>
        </li>
      </ul>
    </main>
  )
}
