'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Hd } from '@/components/ui'
import { SheetTables } from '@/components/Sheet'
import { act, downloadSheet, fmtT, loadSheet, logAct, qn, useLive } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function SheetPage() {
  const { id } = useParams<{ id: string }>()
  const { data: d, err, reload } = useLive(async (sb) => loadSheet(sb, id), ['supplies', 'sheet_rows', 'losses'])
  const [r, setR] = useState({ cust: '', ref: '', qty: '' })
  const [l, setL] = useState({ kind: 'damaged', qty: '', note: '' })
  const [re, setRe] = useState('')
  const [le, setLe] = useState('')
  if (err) return <div><p className="err">{err}</p><Link href="/manager/entry">Back to sheets</Link></div>
  if (!d) return <p className="mute">Loading…</p>
  const s = d.supply, b = d.bal, p = s.products, rem = Number(b.remaining)

  async function start() {
    if (await act(supabaseBrowser().rpc('start_sheet', { p_supply: id }))) { await logAct(`Created the sheet for ${p.name}`); reload() }
  }
  async function addRow() {
    const qty = qn(r.qty), cust = r.cust.trim(), ref = r.ref.trim()
    if (!cust || !ref) return setRe('Enter the customer name and the supply ID.')
    if (!qty) return setRe('Enter a quantity above zero.')
    if (qty > rem) return setRe(`Only ${rem} ${p.unit} left in the store.`)
    setRe('')
    if (!(await act(supabaseBrowser().from('sheet_rows').insert({ supply_id: id, customer: cust, supply_ref: ref, quantity: qty }), 'Added to the sheet', setRe))) return
    await logAct(`${p.name}: supplied ${qty} ${p.unit} to ${cust} (${ref}) from ${s.stores.name}`)
    setR({ cust: '', ref: '', qty: '' }); reload()
  }
  async function addLoss() {
    const qty = qn(l.qty)
    if (!qty) return setLe('Enter a quantity above zero.')
    if (qty > rem) return setLe(`Only ${rem} ${p.unit} left in the store.`)
    setLe('')
    if (!(await act(supabaseBrowser().from('losses').insert({ supply_id: id, kind: l.kind, quantity: qty, note: l.note.trim() || null }), 'Recorded', setLe))) return
    await logAct(`${p.name}: ${qty} ${p.unit} ${l.kind === 'damaged' ? 'damaged' : 'missing'} during supply at ${s.stores.name}`)
    setL({ kind: l.kind, qty: '', note: '' }); reload()
  }

  return (<>
    <Hd title={`Sheet: ${p.name}`} sub={`${s.stores.name}${s.sheet_started_at ? ', started ' + fmtT(s.sheet_started_at) : ''}`}>
      <Link className="btn ghost sm" style={{ textDecoration: 'none' }} href="/manager/entry">All sheets</Link>
      {s.sheet_started_at ? <button className="btn sm" onClick={() => downloadSheet(d)}>Download sheet</button> : null}
    </Hd>
    <div className="panel strip">
      {([[b.assigned, 'Assigned to this store'], [b.supplied, 'Supplied to customers'], [b.damaged_in_supply, 'Damaged in supply'], [b.missing_in_supply, 'Missing in supply'], [b.remaining, 'Remaining in store']] as [number, string][]).map(([v, t]) => <div key={t}><b>{v}</b><span>{t}</span></div>)}
    </div>
    {!s.sheet_started_at ? (
      <div className="panel"><p style={{ marginTop: 0 }}>This sheet has not been created yet.</p><button className="btn sm" onClick={start}>Create sheet</button></div>
    ) : (<>
      <div className="grid">
        <div className="panel"><h2>Record a supply</h2>
          <label>Customer name<input value={r.cust} maxLength={80} onChange={(e) => setR({ ...r, cust: e.target.value })} /></label>
          <label>Supply ID (invoice or sales number)<input value={r.ref} maxLength={40} onChange={(e) => setR({ ...r, ref: e.target.value })} /></label>
          <label>Quantity supplied ({p.unit})<input type="number" min="0" step="any" value={r.qty} onChange={(e) => setR({ ...r, qty: e.target.value })} /></label>
          <p className="err" role="alert">{re}</p><button className="btn" onClick={addRow}>Add to sheet</button></div>
        <div className="panel"><h2>Record damaged or missing</h2>
          <label>Type<select value={l.kind} onChange={(e) => setL({ ...l, kind: e.target.value })}><option value="damaged">Damaged during supply</option><option value="missing">Missing during supply</option></select></label>
          <label>Quantity ({p.unit})<input type="number" min="0" step="any" value={l.qty} onChange={(e) => setL({ ...l, qty: e.target.value })} /></label>
          <label>Note (optional)<input value={l.note} maxLength={120} onChange={(e) => setL({ ...l, note: e.target.value })} /></label>
          <p className="err" role="alert">{le}</p><button className="btn" onClick={addLoss}>Record</button></div>
      </div>
      <div className="panel"><SheetTables rows={d.rows} losses={d.losses} /></div>
    </>)}
  </>)
}
