'use client'
import Link from 'next/link'
import { Chip, Hd } from '@/components/ui'
import { fmtT, level, q, sum, useLive } from '@/lib/data'

export default function ManagerDashboard() {
  const { data: d, err } = useLive<any>(async (sb) => ({
    bal: await q(sb.from('supply_balance').select('*')),
    supplies: await q(sb.from('supplies').select('id, sheet_started_at, products(name, unit)')),
    log: await q(sb.from('activity_log').select('id, message, created_at').order('created_at', { ascending: false }).limit(6)),
  }), ['supplies', 'sheet_rows', 'losses', 'activity_log', 'products'])
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const B = new Map<string, any>(d.bal.map((b: any) => [b.supply_id, b]))
  const bal: any[] = d.bal
  return (<>
    <Hd title="My store" sub={<><span className="chip">Live</span> What is left of each product.</>} />
    <div className="panel strip">
      {([[d.supplies.length, 'Products to supply'], [sum(bal, (b) => Number(b.supplied)), 'Supplied to customers'], [sum(bal, (b) => Number(b.damaged_in_supply) + Number(b.missing_in_supply)), 'Lost during supply'], [sum(bal, (b) => Number(b.remaining)), 'Left in store']] as [number, string][]).map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
    </div>
    {d.supplies.length ? (
      <div className="cards" style={{ marginBottom: 16 }}>{d.supplies.map((s: any) => {
        const b = B.get(s.id); if (!b) return null
        const rem = Number(b.remaining), as = Number(b.assigned)
        return (
          <div key={s.id} className="panel">
            <div className="row"><b>{s.products?.name}</b><Chip s={level(as, rem)} /></div>
            <div className="big">{rem}<small> {s.products?.unit} left</small></div>
            <div className="bar"><i style={{ width: Math.max(0, Math.min(100, (rem / as) * 100)) + '%' }} /></div>
            <div className="row mute" style={{ fontSize: 13, margin: '6px 0 12px' }}><span>Supplied {b.supplied}</span><span>Lost {Number(b.damaged_in_supply) + Number(b.missing_in_supply)}</span></div>
            <Link className="btn sm" style={{ display: 'inline-block', textDecoration: 'none' }} href={`/manager/entry/${s.id}`}>{s.sheet_started_at ? 'Open sheet' : 'Create sheet'}</Link>
          </div>)
      })}</div>
    ) : <div className="panel mute" style={{ marginBottom: 16 }}>No products are assigned to your store yet. The admin assigns each product and its quantity, and it shows up here.</div>}
    <div className="panel"><h2>Your recent entries</h2>
      {d.log.length ? <div className="wrap"><table><thead><tr><th>When</th><th>Entry</th></tr></thead><tbody>{d.log.map((l: any) => <tr key={l.id}><td>{fmtT(l.created_at)}</td><td className="w">{l.message}</td></tr>)}</tbody></table></div> : <p className="mute" style={{ margin: 0 }}>Nothing recorded yet.</p>}
    </div>
  </>)
}
