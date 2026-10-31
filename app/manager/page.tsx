'use client'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { Chip } from '@/components/ui'
import { Kpi } from '@/components/Kpi'
import { ProductStack, StockSplit } from '@/components/charts'
import { fmtT, level, q, sum, useLive } from '@/lib/data'

export default function ManagerDashboard() {
  const { data: d, err } = useLive<any>(async (sb) => ({
    bal: await q(sb.from('supply_balance').select('*')),
    supplies: await q(sb.from('supplies').select('id, sheet_started_at, products(name, unit)')),
    log: await q(sb.from('activity_log').select('id, message, created_at').order('created_at', { ascending: false }).limit(6)),
  }), ['supplies', 'sheet_rows', 'losses', 'activity_log', 'products'])
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const bal: any[] = d.bal
  const B = new Map<string, any>(bal.map((b) => [b.supply_id, b]))
  const rows = d.supplies.map((s: any) => ({ s, b: B.get(s.id) })).filter((x: any) => x.b)
  const n = (k: string) => sum(bal, (b) => Number(b[k]))

  return (<>
    <div className="hero">
      <div><h1>My store</h1><p>What is left of each product, updated live as you record entries.</p></div>
      <span className="live-pill"><i />Live</span>
    </div>
    <div className="kpis">
      <Kpi icon="box" label="Products to supply" value={d.supplies.length} />
      <Kpi icon="send" label="Supplied to customers" value={n('supplied')} />
      <Kpi icon="alert" label="Lost during supply" value={n('damaged_in_supply') + n('missing_in_supply')} tone={n('damaged_in_supply') + n('missing_in_supply') ? 'warn' : undefined} />
      <Kpi icon="archive" label="Left in store" value={n('remaining')} />
    </div>
    <div className="content-grid wide">
      <div className="panel"><h2>Stock by product</h2>
        <ProductStack labels={rows.map((x: any) => x.s.products?.name ?? '')} remaining={rows.map((x: any) => Number(x.b.remaining))} supplied={rows.map((x: any) => Number(x.b.supplied))} damaged={rows.map((x: any) => Number(x.b.damaged_in_supply))} missing={rows.map((x: any) => Number(x.b.missing_in_supply))} /></div>
      <div className="panel"><h2>Where your stock went</h2>
        <StockSplit remaining={n('remaining')} supplied={n('supplied')} damaged={n('damaged_in_supply')} missing={n('missing_in_supply')} /></div>
    </div>
    {rows.length ? (
      <div className="cards mb-4">{rows.map(({ s, b }: any) => {
        const rem = Number(b.remaining), as = Number(b.assigned)
        return (
          <div key={s.id} className="panel">
            <div className="row"><b>{s.products?.name}</b><Chip s={level(as, rem)} /></div>
            <div className="big">{rem}<small> {s.products?.unit} left</small></div>
            <div className="bar"><i className="w-[var(--bar-width)]" style={{ '--bar-width': `${Math.max(0, Math.min(100, (rem / as) * 100))}%` } as CSSProperties} /></div>
            <div className="row mute my-[6px] mb-3 text-[13px]"><span>Supplied {b.supplied}</span><span>Lost {Number(b.damaged_in_supply) + Number(b.missing_in_supply)}</span></div>
            <Link className="btn sm inline-block no-underline" href={`/manager/entry/${s.id}`}>{s.sheet_started_at ? 'Open sheet' : 'Create sheet'}</Link>
          </div>)
      })}</div>
    ) : <div className="panel mute mb-4">No products are assigned to your store yet. The admin assigns each product and its quantity, and it shows up here.</div>}
    <div className="panel"><h2>Your recent entries</h2>
      {d.log.length ? <div className="wrap"><table><thead><tr><th>When</th><th>Entry</th></tr></thead><tbody>{d.log.map((l: any) => <tr key={l.id}><td>{fmtT(l.created_at)}</td><td className="w">{l.message}</td></tr>)}</tbody></table></div> : <p className="mute m-0">Nothing recorded yet.</p>}
    </div>
  </>)
}
