import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import CvTabNav from '../../components/layout/CvTabNav';
import styles from '../../components/layout/CvLayout.module.css';
import IdBadge from './IdBadge';

export const metadata: Metadata = {
  title: 'CV Wizard',
};

export default function CvLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>CV Wizard</h1>
          <IdBadge />
        </header>
        <CvTabNav />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
