'use client'
import { useEffect, useState } from 'react'
import { fmtT, q } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

/** Admin search: find every supply entry by its invoice or sales number. */
export default function InvoiceSearch({ onOpen }: { onOpen: (supplyId: string) => void }) {
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = term.trim()
    if (!t) { setRows(null); setErr(''); setBusy(false); return }
    let stale = false
    const h = setTimeout(async () => {
      setBusy(true); setErr('')
      try {
        const safe = t.replace(/[\\%_]/g, '\\$&')
        const data = await q(
          supabaseBrowser().from('sheet_rows')
            .select('id, supply_id, supply_ref, customer, quantity, created_at, profiles(full_name), supplies(products(name, unit, container_no), stores(name))')
            .ilike('supply_ref', `%${safe}%`)
            .order('created_at', { ascending: false })
            .limit(50),
        )
        if (!stale) setRows(data)
      } catch (e: any) {
        if (!stale) setErr(e.message ?? 'Search failed')
      } finally {
        if (!stale) setBusy(false)
      }
    }, 300)
    return () => { stale = true; clearTimeout(h) }
  }, [term])

  const exact = (r: any) => r.supply_ref.trim().toLowerCase() === term.trim().toLowerCase()
  return (
    <div className="panel mb-4">
      <h2>Find a supply by invoice or sales number</h2>
      <label htmlFor="inv-search" className="sr">Invoice or sales number</label>
      <input id="inv-search" type="search" value={term} autoComplete="off" placeholder="Type an invoice or sales number, for example INV-1003" onChange={(e) => setTerm(e.target.value)} />
      <p className="mute mt-2 mb-0 min-h-5 text-[13px]" role="status">
        {busy ? 'Searching…' : err ? '' : rows ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} found` : 'Search finds every entry managers recorded with that number.'}
      </p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      {rows && rows.length ? (
        <div className="wrap mt-2.5"><table>
          <thead><tr><th>Supply ID</th><th>Customer</th><th>Product</th><th>Store</th><th className="n">Quantity</th><th>Date</th><th>Entered by</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><b>{r.supply_ref}</b> {exact(r) ? <span className="chip">Exact</span> : null}</td>
              <td>{r.customer}</td>
              <td>{r.supplies?.products?.name}<span className="mute"> ({r.supplies?.products?.container_no})</span></td>
              <td>{r.supplies?.stores?.name}</td>
              <td className="n">{r.quantity} {r.supplies?.products?.unit}</td>
              <td>{fmtT(r.created_at)}</td>
              <td>{r.profiles?.full_name}</td>
              <td><button className="btn ghost sm" onClick={() => onOpen(r.supply_id)}>Open sheet</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {rows && !rows.length && !busy ? <p className="mute mt-2.5 mb-0">No supply entry matches “{term.trim()}”. Check the number and try again.</p> : null}
    </div>
  )
}