
// @ts-ignore Next.js processes this stylesheet import, but TypeScript has no CSS declaration here.
import './globals.css'
import type { Viewport } from 'next'

export const metadata = { title: 'Stockroom', description: 'Multi-store stock management' }

// Makes the app fit every screen, including phones with a notch.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#1673BB' }

// Runs before first paint so a saved dark or light choice never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem('stockroom-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  )
}