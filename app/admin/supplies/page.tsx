'use client'
import { useState } from 'react'
import { Chip, Confirm, Hd, Modal, useSort } from '@/components/ui'
import { SupplyDialog, type ProdRow, type SupplyEdit } from '@/components/Dialogs'
import { AdminSheet } from '@/components/Sheet'
import { level, logAct, q, r3, remove, sum, useLive } from '@/lib/data'

export default function Supplies() {
  const { data: d, err, reload } = useLive<any>(async (sb) => ({
    supplies: await q(sb.from('supplies').select('id, product_id, store_id, quantity')),
    bal: await q(sb.from('supply_balance').select('*')),
    products: await q(sb.from('products').select('*')),
    stores: await q(sb.from('stores').select('id, name, active')),
  }), ['supplies', 'sheet_rows', 'losses', 'products', 'stores'])
  const [store, setStore] = useState('')
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [edit, setEdit] = useState<SupplyEdit | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [del, setDel] = useState<any>(null)
  const pm = new Map<string, any>((d?.products ?? []).map((p: any) => [p.id, p]))
  const sm = new Map<string, string>((d?.stores ?? []).map((x: any) => [x.id, x.name]))
  const prodRows: ProdRow[] = (d?.products ?? []).map((p: any) => {
    const alloc = sum((d.supplies as any[]).filter((s) => s.product_id === p.id), (s) => Number(s.quantity))
    return { ...p, total: Number(p.total), net: Number(p.net), alloc, free: r3(Number(p.net) - alloc) }
  })
  const rows = (d?.bal ?? []).filter((b: any) => (!store || b.store_id === store) && (!text || (pm.get(b.product_id)?.name ?? '').toLowerCase().includes(text.toLowerCase())))
  const s = useSort<any>(rows, {
    store: (b) => sm.get(b.store_id) ?? '', product: (b) => pm.get(b.product_id)?.name ?? '', container: (b) => pm.get(b.product_id)?.container_no ?? '',
    assigned: (b) => Number(b.assigned), supplied: (b) => Number(b.supplied), remaining: (b) => Number(b.remaining),
  })
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const startEdit = (b: any) => setEdit({ id: b.supply_id, product_id: b.product_id, store_id: b.store_id, quantity: Number(b.assigned), used: r3(Number(b.supplied) + Number(b.damaged_in_supply) + Number(b.missing_in_supply)) })
  const sheetRow = d.bal.find((b: any) => b.supply_id === sheet)
  return (<>
    <Hd title="Supplies" sub="Products added to stores. Remaining amounts update as managers record supplies."><button className="btn" onClick={() => setAdding(true)}>Add product to store</button></Hd>
    <div className="filters">
      <select value={store} onChange={(e) => setStore(e.target.value)}><option value="">All stores</option>{d.stores.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <input placeholder="Search product" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
    <div className="panel">
      {s.rows.length ? <div className="wrap"><table>
        <thead><tr>{s.th('store', 'Store')}{s.th('product', 'Product')}{s.th('container', 'Container')}{s.th('assigned', 'In store', 'n')}{s.th('supplied', 'Supplied', 'n')}<th className="n">Damaged in supply</th><th className="n">Missing in supply</th>{s.th('remaining', 'Remaining', 'n')}<th>Status</th><th /></tr></thead>
        <tbody>{s.rows.map((b) => <tr key={b.supply_id}>
          <td>{sm.get(b.store_id)}</td><td>{pm.get(b.product_id)?.name}</td><td>{pm.get(b.product_id)?.container_no}</td>
          <td className="n">{b.assigned}</td><td className="n">{b.supplied}</td><td className="n">{b.damaged_in_supply}</td><td className="n">{b.missing_in_supply}</td>
          <td className="n"><b>{b.remaining}</b> {pm.get(b.product_id)?.unit}</td><td><Chip s={level(Number(b.assigned), Number(b.remaining))} /></td>
          <td><div className="btns"><button className="btn ghost sm" onClick={() => setSheet(b.supply_id)}>Sheet</button><button className="btn ghost sm" onClick={() => startEdit(b)}>Edit</button><button className="btn ghost sm" onClick={() => setDel(b)}>Remove</button></div></td></tr>)}</tbody>
      </table></div> : <p className="mute m-0">{d.bal.length ? 'No supplies match these filters.' : 'Nothing is in a store yet. Create a product under Products, then add it to a store here.'}</p>}
    </div>
    <SupplyDialog open={adding} products={prodRows} stores={d.stores} onClose={() => setAdding(false)} onSaved={reload} />
    <SupplyDialog open={!!edit} supply={edit ?? undefined} products={prodRows} stores={d.stores} onClose={() => setEdit(null)} onSaved={reload} />
    <Modal open={!!sheet} wide title={sheetRow ? `${pm.get(sheetRow.product_id)?.name ?? 'Sheet'}, ${sm.get(sheetRow.store_id) ?? ''}` : 'Sheet'} onClose={() => setSheet(null)}>
      {sheet ? <AdminSheet key={sheet} supplyId={sheet} onClose={() => setSheet(null)} onOpen={setSheet} /> : null}
    </Modal>
    <Confirm open={!!del} title="Remove from store" label="Remove" onClose={() => setDel(null)}
      text={`Remove ${pm.get(del?.product_id)?.name ?? 'this product'} from ${sm.get(del?.store_id) ?? 'the store'}? Its sheet and every entry are deleted, and the quantity becomes available to assign again.`}
      onConfirm={async () => { const e = await remove('supplies', del.supply_id); if (!e) { await logAct(`Removed ${pm.get(del.product_id)?.name} from ${sm.get(del.store_id)}`); reload() } return e }} />
  </>)
}
