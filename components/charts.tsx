'use client'
import { useEffect, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

type Colors = { acc: string; warn: string; bad: string; ink: string; mute: string; line: string; panel: string; font: string }
const FALLBACK: Colors = { acc: '#1673BB', warn: '#B76E00', bad: '#B3322B', ink: '#0F2A3D', mute: '#53708A', line: '#CDE2F2', panel: '#FFFFFF', font: 'system-ui, sans-serif' }

export const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Reads the theme colors from the page so charts follow dark and light mode.
function useColors(): Colors {
  const [c, setC] = useState<Colors>(FALLBACK)
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement)
      const g = (n: string, d: string) => s.getPropertyValue(n).trim() || d
      setC({ acc: g('--acc', FALLBACK.acc), warn: g('--warn', FALLBACK.warn), bad: g('--bad', FALLBACK.bad), ink: g('--ink', FALLBACK.ink), mute: g('--mute', FALLBACK.mute), line: g('--line', FALLBACK.line), panel: g('--panel', FALLBACK.panel), font: getComputedStyle(document.body).fontFamily || FALLBACK.font })
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', read)
    return () => { mo.disconnect(); mq.removeEventListener('change', read) }
  }, [])
  return c
}

const base = (c: Colors, legend = true): any => ({
  responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: legend, position: 'bottom', labels: { color: c.mute, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: c.font, size: 12 } } },
    tooltip: { backgroundColor: c.ink, titleColor: c.panel, bodyColor: c.panel, padding: 10, cornerRadius: 10, boxPadding: 4, titleFont: { family: c.font, weight: '600' }, bodyFont: { family: c.font } },
  },
})
const scale = (c: Colors, grid: boolean, stacked = false): any => ({
  stacked, grid: { display: grid, color: rgba(c.line, 0.9) }, border: { display: false },
  ticks: { color: c.mute, precision: 0, font: { family: c.font, size: 11 } },
})

const centerText = {
  id: 'center',
  afterDraw(chart: any, _args: any, opts: any) {
    if (!opts) return
    const { ctx, chartArea: { left, right, top, bottom } } = chart
    const x = (left + right) / 2, y = (top + bottom) / 2
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = opts.color; ctx.font = `600 28px ${opts.font}`; ctx.fillText(opts.text, x, y - 8)
    ctx.fillStyle = opts.sub; ctx.font = `12px ${opts.font}`; ctx.fillText(opts.label, x, y + 16)
    ctx.restore()
  },
}

const Empty = ({ text }: { text: string }) => <p className="mute m-0">{text}</p>

/** Smooth area chart: supplied to customers vs damaged or missing, per day. */
export function SupplyLossChart({ labels, supplied, lost }: { labels: string[]; supplied: number[]; lost: number[] }) {
  const c = useColors()
  const area = (hex: string) => (ctx: any) => {
    const a = ctx.chart.chartArea
    if (!a) return rgba(hex, 0.1)
    const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom)
    g.addColorStop(0, rgba(hex, 0.32)); g.addColorStop(1, rgba(hex, 0))
    return g
  }
  const ds = (label: string, data: number[], hex: string) => ({ label, data, borderColor: hex, backgroundColor: area(hex), fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: hex, pointBorderColor: c.panel, pointBorderWidth: 2 })
  const o = base(c); o.scales = { x: scale(c, false), y: { ...scale(c, true), beginAtZero: true } }
  return <div className="chart"><Line data={{ labels, datasets: [ds('Supplied to customers', supplied, c.acc), ds('Damaged or missing', lost, c.warn)] }} options={o} /></div>
}

type Tone = 'acc' | 'warn' | 'bad' | 'mute'
function Donut({ labels, values, tones, total, caption }: { labels: string[]; values: number[]; tones: Tone[]; total: number | string; caption: string }) {
  const c = useColors()
  const o = base(c); o.cutout = '72%'; o.interaction = { mode: 'nearest', intersect: true }
  o.plugins.center = { text: String(total), label: caption, color: c.ink, sub: c.mute, font: c.font }
  const color = (t: Tone) => (t === 'mute' ? rgba(c.mute, 0.45) : c[t])
  return <div className="chart sm"><Doughnut data={{ labels, datasets: [{ data: values, backgroundColor: tones.map(color), borderColor: c.panel, borderWidth: 3, hoverOffset: 6 }] }} options={o} plugins={[centerText]} /></div>
}

/** Health of every store and product pair. */
export function StatusDonut({ ok, low, out }: { ok: number; low: number; out: number }) {
  if (ok + low + out === 0) return <Empty text="Stock health appears once a store has a product." />
  return <Donut labels={['In stock', 'Low', 'Finished']} values={[ok, low, out]} tones={['acc', 'warn', 'bad']} total={ok + low + out} caption="items" />
}

/** Where a store's stock has gone. */
export function StockSplit({ remaining, supplied, damaged, missing }: { remaining: number; supplied: number; damaged: number; missing: number }) {
  if (remaining + supplied + damaged + missing === 0) return <Empty text="Your stock breakdown appears once a product is assigned." />
  return <Donut labels={['Remaining', 'Supplied', 'Damaged', 'Missing']} values={[remaining, supplied, damaged, missing]} tones={['acc', 'mute', 'warn', 'bad']} total={remaining} caption="left in store" />
}

/** Remaining units per store. */
export function StoreBars({ labels, values }: { labels: string[]; values: number[] }) {
  const c = useColors()
  if (!labels.length) return <Empty text="No stores yet." />
  const o = base(c, false); o.scales = { x: scale(c, false), y: { ...scale(c, true), beginAtZero: true } }
  return <div className="chart sm"><Bar data={{ labels, datasets: [{ label: 'Remaining', data: values, backgroundColor: rgba(c.acc, 0.85), hoverBackgroundColor: c.acc, borderRadius: 10, borderSkipped: false, maxBarThickness: 44 }] }} options={o} /></div>
}

/** Best selling products, horizontal. */
export function TopBars({ labels, values }: { labels: string[]; values: number[] }) {
  const c = useColors()
  if (!labels.length) return <Empty text="Customer supplies will rank here." />
  const o = base(c, false); o.indexAxis = 'y'; o.scales = { x: { ...scale(c, true), beginAtZero: true }, y: scale(c, false) }
  return <div className="chart sm"><Bar data={{ labels, datasets: [{ label: 'Supplied', data: values, backgroundColor: rgba(c.acc, 0.85), hoverBackgroundColor: c.acc, borderRadius: 8, borderSkipped: false, maxBarThickness: 26 }] }} options={o} /></div>
}

/** Actual daily use against one-day-ahead forecasts from each method. */
export function ForecastLines({ labels, actual, sma, ses }: { labels: string[]; actual: number[]; sma: (number | null)[]; ses: (number | null)[] }) {
  const c = useColors()
  const o = base(c); o.scales = { x: scale(c, false), y: { ...scale(c, true), beginAtZero: true } }
  const line = (label: string, data: (number | null)[], hex: string, dash?: number[]) => ({ label, data, borderColor: hex, backgroundColor: hex, tension: 0.3, borderWidth: 2, pointRadius: 0, borderDash: dash, spanGaps: false })
  return <div className="chart"><Line data={{ labels, datasets: [line('Actual use', actual, c.ink), line('Moving average', sma, c.acc, [5, 4]), line('Exponential smoothing', ses, c.warn, [2, 3])] }} options={o} /></div>
}

/** Per product breakdown for a store manager. */
export function ProductStack({ labels, remaining, supplied, damaged, missing }: { labels: string[]; remaining: number[]; supplied: number[]; damaged: number[]; missing: number[] }) {
  const c = useColors()
  if (!labels.length) return <Empty text="Products assigned to your store will appear here." />
  const o = base(c); o.scales = { x: scale(c, false, true), y: { ...scale(c, true, true), beginAtZero: true } }
  const ds = (label: string, data: number[], color: string) => ({ label, data, backgroundColor: color, borderRadius: 6, borderSkipped: false, maxBarThickness: 46 })
  return <div className="chart"><Bar data={{ labels, datasets: [ds('Remaining', remaining, c.acc), ds('Supplied', supplied, rgba(c.mute, 0.45)), ds('Damaged', damaged, c.warn), ds('Missing', missing, c.bad)] }} options={o} /></div>
}
