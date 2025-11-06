'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './CvTabNav.module.css';

const tabs = [
  { href: '/cv/2', label: '自己PR' },
  { href: '/cv/3', label: '職務要約' },
];

export default function CvTabNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} role="tablist" aria-label="CV セクション">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${isActive ? styles.active : ''}`.trim()}
            role="tab"
            aria-current={isActive ? 'page' : undefined}
            aria-selected={isActive}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
