'use client'
import { downloadSheet, fmtT, loadSheet, useLive } from '@/lib/data'
import { useSort } from '@/components/ui'
import InvoiceSearch from '@/components/InvoiceSearch'

export function SheetTables({ rows, losses }: { rows: any[]; losses: any[] }) {
  const s = useSort(rows, { date: (r) => r.created_at, customer: (r) => r.customer, ref: (r) => r.supply_ref, qty: (r) => Number(r.quantity) }, { k: 'date', d: -1 })
  return (<>
    <h2>Supplies to customers</h2>
    {rows.length ? (
      <div className="wrap"><table>
        <thead><tr>{s.th('date', 'Date')}{s.th('customer', 'Customer')}{s.th('ref', 'Supply ID')}{s.th('qty', 'Qty', 'n')}<th>By</th></tr></thead>
        <tbody>{s.rows.map((r) => <tr key={r.id}><td>{fmtT(r.created_at)}</td><td>{r.customer}</td><td>{r.supply_ref}</td><td className="n">{r.quantity}</td><td>{r.profiles?.full_name ?? ''}</td></tr>)}</tbody>
      </table></div>
    ) : <p className="mute m-0">Nothing recorded yet.</p>}
    <h2 className="mt-[18px]">Damaged and missing during supply</h2>
    {losses.length ? (
      <div className="wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th className="n">Qty</th><th>Note</th><th>By</th></tr></thead>
        <tbody>{losses.map((l) => <tr key={l.id}><td>{fmtT(l.created_at)}</td><td>{l.kind === 'damaged' ? 'Damaged' : 'Missing'}</td><td className="n">{l.quantity}</td><td className="w">{l.note ?? ''}</td><td>{l.profiles?.full_name ?? ''}</td></tr>)}</tbody>
      </table></div>
    ) : <p className="mute m-0">None recorded.</p>}
  </>)
}

// Read-only sheet for the admin, updating live as the manager records entries.
export function AdminSheet({ supplyId, onClose, onOpen }: { supplyId: string; onClose: () => void; onOpen: (supplyId: string) => void }) {
  const { data: d, err } = useLive(async (sb) => loadSheet(sb, supplyId), ['sheet_rows', 'losses', 'supplies'])
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const s = d.supply, b = d.bal, u = s.products.unit
  return (<>
    <InvoiceSearch onOpen={onOpen} />
    <p className="mute mt-0">
      {s.sheet_started_at ? `Sheet started ${fmtT(s.sheet_started_at)}. ` : 'The store manager has not started a sheet yet. '}
      Assigned to store {s.quantity}, supplied {b.supplied}, damaged {b.damaged_in_supply}, missing {b.missing_in_supply}. <b>Remaining {b.remaining} {u}</b>
    </p>
    <SheetTables rows={d.rows} losses={d.losses} />
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Close</button><button className="btn" onClick={() => downloadSheet(d)}>Download CSV</button></div>
  </>)
}
