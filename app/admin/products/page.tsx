'use client'
import { useState } from 'react'
import { Hd, useSort } from '@/components/ui'
import { ProductDialog, SupplyDialog, type ProdRow } from '@/components/Dialogs'
import { q, r3, sum, useLive } from '@/lib/data'

export default function Products() {
  const { data: d, err, reload } = useLive<any>(async (sb) => ({
    products: await q(sb.from('products').select('*').order('created_at', { ascending: false })),
    supplies: await q(sb.from('supplies').select('product_id, quantity')),
    stores: await q(sb.from('stores').select('id, name, active')),
  }), ['products', 'supplies', 'stores'])
  const [edit, setEdit] = useState<ProdRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [addFor, setAddFor] = useState<string | null>(null)
  const rows: ProdRow[] = (d?.products ?? []).map((p: any) => {
    const alloc = sum((d.supplies as any[]).filter((s) => s.product_id === p.id), (s) => Number(s.quantity))
    return { ...p, total: Number(p.total), damaged_offload: Number(p.damaged_offload), missing_before_offload: Number(p.missing_before_offload), net: Number(p.net), alloc, free: r3(Number(p.net) - alloc) }
  })
  const s = useSort(rows, { name: (r) => r.name, container: (r) => r.container_no, total: (r) => r.total, net: (r) => r.net, free: (r) => r.free })
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  return (<>
    <Hd title="Products" sub="Create a product from a container, then add it to a store"><button className="btn" onClick={() => setCreating(true)}>Create product</button></Hd>
    <div className="panel">
      {rows.length ? <div className="wrap"><table>
        <thead><tr>{s.th('name', 'Product')}{s.th('container', 'Container no.')}<th>Unit</th>{s.th('total', 'Total', 'n')}<th className="n">Damaged on offload</th><th className="n">Missing before offload</th>{s.th('net', 'To be supplied', 'n')}<th className="n">In stores</th>{s.th('free', 'Not yet in a store', 'n')}<th /></tr></thead>
        <tbody>{s.rows.map((p) => <tr key={p.id}>
          <td>{p.name}</td><td>{p.container_no}</td><td>{p.unit}</td><td className="n">{p.total}</td><td className="n">{p.damaged_offload}</td><td className="n">{p.missing_before_offload}</td>
          <td className="n"><b>{p.net}</b></td><td className="n">{p.alloc}</td><td className="n">{p.free}</td>
          <td><div className="btns"><button className="btn sm" disabled={p.free <= 0} onClick={() => setAddFor(p.id)}>Add to store</button><button className="btn ghost sm" onClick={() => setEdit(p)}>Edit</button></div></td></tr>)}</tbody>
      </table></div> : <p className="mute" style={{ margin: 0 }}>No products yet. Choose Create product to record your first container.</p>}
    </div>
    <ProductDialog open={creating} onClose={() => setCreating(false)} onSaved={reload} />
    <ProductDialog open={!!edit} product={edit ?? undefined} onClose={() => setEdit(null)} onSaved={reload} />
    <SupplyDialog open={!!addFor} preset={addFor ?? undefined} products={rows} stores={d.stores} onClose={() => setAddFor(null)} onSaved={reload} />
  </>)
}
