import type { ReactNode } from "react"

import styles from "../../components/layout/CvLayout.module.css"
import CvTabNav from "../../components/layout/CvTabNav"

export const metadata = {
  title: "CV Wizard",
}

export default function CvLayout({ children }: { children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>職務経歴書ウィザード</h1>
          <span className="cv-meta">
            <span className="cv-chip">AIサマリー対応</span>
            <span className="cv-chip">PDF出力</span>
          </span>
        </div>
        <CvTabNav />
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  )
}
