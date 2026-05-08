import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'logi-canvus',
  description: 'エンジニア向けドキュメント型仕様策定ツール',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
