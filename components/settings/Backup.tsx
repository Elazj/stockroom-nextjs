'use client'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui'
import { csv, download, friendly, localDay, q, toast } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { DangerBox, TabHead } from './shared'

const TABLES = ['stores', 'products', 'supplies', 'sheet_rows', 'losses', 'gifts', 'reports', 'activity_log'] as const
const FORMAT = 'stockroom-backup-1'
const LABELS: Record<string, string> = { stores: 'stores', products: 'products', supplies: 'supplies', sheet_rows: 'sheet entries', losses: 'damaged or missing entries', gifts: 'gifts', reports: 'reports', activity_log: 'activity records' }

// The database returns at most 1000 rows per request, so read page by page.
async function fetchAll(table: string) {
  const sb = supabaseBrowser()
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const page = await q(sb.from(table).select('*').order('id').range(from, from + 999))
    out.push(...page)
    if (page.length < 1000) return out
  }
}

function RestoreBody({ file, backup, onClose }: { file: string; backup: any; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (text.trim() !== 'RESTORE') return setErr('Type RESTORE to confirm.')
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().rpc('restore_company_backup', { p: backup })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    toast('Backup restored')
    setTimeout(() => { location.href = '/admin' }, 700)
    onClose()
  }
  return (<>
    <p className="mt-0">Restore <b>{file}</b>, made {backup.createdAt ? new Date(backup.createdAt).toLocaleString() : 'at an unknown time'}. It contains:</p>
    <ul className="mt-0 pl-5 text-[14px]">{TABLES.map((t) => <li key={t}>{(backup[t] ?? []).length} {LABELS[t]}</li>)}</ul>
    <p className="mute">Everything your company has now is replaced by this backup. Manager accounts are kept. This cannot be undone, so download a backup of the current data first if you might need it.</p>
    <label>Type RESTORE to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" /></label>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Restoring…' : 'Restore backup'}</button></div>
  </>)
}

function ResetBody({ onClose }: { onClose: () => void }) {
  const [wipe, setWipe] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (text.trim() !== 'RESET') return setErr('Type RESET to confirm.')
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().rpc('reset_all_data', { wipe_accounts: wipe })
    setBusy(false)
    if (error) {
      return setErr(/could not find the function|schema cache/i.test(error.message)
        ? 'The reset function is missing or outdated in your database. Run supabase/migration-007.sql in the Supabase SQL editor, then try again.'
        : error.message)
    }
    toast('Everything has been cleared')
    setTimeout(() => { location.href = '/admin' }, 700)
    onClose()
  }
  return (<>
    <p className="mute mt-0">This permanently deletes every store, product, supply, sheet entry, gift, report and activity record of your company. Other companies are not affected. It cannot be undone.</p>
    <label className="flex items-center gap-2">
      <input type="checkbox" className="m-0 w-auto" checked={wipe} onChange={(e) => setWipe(e.target.checked)} /> Also delete all store manager accounts of this company
    </label>
    <label>Type RESET to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" /></label>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Resetting…' : 'Reset everything'}</button></div>
  </>)
}

export default function Backup() {
  const [last, setLast] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [picked, setPicked] = useState<{ file: string; backup: any } | null>(null)
  const [reset, setReset] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { try { setLast(localStorage.getItem('stockroom-last-backup') ?? '') } catch {} }, [])

  async function backup() {
    setBusy('backup'); setMsg('')
    try {
      const sb = supabaseBrowser()
      const company = (await q(sb.from('companies').select('name').limit(1)))?.[0]?.name ?? ''
      const out: any = { format: FORMAT, createdAt: new Date().toISOString(), company }
      for (const t of TABLES) out[t] = await fetchAll(t)
      download(`stockroom-backup-${localDay(new Date())}.json`, JSON.stringify(out))
      const when = new Date().toLocaleString()
      try { localStorage.setItem('stockroom-last-backup', when) } catch {}
      setLast(when); toast('Backup downloaded')
    } catch (e: any) { setMsg(e.message ?? 'Could not make the backup.') }
    setBusy('')
  }

  async function products() {
    setBusy('csv'); setMsg('')
    try {
      const rows = await fetchAll('products')
      download(`products-${localDay(new Date())}.csv`, csv([
        ['Name', 'Container no.', 'Date arrived', 'Unit', 'Total', 'Damaged at offload', 'Missing before offload', 'Net'],
        ...rows.map((p) => [p.name, p.container_no, p.date_arrived ?? '', p.unit, p.total, p.damaged_offload, p.missing_before_offload, p.net]),
      ]))
    } catch (e: any) { setMsg(e.message ?? 'Could not export the products.') }
    setBusy('')
  }

  async function choose(f?: File) {
    if (!f) return
    setMsg('')
    try {
      const b = JSON.parse(await f.text())
      if (b?.format !== FORMAT) return setMsg('This file is not a Stockroom backup.')
      setPicked({ file: f.name, backup: b })
    } catch { setMsg('This file could not be read. Choose a backup made by Download full backup.') }
    if (input.current) input.current.value = ''
  }

  return (<>
    <TabHead title="Backup & Restore" desc="Keep a copy of your company data, or start over." />
    <h3 className="m-0 text-[15px]">Download a backup</h3>
    <p className="mb-3 mt-1 text-[13px] text-mute">{last ? `Last backup made on this device: ${last}` : 'No backup made on this device yet.'} A backup has your stores, products, supplies, entries, gifts, reports and activity. It does not contain passwords or accounts.</p>
    <div className="flex flex-wrap gap-3">
      <button className="btn" disabled={!!busy} onClick={backup}>{busy === 'backup' ? 'Preparing…' : 'Download full backup'}</button>
      <button className="btn ghost" disabled={!!busy} onClick={products}>{busy === 'csv' ? 'Preparing…' : 'Export products (CSV)'}</button>
    </div>
    <h3 className="mb-0 mt-7 text-[15px]">Restore from a backup</h3>
    <p className="mb-3 mt-1 text-[13px] text-mute">Choose a backup file made here. Restoring replaces your current data.</p>
    <input ref={input} type="file" accept="application/json,.json" aria-label="Backup file" onChange={(e) => choose(e.target.files?.[0])} className="m-0 text-[13px]" />
    <p className="err mt-3" role="alert">{msg}</p>
    <DangerBox title="Reset all data" text="Clears every store, product, supply, sheet, gift and report of your company.">
      <button className="btn danger" onClick={() => setReset(true)}>Reset data</button>
    </DangerBox>
    <Modal open={!!picked} title="Restore backup" onClose={() => setPicked(null)}>{picked ? <RestoreBody file={picked.file} backup={picked.backup} onClose={() => setPicked(null)} /> : null}</Modal>
    <Modal open={reset} title="Reset all data" onClose={() => setReset(false)}><ResetBody onClose={() => setReset(false)} /></Modal>
  </>)
}
