import type { ReactNode } from "react";

import WizardNav from "../../components/layout/WizardNav";
import styles from "../../components/layout/ResumeLayout.module.css";

export const metadata = {
  title: "Resume Wizard",
};

export default function ResumeLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>履歴書ウィザード</h1>
          <p className={styles.subtitle}>5ステップで入力・自動保存・復元に対応</p>
        </header>
        <WizardNav />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
