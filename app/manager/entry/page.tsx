'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Hd, Modal } from '@/components/ui'
import { downloadSheet, liveCacheKey, loadSheet, logAct, q, SHEET_LIVE, toast, useLive } from '@/lib/data'
import { cacheGet, cacheSet } from '@/lib/offline/idb'
import { browser, recordOrQueue } from '@/lib/offline/record'
import { heldQty } from '@/lib/offline/sync'
import { useOutbox } from '@/lib/offline/useOutbox'

export default function Entry() {
  const router = useRouter()
  const { data: d, err } = useLive<any>(async (sb) => ({
    supplies: await q(sb.from('supplies').select('id, quantity, sheet_started_at, products(name, unit), stores(name)')),
    bal: await q(sb.from('supply_balance').select('*')),
    rows: await q(sb.from('sheet_rows').select('supply_id')),
  }), ['supplies', 'sheet_rows', 'losses'])
  const { items } = useOutbox()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!d) return
    const B = new Map<string, any>(d.bal.map((b: any) => [b.supply_id, b]))
    for (const s of d.supplies) void primeSheet(s, B.get(s.id))
  }, [d])

  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const B = new Map<string, any>(d.bal.map((b: any) => [b.supply_id, b]))
  const made = d.supplies.filter((s: any) => s.sheet_started_at || items.some((x) => x.supplyId === s.id && x.kind === 'start_sheet'))
  const free = d.supplies.filter((s: any) => !s.sheet_started_at && !items.some((x) => x.supplyId === s.id && x.kind === 'start_sheet'))
  async function create() {
    const id = pick || free[0]?.id
    const s = free.find((x: any) => x.id === id) ?? d.supplies.find((x: any) => x.id === id)
    if (!id || !s) return
    const hit = await recordOrQueue({
      kind: 'start_sheet', supplyId: id, log: `Created the sheet for ${s.products?.name}`, payload: { productName: s.products?.name },
    }, () => browser().rpc('start_sheet', { p_supply: id }))
    if (!hit.ok) return setMsg(hit.message)
    if (!hit.queued) await logAct(`Created the sheet for ${s.products?.name}`)
    else toast('Saved on this device. The sheet will sync when you are back online.')
    await primeSheet({ ...s, sheet_started_at: s.sheet_started_at || new Date().toISOString() }, B.get(id), true)
    router.push(`/manager/entry/${id}`)
  }
  async function dl(id: string) {
    try { downloadSheet(await loadSheet(browser(), id)) } catch (e: any) { toast(e.message) }
  }
  return (<>
    <Hd title="Daily entry" sub="One sheet for each product you supply. Entries are kept on this device when you are offline."><button className="btn" onClick={() => { setPick(''); setMsg(''); if (!free.length) toast(d.supplies.length ? 'Every product assigned to you already has a sheet.' : 'No products are assigned to you yet.'); else setOpen(true) }}>New sheet</button></Hd>
    <div className="panel">
      {made.length ? <div className="wrap"><table>
        <thead><tr><th>Product</th><th className="n">Entries</th><th className="n">Supplied</th><th className="n">Damaged</th><th className="n">Missing</th><th className="n">Left</th><th /></tr></thead>
        <tbody>{made.map((s: any) => { const b = B.get(s.id) ?? {}; const waiting = items.filter((x) => x.supplyId === s.id && x.status !== 'conflict').length; const held = heldQty(items, s.id); return (
          <tr key={s.id}><td>{s.products?.name}{waiting ? <span className="chip low ml-2">{waiting} to sync</span> : null}</td><td className="n">{d.rows.filter((r: any) => r.supply_id === s.id).length + items.filter((x) => x.supplyId === s.id && x.kind === 'sheet_row').length}</td><td className="n">{b.supplied}</td><td className="n">{b.damaged_in_supply}</td><td className="n">{b.missing_in_supply}</td>
            <td className="n"><b>{Math.max(0, Number(b.remaining ?? 0) - held)}</b> {s.products?.unit}</td>
            <td><div className="btns"><Link className="btn sm no-underline" href={`/manager/entry/${s.id}`}>Open</Link><button className="btn ghost sm" onClick={() => dl(s.id)}>Download</button></div></td></tr>) })}</tbody>
      </table></div> : <p className="mute m-0">{d.supplies.length ? 'No sheets yet. Choose New sheet to start one for a product assigned to you.' : 'No products are assigned to you yet. The admin assigns each product and its quantity.'}</p>}
    </div>
    <Modal open={open} title="New sheet" onClose={() => setOpen(false)}>
      <label>Product<select value={pick || free[0]?.id || ''} onChange={(e) => setPick(e.target.value)}>{free.map((s: any) => <option key={s.id} value={s.id}>{s.products?.name} ({s.products?.unit})</option>)}</select></label>
      <p className="mute mt-0">The sheet is named after the product. The admin set its assigned quantity.</p>
      <p className="err" role="alert">{msg}</p>
      <div className="mfoot"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn" onClick={create}>Create sheet</button></div>
    </Modal>
  </>)
}

async function primeSheet(s: any, b: any, forceStart = false) {
  if (!s) return
  const key = liveCacheKey(`/manager/entry/${s.id}`, SHEET_LIVE)
  const existing = await cacheGet<any>(key)
  if (existing?.supply) {
    if (forceStart && !existing.supply.sheet_started_at) {
      existing.supply.sheet_started_at = new Date().toISOString()
      await cacheSet(key, existing)
    }
    return
  }
  await cacheSet(key, {
    supply: { id: s.id, quantity: b?.assigned ?? s.quantity, sheet_started_at: forceStart ? new Date().toISOString() : s.sheet_started_at, products: s.products, stores: s.stores ?? { name: 'Your store' } },
    bal: b ?? { supply_id: s.id, assigned: s.quantity ?? 0, supplied: 0, damaged_in_supply: 0, missing_in_supply: 0, remaining: s.quantity ?? 0 },
    rows: [], losses: [],
  })
}
