"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { href: "/", label: "ホーム" },
  { href: "/resume/1", label: "履歴書" },
  { href: "/cv/1", label: "職務経歴" },
]

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function TabBarMobile() {
  const pathname = usePathname()

  return (
    <div className="tabbar-nav">
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="tabbar-link"
            aria-current={active ? "page" : undefined}
          >
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
