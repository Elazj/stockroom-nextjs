'use client'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Level } from '@/lib/data'

export function Modal({ open, title, onClose, wide, children }: { open: boolean; title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (<dialog ref={ref} className={wide ? 'wide' : ''} onClose={onClose}><h2>{title}</h2>{open && children}</dialog>)
}

function ConfirmBody({ text, label, onClose, onConfirm }: { text: string; label: string; onClose: () => void; onConfirm: () => Promise<string> }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (<>
    <p className="mute mt-0">{text}</p>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot">
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); const e = await onConfirm(); setBusy(false); if (e) setErr(e); else onClose() }}>{label}</button>
    </div>
  </>)
}
/** Asks before a delete. onConfirm returns an error message, or '' when it worked. */
export function Confirm(p: { open: boolean; title: string; text: string; label: string; onClose: () => void; onConfirm: () => Promise<string> }) {
  return (<Modal open={p.open} title={p.title} onClose={p.onClose}><ConfirmBody text={p.text} label={p.label} onClose={p.onClose} onConfirm={p.onConfirm} /></Modal>)
}

export function Chip({ s }: { s: Level }) {
  return <span className={'chip ' + s}>{{ ok: 'In stock', low: 'Low', out: 'Finished' }[s]}</span>
}

export function useSort<T>(rows: T[], get: Record<string, (r: T) => string | number>, init?: { k: string; d: 1 | -1 }) {
  const [s, setS] = useState<{ k: string; d: 1 | -1 } | null>(init ?? null)
  const sorted = useMemo(() => {
    if (!s || !get[s.k]) return rows
    const g = get[s.k]
    return [...rows].sort((a, b) => {
      const x = g(a), y = g(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })) * s.d
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, s])
  const th = (k: string, label: string, cls = '') => (
    <th className={cls} aria-sort={s?.k === k ? (s.d > 0 ? 'ascending' : 'descending') : undefined}>
      <button className="sb" onClick={() => setS((p) => (p && p.k === k ? { k, d: (-p.d) as 1 | -1 } : { k, d: 1 }))}>
        {label}{s?.k === k ? (s.d > 0 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
  return { rows: sorted, th }
}

// Uses the browser's top layer so messages show above open dialogs.
export function ToastHost() {
  const [m, setM] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let t: any
    const h = (e: Event) => { setM((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setM(''), 4000) }
    window.addEventListener('toast', h)
    return () => { window.removeEventListener('toast', h); clearTimeout(t) }
  }, [])
  useEffect(() => {
    const el = ref.current as any
    if (!el || !el.showPopover) return
    try { if (el.matches(':popover-open')) el.hidePopover() } catch {}
    try { if (m) el.showPopover() } catch {}
  }, [m])
  return <div ref={ref} popover="manual" className="toast" role="status">{m}</div>
}

export const Hd = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <div className="hd"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div><div className="btns">{children}</div></div>
)
