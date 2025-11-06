"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./WizardNav.module.css";

const steps = [
  { href: "/resume/1", label: "基本情報" },
  { href: "/resume/2", label: "状況" },
  { href: "/resume/3", label: "学歴" },
  { href: "/resume/4", label: "職歴" },
  { href: "/resume/5", label: "希望条件" },
];

export default function WizardNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="履歴書ステップナビゲーション">
      <ol className={styles.list}>
        {steps.map((step) => {
          const isActive =
            pathname === step.href ||
            (pathname?.startsWith(step.href) ?? false) ||
            (step.href === "/resume/1" && pathname === "/resume");

          return (
            <li key={step.href} className={styles.item}>
              <Link
                href={step.href}
                className={`${styles.link}${isActive ? ` ${styles.active}` : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
