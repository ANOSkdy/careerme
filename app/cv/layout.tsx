import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import CvTabNav from '../../components/layout/CvTabNav';
import styles from '../../components/layout/CvLayout.module.css';
import IdBadge from './IdBadge';

export const metadata: Metadata = {
  title: 'CV Wizard',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.card} mx-auto max-w-screen-md bg-white rounded-2xl shadow-sm border p-6 md:p-8`}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <h1 className={styles.title}>CV Wizard</h1>
          </div>
          <IdBadge />
        </header>
        <CvTabNav />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
