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

export function ToastHost() {
  const [m, setM] = useState('')
  useEffect(() => {
    let t: any
    const h = (e: Event) => { setM((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setM(''), 2800) }
    window.addEventListener('toast', h)
    return () => { window.removeEventListener('toast', h); clearTimeout(t) }
  }, [])
  return m ? <div className="toast" role="status">{m}</div> : null
}

export const Hd = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => (
  <div className="hd"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div><div className="btns">{children}</div></div>
)
