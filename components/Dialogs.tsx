'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui'
import { useSettings } from '@/components/SettingsProvider'
import { act, localDay, logAct, num, r3 } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

export type ProdRow = { id: string; name: string; container_no: string; date_arrived: string; unit: string; total: number; damaged_offload: number; missing_before_offload: number; net: number; alloc: number; free: number }
export type StoreRow = { id: string; name: string; active: boolean }
export type SupplyEdit = { id: string; product_id: string; store_id: string; quantity: number; used: number }

function ProductForm({ product, onClose, onSaved }: { product?: ProdRow; onClose: () => void; onSaved: () => void }) {
  const settings = useSettings() // default unit and whether the arrival date is required
  const [f, setF] = useState({ name: product?.name ?? '', container: product?.container_no ?? '', arrived: product?.date_arrived ?? localDay(new Date()), unit: product?.unit ?? settings.defaultUnit, total: product ? String(product.total) : '', dmg: String(product?.damaged_offload ?? 0), miss: String(product?.missing_before_offload ?? 0) })
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const net = r3(num(f.total) - num(f.dmg) - num(f.miss))
  async function save() {
    const name = f.name.trim(), cont = f.container.trim(), t = Number(f.total), d = Number(f.dmg) || 0, m = Number(f.miss) || 0
    if (!name) return setErr('Enter a product name.')
    if (!cont) return setErr('Enter the container number.')
    if (!f.arrived && settings.requireArrival) return setErr('Enter the date the product arrived.')
    if (f.arrived > localDay(new Date())) return setErr('The arrival date cannot be in the future.')
    if (!(t > 0)) return setErr('Enter the total amount.')
    if (d < 0 || m < 0) return setErr('Damaged and missing amounts cannot be negative.')
    if (t - d - m <= 0) return setErr('Nothing is left to supply after the damaged and missing amounts.')
    if (product && r3(t - d - m) < product.alloc) return setErr(`${product.alloc} ${product.unit} is already in stores, more than ${r3(t - d - m)}.`)
    const unit = f.unit.trim() || settings.defaultUnit
    const row = { name, container_no: cont, date_arrived: f.arrived || localDay(new Date()), unit, total: t, damaged_offload: d, missing_before_offload: m }
    const sb = supabaseBrowser()
    const ok = product
      ? await act(sb.from('products').update(row).eq('id', product.id), 'Product updated', setErr)
      : await act(sb.from('products').insert(row), `Product created. ${net} ${unit} ready to add to a store.`, setErr)
    if (!ok) return
    await logAct(product ? `Updated product ${name} (container ${cont})` : `Created product ${name} (container ${cont}): ${net} ${unit} to be supplied`)
    onSaved(); onClose()
  }
  return (<>
    <label>Product name<input value={f.name} onChange={set('name')} maxLength={80} /></label>
    <label>Container number<input value={f.container} onChange={set('container')} maxLength={40} /></label>
    <label>Date arrived{settings.requireArrival ? '' : ' (optional)'}<input type="date" value={f.arrived} max={localDay(new Date())} onChange={set('arrived')} /></label>
    <label>Unit (carton, kg, liters, pieces)<input value={f.unit} onChange={set('unit')} maxLength={20} /></label>
    <label>Total amount in the container<input type="number" min="0" step="any" value={f.total} onChange={set('total')} /></label>
    <label>Damaged on offload<input type="number" min="0" step="any" value={f.dmg} onChange={set('dmg')} /></label>
    <label>Missing before offload<input type="number" min="0" step="any" value={f.miss} onChange={set('miss')} /></label>
    <div className={'calc' + (net <= 0 ? ' neg' : '')}><span>Amount to be supplied</span><b>{net}</b></div>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
  </>)
}

export function ProductDialog({ open, onClose, onSaved, product }: { open: boolean; onClose: () => void; onSaved: () => void; product?: ProdRow }) {
  return (<Modal open={open} title={product ? 'Edit product' : 'Create product'} onClose={onClose}><ProductForm product={product} onClose={onClose} onSaved={onSaved} /></Modal>)
}

function SupplyForm({ products, stores, supply, preset, onClose, onSaved }: { products: ProdRow[]; stores: StoreRow[]; supply?: SupplyEdit; preset?: string; onClose: () => void; onSaved: () => void }) {
  const cand = supply ? products.filter((p) => p.id === supply.product_id) : products.filter((p) => p.free > 0)
  const open = stores.filter((s) => s.active)
  const [pid, setPid] = useState(supply?.product_id ?? (cand.find((p) => p.id === preset) ?? cand[0])?.id ?? '')
  const [sid, setSid] = useState(supply?.store_id ?? open[0]?.id ?? '')
  const prod = products.find((p) => p.id === pid)
  const max = prod ? r3(prod.free + (supply ? supply.quantity : 0)) : 0
  const [qty, setQty] = useState(String(supply ? supply.quantity : max))
  const [err, setErr] = useState('')
  const pick = (id: string) => { setPid(id); setQty(String(products.find((x) => x.id === id)?.free ?? 0)) }
  async function save() {
    const n = Number(qty)
    if (!prod) return setErr('Choose a product.')
    if (!supply && !sid) return setErr('Choose a store.')
    if (!(n > 0)) return setErr('Enter a quantity above zero.')
    if (n > max) return setErr(`Only ${max} ${prod.unit} available to assign.`)
    if (supply && n < supply.used) return setErr(`The manager has already recorded ${supply.used} ${prod.unit}, which is more than this.`)
    const sb = supabaseBrowser()
    const ok = supply
      ? await act(sb.from('supplies').update({ quantity: n }).eq('id', supply.id), 'Quantity updated', setErr)
      : await act(sb.from('supplies').insert({ product_id: pid, store_id: sid, quantity: n }), 'Product added to store', (m) => setErr(m === 'That already exists.' ? 'This product is already in that store. Edit its quantity instead.' : m))
    if (!ok) return
    await logAct(supply ? `Changed ${prod.name} in a store to ${n} ${prod.unit}` : `Added ${n} ${prod.unit} of ${prod.name} to ${stores.find((s) => s.id === sid)?.name}`)
    onSaved(); onClose()
  }
  if (!supply && !cand.length) return <p className="mute">{products.length ? 'Every product is already fully assigned to stores.' : 'Create a product first.'}</p>
  return (<>
    {supply ? <p className="mute mt-0">{prod?.name}</p> : (<>
      <label>Product<select value={pid} onChange={(e) => pick(e.target.value)}>{cand.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.container_no})</option>)}</select></label>
      <label>Store or warehouse<select value={sid} onChange={(e) => setSid(e.target.value)}>{open.length ? open.map((s) => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">No active stores</option>}</select></label>
    </>)}
    <div className="note">Available to assign: {max} {prod?.unit} (of {prod?.net} to be supplied)</div>
    <label>Quantity to supply to this store<input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
  </>)
}

export function SupplyDialog(p: { open: boolean; onClose: () => void; onSaved: () => void; products: ProdRow[]; stores: StoreRow[]; supply?: SupplyEdit; preset?: string }) {
  return (<Modal open={p.open} title={p.supply ? 'Edit quantity in store' : 'Add product to a store'} onClose={p.onClose}>
    <SupplyForm products={p.products} stores={p.stores} supply={p.supply} preset={p.preset} onClose={p.onClose} onSaved={p.onSaved} />
  </Modal>)
}
