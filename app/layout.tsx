import './globals.css'
import { Figtree, Fraunces } from 'next/font/google'

const body = Figtree({ subsets: ['latin'], variable: '--font-body' })
const head = Fraunces({ subsets: ['latin'], variable: '--font-head' })

export const metadata = { title: 'Stockroom', description: 'Multi-store stock management' }

// Runs before first paint so a saved dark or light choice never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem('stockroom-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${head.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  )
}
