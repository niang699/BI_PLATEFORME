import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "SEN'EAU BI Platform",
  description: "Plateforme BI interne — Société Nationale des Eaux du Sénégal",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  )
}
