import type { ReactNode } from "react"

import WizardNav from "../../components/layout/WizardNav"
import styles from "../../components/layout/ResumeLayout.module.css"

export const metadata = {
  title: "Careerme（キャリミー）",
}

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h1 className={styles.title}>履歴書</h1>
        <p className={styles.subtitle}>5ステップだけで履歴書をカンタン作成！</p>
      </header>
      <WizardNav />
      <div className={styles.content}>{children}</div>
    </section>
  )
}
