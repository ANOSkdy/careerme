import type { ReactNode } from "react"

import styles from "../../components/layout/CvLayout.module.css"
import CvTabNav from "../../components/layout/CvTabNav"
import CvMetaChips from "../../components/layout/CvMetaChips"

export const metadata = {
  title: "CV Wizard",
}

export default function CvLayout({ children }: { children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>職務経歴書ウィザード</h1>
          <CvMetaChips />
        </div>
        <CvTabNav />
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  )
}
