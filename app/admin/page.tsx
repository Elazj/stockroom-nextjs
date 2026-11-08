'use client'
import { Chip } from '@/components/ui'
import { Kpi } from '@/components/Kpi'
import { SupplyLossChart, StatusDonut, StoreBars, TopBars } from '@/components/charts'
import { fmtT, level, localDay, q, sum, useLive } from '@/lib/data'

export default function AdminDashboard() {
  const { data: d, err } = useLive<any>(async (sb) => {
    const since = new Date(Date.now() - 8 * 864e5).toISOString()
    const [bal, products, stores, open, reps, log, rows, losses, gifts, company] = await Promise.all([
      q(sb.from('supply_balance').select('*')), q(sb.from('products').select('*')), q(sb.from('stores').select('*')),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false).then((r: any) => r.count ?? 0),
      q(sb.from('reports').select('id, subject, resolved, profiles(full_name)').order('created_at', { ascending: false }).limit(4)),
      q(sb.from('activity_log').select('id, message, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10)),
      q(sb.from('sheet_rows').select('quantity, created_at').gte('created_at', since)),
      q(sb.from('losses').select('quantity, created_at').gte('created_at', since)),
      q(sb.from('gifts').select('quantity, created_at').gte('created_at', since)),
      q(sb.from('companies').select('name').limit(1)),
    ])
    return { bal, products, stores, open, reps, log, rows, losses, gifts, company: company[0]?.name ?? '' }
  }, ['supplies', 'sheet_rows', 'losses', 'gifts', 'reports', 'activity_log', 'products', 'stores'])
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>

  const B: any[] = d.bal, P: any[] = d.products
  const sName = new Map<string, string>(d.stores.map((s: any) => [s.id, s.name]))
  const pName = new Map<string, string>(P.map((p: any) => [p.id, p.name]))
  const notInStore = sum(P, (p) => Number(p.net)) - sum(B, (b) => Number(b.assigned))
  const damagedOffload = sum(P, (p) => Number(p.damaged_offload))
  const damagedSupply = sum(B, (b) => Number(b.damaged_in_supply))
  const missingOffload = sum(P, (p) => Number(p.missing_before_offload))
  const missingSupply = sum(B, (b) => Number(b.missing_in_supply))
  const lost = damagedOffload + damagedSupply + missingOffload + missingSupply
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => localDay(new Date(Date.now() - n * 864e5)))
  const per = (arr: any[], day: string) => sum(arr.filter((r) => localDay(r.created_at) === day), (r) => Number(r.quantity))
  const labels = days.map((x) => new Date(x + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }))
  const lv = B.map((b) => level(Number(b.assigned), Number(b.remaining)))
  const byStore = d.stores.map((s: any) => ({ name: s.name, u: sum(B.filter((b) => b.store_id === s.id), (b) => Number(b.remaining)) }))
  const sums = new Map<string, number>()
  B.forEach((b) => { const n = pName.get(b.product_id) ?? ''; sums.set(n, (sums.get(n) ?? 0) + Number(b.supplied)) })
  const top = [...sums.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const need = B.filter((b, i) => lv[i] !== 'ok').sort((a, b) => a.remaining - b.remaining).slice(0, 6)

  return (<>
    <div className="hero">
      <div>{d.company ? <div className="mb-1 text-[13px] font-semibold uppercase tracking-wider opacity-90">{d.company}</div> : null}<h1>Dashboard</h1><p>Live overview of every store. Entries from store managers appear here automatically.</p></div>
      <span className="live-pill"><i />Live</span>
    </div>
    {!d.stores.length || !B.length ? <div className="panel mb-4"><b>Get started.</b> <span className="mute">Add a store under Stores, create a product under Products, then add it to a store under Supplies.</span></div> : null}
    <div className="kpis">
      <Kpi icon="store" label="Active stores" value={d.stores.filter((s: any) => s.active).length} />
      <Kpi icon="box" label="Products" value={P.length} />
      <Kpi icon="clock" label="Not yet in a store" value={notInStore} />
      <Kpi icon="layers" label="Units in stores" value={sum(B, (b) => Number(b.assigned))} />
      <Kpi icon="send" label="Supplied to customers" value={sum(B, (b) => Number(b.supplied))} />
      <Kpi icon="gift" label="Gifted" value={sum(B, (b) => Number(b.gifted))} />
      <Kpi icon="alert" label="Damaged on offload" value={damagedOffload} tone={damagedOffload ? 'warn' : undefined} />
      <Kpi icon="alert" label="Damaged during supply" value={damagedSupply} tone={damagedSupply ? 'warn' : undefined} />
      <Kpi icon="alert" label="Missing on offload" value={missingOffload} tone={missingOffload ? 'warn' : undefined} />
      <Kpi icon="alert" label="Missing during supply" value={missingSupply} tone={missingSupply ? 'warn' : undefined} />
      <Kpi icon="alert" label="Damaged or missing" value={lost} tone={lost ? 'warn' : undefined} />
      <Kpi icon="archive" label="Remaining in stores" value={sum(B, (b) => Number(b.remaining))} />
      <Kpi icon="flag" label="Open reports" value={d.open} tone={d.open ? 'bad' : undefined} />
    </div>
    <div className="content-grid wide">
      <div className="panel"><h2>Supplied, gifted and lost, last 7 days</h2>
        <SupplyLossChart labels={labels} supplied={days.map((x) => per(d.rows, x))} gifted={days.map((x) => per(d.gifts, x))} lost={days.map((x) => per(d.losses, x))} /></div>
      <div className="panel"><h2>Stock health</h2>
        <StatusDonut ok={lv.filter((x) => x === 'ok').length} low={lv.filter((x) => x === 'low').length} out={lv.filter((x) => x === 'out').length} /></div>
    </div>
    <div className="content-grid">
      <div className="panel"><h2>Remaining by store</h2><StoreBars labels={byStore.map((x: any) => x.name)} values={byStore.map((x: any) => x.u)} /></div>
      <div className="panel"><h2>Top products supplied</h2><TopBars labels={top.map(([n]) => n)} values={top.map(([, v]) => v)} /></div>
    </div>
    <div className="content-grid">
      <div className="panel"><h2>Needs restocking</h2>
        {need.length ? <div className="wrap"><table><thead><tr><th>Store</th><th>Product</th><th className="n">Left</th><th /></tr></thead><tbody>
          {need.map((b) => <tr key={b.supply_id}><td>{sName.get(b.store_id)}</td><td>{pName.get(b.product_id)}</td><td className="n">{b.remaining}</td><td><Chip s={level(Number(b.assigned), Number(b.remaining))} /></td></tr>)}</tbody></table></div> : <p className="mute m-0">Nothing is low or finished.</p>}
      </div>
      <div className="panel"><h2>Latest reports</h2>
        {d.reps.length ? <div className="wrap"><table><thead><tr><th>From</th><th>Subject</th><th /></tr></thead><tbody>
          {d.reps.map((r: any) => <tr key={r.id}><td>{r.profiles?.full_name}</td><td>{r.subject}</td><td><span className={'chip' + (r.resolved ? '' : ' low')}>{r.resolved ? 'Resolved' : 'Open'}</span></td></tr>)}</tbody></table></div> : <p className="mute m-0">No reports from managers yet.</p>}
      </div>
    </div>
    <div className="panel"><h2>Recent activity</h2>
      {d.log.length ? <div className="wrap"><table><thead><tr><th>When</th><th>By</th><th>Activity</th></tr></thead><tbody>
      {d.log.map((l: any) => <tr key={l.id}><td>{fmtT(l.created_at)}</td><td>{l.profiles?.full_name}</td><td className="w">{l.message}</td></tr>)}</tbody></table></div> : <p className="mute m-0">No activity yet.</p>}
    </div>
  </>)
}
