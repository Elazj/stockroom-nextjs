'use client'
import { useEffect, useState } from 'react'
import { cx } from '@/lib/tw'
import { Row, Switch, TabHead } from './shared'

type Theme = 'light' | 'dark' | 'device'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }
const tell = () => window.dispatchEvent(new Event('stockroom-appearance'))

const CARDS: [Theme, string, string][] = [
  ['light', 'Light', 'bg-[#e8f3fc] border-[#cde2f2]'],
  ['dark', 'Dark', 'bg-[#0b1925] border-[#223a50]'],
  ['device', 'Match my device', 'bg-[linear-gradient(90deg,#e8f3fc_50%,#0b1925_50%)] border-[#cde2f2]'],
]

export default function Appearance() {
  const [theme, setTheme] = useState<Theme>('device')
  const [compact, setCompact] = useState(false)
  const [company, setCompany] = useState(true)

  useEffect(() => {
    const t = read('stockroom-theme')
    setTheme(t === 'light' || t === 'dark' ? t : 'device')
    setCompact(read('stockroom-compact') === '1')
    setCompany(read('stockroom-hide-company') !== '1')
  }, [])

  function pick(t: Theme) {
    setTheme(t)
    if (t === 'device') { delete document.documentElement.dataset.theme; write('stockroom-theme', null) }
    else { document.documentElement.dataset.theme = t; write('stockroom-theme', t) }
  }
  function flipCompact(v: boolean) {
    setCompact(v)
    if (v) document.documentElement.dataset.compact = '1'; else delete document.documentElement.dataset.compact
    write('stockroom-compact', v ? '1' : null)
  }
  function flipCompany(v: boolean) { setCompany(v); write('stockroom-hide-company', v ? null : '1'); tell() }

  return (<>
    <TabHead title="Appearance" desc="How Stockroom looks on this device. Your choices are remembered on this device." />
    <div className="grid gap-3.5 sm:grid-cols-3" role="group" aria-label="Theme">
      {CARDS.map(([t, label, sw]) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => pick(t)}
          className={cx('flex cursor-pointer flex-col items-start gap-2.5 rounded-[14px] bg-bg p-3.5 text-left font-semibold text-ink', theme === t ? 'border-2 border-acc p-[13px]' : 'border border-line')}>
          <span className={cx('block h-16 w-full rounded-lg border', sw)} />{label}
        </button>
      ))}
    </div>
    <div className="mt-2">
      <Row title="Compact tables" desc="Smaller row height, so more rows fit on screen."><Switch on={compact} onChange={flipCompact} label="Compact tables" /></Row>
      <Row title="Show company name in the side bar" desc="Your company name under the Stockroom logo."><Switch on={company} onChange={flipCompany} label="Show company name in the side bar" /></Row>
    </div>
  </>)
}
