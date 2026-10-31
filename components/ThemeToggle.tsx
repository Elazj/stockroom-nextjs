'use client'
import { useEffect, useState } from 'react'

// Switches between dark and light and remembers the choice. With no choice saved it follows the device.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const t = document.documentElement.dataset.theme
    setDark(t ? t === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches)
  }, [])
  const flip = () => {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('stockroom-theme', next) } catch {}
    setDark(!dark)
  }
  return (
    <button className="btn ghost sm" onClick={flip} aria-pressed={dark} aria-label="Switch between dark and light theme">
      {dark ? 'Switch to light mode' : 'Switch to dark mode'}
    </button>
  )
}
