import Link from "next/link"

export default function HeaderMobile() {
  return (
    <div className="header-mobile">
      <div className="header-title">
        <Link href="/" className="header-title__brand">
          careerme
        </Link>
        <span className="header-title__tagline">AI職務経歴書ウィザード</span>
      </div>
      <div className="header-actions" aria-hidden>
        <span className="header-pill">Beta</span>
      </div>
    </div>
  )
}
