import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'careerme',
  description: 'Resume/CV builder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body>{children}</body>
    </html>
  )
}
