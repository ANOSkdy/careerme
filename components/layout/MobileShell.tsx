import type { ReactNode } from "react"

import HeaderMobile from "./HeaderMobile"
import TabBarMobile from "./TabBarMobile"

export default function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-shell">
      <header className="mobile-shell__header">
        <HeaderMobile />
      </header>
      <main className="mobile-shell__main" role="main">
        {children}
      </main>
      <nav className="mobile-shell__tabbar" aria-label="主要ナビゲーション">
        <TabBarMobile />
      </nav>
    </div>
  )
}
