import "./globals.css"
import type { Metadata, Viewport } from "next"
import MobileShell from "../components/layout/MobileShell"

export const metadata: Metadata = {
  title: "careerme",
  description: "Resume/CV builder",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  )
}
