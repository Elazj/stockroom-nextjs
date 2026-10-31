'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Hd, Modal } from '@/components/ui'
import { act, downloadSheet, loadSheet, logAct, q, toast, useLive } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function Entry() {
  const router = useRouter()
  const { data: d, err } = useLive<any>(async (sb) => ({
    supplies: await q(sb.from('supplies').select('id, sheet_started_at, products(name, unit)')),
    bal: await q(sb.from('supply_balance').select('*')),
    rows: await q(sb.from('sheet_rows').select('supply_id')),
  }), ['supplies', 'sheet_rows', 'losses'])
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState('')
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const B = new Map<string, any>(d.bal.map((b: any) => [b.supply_id, b]))
  const made = d.supplies.filter((s: any) => s.sheet_started_at)
  const free = d.supplies.filter((s: any) => !s.sheet_started_at)
  async function create() {
    const id = pick || free[0]?.id
    if (!id) return
    if (!(await act(supabaseBrowser().rpc('start_sheet', { p_supply: id }), undefined, setMsg))) return
    await logAct(`Created the sheet for ${free.find((s: any) => s.id === id)?.products?.name}`)
    router.push(`/manager/entry/${id}`)
  }
  async function dl(id: string) {
    try { downloadSheet(await loadSheet(supabaseBrowser(), id)) } catch (e: any) { toast(e.message) }
  }
  return (<>
    <Hd title="Daily entry" sub="One sheet for each product you supply"><button className="btn" onClick={() => { setPick(''); setMsg(''); if (!free.length) toast(d.supplies.length ? 'Every product assigned to you already has a sheet.' : 'No products are assigned to you yet.'); else setOpen(true) }}>New sheet</button></Hd>
    <div className="panel">
      {made.length ? <div className="wrap"><table>
        <thead><tr><th>Product</th><th className="n">Entries</th><th className="n">Supplied</th><th className="n">Damaged</th><th className="n">Missing</th><th className="n">Left</th><th /></tr></thead>
        <tbody>{made.map((s: any) => { const b = B.get(s.id) ?? {}; return (
          <tr key={s.id}><td>{s.products?.name}</td><td className="n">{d.rows.filter((r: any) => r.supply_id === s.id).length}</td><td className="n">{b.supplied}</td><td className="n">{b.damaged_in_supply}</td><td className="n">{b.missing_in_supply}</td>
            <td className="n"><b>{b.remaining}</b> {s.products?.unit}</td>
            <td><div className="btns"><Link className="btn sm" style={{ textDecoration: 'none' }} href={`/manager/entry/${s.id}`}>Open</Link><button className="btn ghost sm" onClick={() => dl(s.id)}>Download</button></div></td></tr>) })}</tbody>
      </table></div> : <p className="mute" style={{ margin: 0 }}>{d.supplies.length ? 'No sheets yet. Choose New sheet to start one for a product assigned to you.' : 'No products are assigned to you yet. The admin assigns each product and its quantity.'}</p>}
    </div>
    <Modal open={open} title="New sheet" onClose={() => setOpen(false)}>
      <label>Product<select value={pick || free[0]?.id || ''} onChange={(e) => setPick(e.target.value)}>{free.map((s: any) => <option key={s.id} value={s.id}>{s.products?.name} ({s.products?.unit})</option>)}</select></label>
      <p className="mute" style={{ marginTop: 0 }}>The sheet is named after the product. The admin set its assigned quantity.</p>
      <p className="err" role="alert">{msg}</p>
      <div className="mfoot"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn" onClick={create}>Create sheet</button></div>
    </Modal>
  </>)
}
