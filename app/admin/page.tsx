'use client'
import { Hd, Chip } from '@/components/ui'
import { fmtT, level, localDay, q, sum, useLive } from '@/lib/data'

function LineChart({ labels, a, b }: { labels: string[]; a: number[]; b: number[] }) {
  const W = 560, H = 170, P = 32, m = Math.max(1, ...a, ...b)
  const x = (i: number) => P + (i * (W - 2 * P)) / (labels.length - 1), y = (v: number) => H - P + 8 - (v / m) * (H - 2 * P)
  const pl = (arr: number[], c: string) => (<>
    <polyline fill="none" style={{ stroke: c }} strokeWidth="2.5" strokeLinejoin="round" points={arr.map((v, i) => x(i) + ',' + y(v)).join(' ')} />
    {arr.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" style={{ fill: c }} />)}
  </>)
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} width="100%" role="img" aria-label="Supplied and lost units over the last 7 days">
      {[0, 0.5, 1].map((f) => (<g key={f}><line x1={P} x2={W - 8} y1={y(m * f)} y2={y(m * f)} style={{ stroke: 'var(--line)' }} /><text x="0" y={y(m * f) + 4} fontSize="10" style={{ fill: 'var(--mute)' }}>{Math.round(m * f)}</text></g>))}
      {pl(b, 'var(--acc)')}{pl(a, 'var(--warn)')}
      {labels.map((l, i) => <text key={i} x={x(i)} y={H + 8} fontSize="10" textAnchor="middle" style={{ fill: 'var(--mute)' }}>{l}</text>)}
    </svg>
  )
}

export default function AdminDashboard() {
  const { data: d, err } = useLive<any>(async (sb) => {
    const since = new Date(Date.now() - 8 * 864e5).toISOString()
    const [bal, products, stores, open, reps, log, rows, losses] = await Promise.all([
      q(sb.from('supply_balance').select('*')), q(sb.from('products').select('*')), q(sb.from('stores').select('*')),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false).then((r) => r.count ?? 0),
      q(sb.from('reports').select('id, subject, resolved, profiles(full_name)').order('created_at', { ascending: false }).limit(4)),
      q(sb.from('activity_log').select('id, message, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(10)),
      q(sb.from('sheet_rows').select('quantity, created_at').gte('created_at', since)),
      q(sb.from('losses').select('quantity, created_at').gte('created_at', since)),
    ])
    return { bal, products, stores, open, reps, log, rows, losses }
  }, ['supplies', 'sheet_rows', 'losses', 'reports', 'activity_log', 'products', 'stores'])
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>

  const B: any[] = d.bal, P: any[] = d.products
  const sName = new Map<string, string>(d.stores.map((s: any) => [s.id, s.name]))
  const pName = new Map<string, string>(P.map((p: any) => [p.id, p.name]))
  const notInStore = sum(P, (p) => Number(p.net)) - sum(B, (b) => Number(b.assigned))
  const lost = sum(P, (p) => Number(p.damaged_offload) + Number(p.missing_before_offload)) + sum(B, (b) => Number(b.damaged_in_supply) + Number(b.missing_in_supply))
  const days = [6, 5, 4, 3, 2, 1, 0].map((n) => localDay(new Date(Date.now() - n * 864e5)))
  const per = (arr: any[], day: string) => sum(arr.filter((r) => localDay(r.created_at) === day), (r) => Number(r.quantity))
  const sold = days.map((day) => per(d.rows, day)), lostDay = days.map((day) => per(d.losses, day))
  const byStore = d.stores.map((s: any) => ({ s, u: sum(B.filter((b) => b.store_id === s.id), (b) => Number(b.remaining)) }))
  const mx = Math.max(1, ...byStore.map((x: any) => x.u))
  const sums = new Map<string, number>()
  B.forEach((b) => { const n = pName.get(b.product_id) ?? ''; sums.set(n, (sums.get(n) ?? 0) + Number(b.supplied)) })
  const top = [...sums.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const tm = top.length ? top[0][1] : 1
  const need = B.filter((b) => level(Number(b.assigned), Number(b.remaining)) !== 'ok').sort((a, b) => a.remaining - b.remaining).slice(0, 6)
  const stats: [number, string][] = [[d.stores.filter((s: any) => s.active).length, 'Active stores'], [P.length, 'Products'], [notInStore, 'Not yet in a store'], [sum(B, (b) => Number(b.assigned)), 'Units in stores'], [sum(B, (b) => Number(b.supplied)), 'Supplied to customers'], [lost, 'Damaged or missing'], [sum(B, (b) => Number(b.remaining)), 'Remaining in stores'], [d.open, 'Open reports']]

  return (<>
    <Hd title="Dashboard" sub={<><span className="chip">Live</span> Store manager entries appear here automatically.</>} />
    {!d.stores.length || !B.length ? <div className="panel" style={{ marginBottom: 16 }}><b>Get started.</b> <span className="mute">Add a store under Stores, create a product under Products, then add it to a store under Supplies.</span></div> : null}
    <div className="panel strip">{stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
    <div className="grid">
      <div className="panel"><h2>Supplied and lost, last 7 days</h2>
        <div className="legend"><span><i style={{ background: 'var(--acc)' }} />Supplied to customers</span><span><i style={{ background: 'var(--warn)' }} />Damaged or missing</span></div>
        <LineChart labels={days.map((x) => x.slice(5))} a={lostDay} b={sold} /></div>
      <div className="panel"><h2>Remaining by store</h2>
        {byStore.length ? <div className="list">{byStore.map((x: any) => <div key={x.s.id}><div className="row"><span>{x.s.name}</span><b>{x.u}</b></div><div className="bar"><i style={{ width: (x.u / mx) * 100 + '%' }} /></div></div>)}</div> : <p className="mute">No stores yet.</p>}
        <h2 style={{ marginTop: 18 }}>Top products supplied</h2>
        {top.length ? <div className="list">{top.map(([n, v]) => <div key={n}><div className="row"><span>{n}</span><b>{v}</b></div><div className="bar"><i style={{ width: (v / tm) * 100 + '%' }} /></div></div>)}</div> : <p className="mute">Customer supplies will rank here.</p>}
      </div>
    </div>
    <div className="grid">
      <div className="panel"><h2>Needs restocking</h2>
        {need.length ? <div className="wrap"><table><thead><tr><th>Store</th><th>Product</th><th className="n">Left</th><th /></tr></thead><tbody>
          {need.map((b) => <tr key={b.supply_id}><td>{sName.get(b.store_id)}</td><td>{pName.get(b.product_id)}</td><td className="n">{b.remaining}</td><td><Chip s={level(Number(b.assigned), Number(b.remaining))} /></td></tr>)}</tbody></table></div> : <p className="mute" style={{ margin: 0 }}>Nothing is low or finished.</p>}
      </div>
      <div className="panel"><h2>Latest reports</h2>
        {d.reps.length ? <div className="wrap"><table><thead><tr><th>From</th><th>Subject</th><th /></tr></thead><tbody>
          {d.reps.map((r: any) => <tr key={r.id}><td>{r.profiles?.full_name}</td><td>{r.subject}</td><td><span className={'chip' + (r.resolved ? '' : ' low')}>{r.resolved ? 'Resolved' : 'Open'}</span></td></tr>)}</tbody></table></div> : <p className="mute" style={{ margin: 0 }}>No reports from managers yet.</p>}
      </div>
    </div>
    <div className="panel"><h2>Recent activity</h2>
      {d.log.length ? <div className="wrap"><table><thead><tr><th>When</th><th>By</th><th>Activity</th></tr></thead><tbody>
        {d.log.map((l: any) => <tr key={l.id}><td>{fmtT(l.created_at)}</td><td>{l.profiles?.full_name}</td><td className="w">{l.message}</td></tr>)}</tbody></table></div> : <p className="mute" style={{ margin: 0 }}>No activity yet.</p>}
    </div>
  </>)
}
