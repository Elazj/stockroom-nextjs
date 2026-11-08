'use client'
import { useMemo, useState } from 'react'
import { Hd } from '@/components/ui'
import { ForecastLines } from '@/components/charts'
import { q, useLive } from '@/lib/data'
import {
  HISTORY_DAYS, LEAD_DAYS, SMA_WINDOW, analyseSeries, chosenRate, dailyUsage, dayLabels, planStock, r2, type Accuracy,
} from '@/lib/forecast'

type Row = {
  id: string
  name: string
  unit: string
  stores: string
  remaining: number
  alpha: number
  smaDaily: number
  sesDaily: number
  smaAcc: Accuracy | null
  sesAcc: Accuracy | null
  winner: 'sma' | 'ses' | 'tie' | 'none'
  rate: number
  daysLeft: number | null
  stockout: string
  reorder: string
  note: string
  actual: number[]
  backSma: (number | null)[]
  backSes: (number | null)[]
}

const fmtD = (d: Date | null) => d ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtN = (n: number) => r2(n).toLocaleString()
const methodName = (w: Row['winner']) => w === 'ses' ? 'Exponential smoothing' : w === 'tie' ? 'Tie' : w === 'sma' ? 'Moving average' : 'Not enough history'

function mean(xs: number[]) { return xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0 }

export default function ForecastView({ scope }: { scope: 'all' | 'store' }) {
  const { data: d, err } = useLive<any>(async (sb) => ({
    rows: await q(sb.from('sheet_rows').select('supply_id, quantity, created_at').gte('created_at', new Date(Date.now() - (HISTORY_DAYS + 2) * 864e5).toISOString())),
    losses: await q(sb.from('losses').select('supply_id, quantity, created_at').gte('created_at', new Date(Date.now() - (HISTORY_DAYS + 2) * 864e5).toISOString())),
    gifts: await q(sb.from('gifts').select('supply_id, quantity, created_at').gte('created_at', new Date(Date.now() - (HISTORY_DAYS + 2) * 864e5).toISOString())),
    bal: await q(sb.from('supply_balance').select('supply_id, product_id, store_id, remaining')),
    products: await q(sb.from('products').select('id, name, unit')),
    stores: await q(sb.from('stores').select('id, name')),
  }), ['sheet_rows', 'losses', 'gifts', 'supplies', 'products', 'stores'])
  const labels = useMemo(() => dayLabels(HISTORY_DAYS), [d])
  const rows: Row[] = useMemo(() => {
    if (!d) return []
    const pname = new Map<string, any>(d.products.map((p: any) => [p.id, p]))
    const sname = new Map<string, string>(d.stores.map((s: any) => [s.id, s.name]))
    const byProduct = new Map<string, { events: { at: string; qty: number }[]; remaining: number; stores: Set<string> }>()
    const supplyProduct = new Map<string, string>()
    for (const b of d.bal) {
      supplyProduct.set(b.supply_id, b.product_id)
      const slot = byProduct.get(b.product_id) ?? { events: [], remaining: 0, stores: new Set<string>() }
      slot.remaining += Number(b.remaining)
      if (b.store_id) slot.stores.add(sname.get(b.store_id) ?? 'Store')
      byProduct.set(b.product_id, slot)
    }
    const add = (supplyId: string, at: string, qty: number) => {
      const pid = supplyProduct.get(supplyId)
      const slot = pid ? byProduct.get(pid) : undefined
      if (slot) slot.events.push({ at, qty: Number(qty) })
    }
    d.rows.forEach((r: any) => add(r.supply_id, r.created_at, r.quantity))
    d.losses.forEach((r: any) => add(r.supply_id, r.created_at, r.quantity))
    d.gifts.forEach((r: any) => add(r.supply_id, r.created_at, r.quantity))
    return [...byProduct.entries()].map(([id, slot]) => {
      const p = pname.get(id)
      const series = dailyUsage(slot.events)
      const f = analyseSeries(series)
      const rate = chosenRate(f)
      const plan = planStock(slot.remaining, rate)
      return {
        id, name: p?.name ?? 'Product', unit: p?.unit ?? '', stores: [...slot.stores].join(', ') || '—',
        remaining: slot.remaining, alpha: f.alpha, smaDaily: f.smaDaily, sesDaily: f.sesDaily,
        smaAcc: f.smaAcc, sesAcc: f.sesAcc, winner: f.winner, rate,
        daysLeft: plan.daysLeft, stockout: fmtD(plan.stockout), reorder: fmtD(plan.reorder), note: plan.note,
        actual: series, backSma: f.backSma, backSes: f.backSes,
      }
    }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
  }, [d])
  const [pick, setPick] = useState('')
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>

  const scored = rows.filter((r) => r.smaAcc && r.sesAcc)
  const smaMae = mean(scored.map((r) => r.smaAcc!.mae))
  const sesMae = mean(scored.map((r) => r.sesAcc!.mae))
  const smaWins = scored.filter((r) => r.winner === 'sma').length
  const sesWins = scored.filter((r) => r.winner === 'ses').length
  const better = !scored.length ? 'neither method yet' : Math.abs(smaMae - sesMae) < 0.001 ? 'the two methods are level' : sesMae < smaMae ? 'exponential smoothing' : 'the moving average'
  const selected = rows.find((r) => r.id === pick) ?? rows[0]

  return (<>
    <Hd title="Stock-out forecast" sub={scope === 'all' ? 'When each product is likely to run out, and which method predicted recent use more accurately.' : 'When your products are likely to run out, from this store’s supply history.'} />
    <div className="panel mb-4">
      <h2>How the two methods compare</h2>
      <p className="mt-0">Usage is the units supplied, gifted, damaged, or missing on each calendar day for the last {HISTORY_DAYS} days. Days with no entry count as zero. A {SMA_WINDOW}-day moving average takes the mean of the last {SMA_WINDOW} days. Exponential smoothing keeps a level that moves toward each new day; its smoothing factor (between 0.1 and 0.9) is chosen on earlier days only, by lowest error. Both methods are then scored on the last stretch of days they did not use for that choice. Error is the mean absolute error (average units off per day), root mean squared error (punishes large misses), and symmetric MAPE (percent-style error that still works on zero days).</p>
      {scored.length ? (<>
        <div className="kpis">
          <div className="panel"><b>Moving average</b><div className="big">{fmtN(smaMae)}<small> MAE</small></div><p className="mute m-0">Wins on {smaWins} of {scored.length} products. Mean RMSE {fmtN(mean(scored.map((r) => r.smaAcc!.rmse)))}, mean sMAPE {fmtN(mean(scored.map((r) => r.smaAcc!.smape)) * 100)}%.</p></div>
          <div className="panel"><b>Exponential smoothing</b><div className="big">{fmtN(sesMae)}<small> MAE</small></div><p className="mute m-0">Wins on {sesWins} of {scored.length} products. Mean RMSE {fmtN(mean(scored.map((r) => r.sesAcc!.rmse)))}, mean sMAPE {fmtN(mean(scored.map((r) => r.sesAcc!.smape)) * 100)}%.</p></div>
        </div>
        <p className="m-0">On this history, <b>{better}</b> is more accurate. Each product below uses whichever method has the lower error for that product. A tie uses the moving average. The reorder date is the predicted stock-out minus {LEAD_DAYS} days of lead time, or today when that date has passed.</p>
      </>) : <p className="m-0">Accuracy appears once a product has a few weeks of daily history. Until then the moving average is used and no error score is shown.</p>}
    </div>
    {selected ? (
      <div className="panel mb-4">
        <div className="row">
          <h2 className="m-0">Recent use and one-day-ahead predictions</h2>
          <select value={selected.id} onChange={(e) => setPick(e.target.value)}>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <ForecastLines labels={labels} actual={selected.actual} sma={selected.backSma} ses={selected.backSes} />
        <p className="mute m-0">{selected.name}: moving average {fmtN(selected.smaDaily)} {selected.unit}/day, smoothing {fmtN(selected.sesDaily)} {selected.unit}/day (factor {selected.alpha}). {selected.smaAcc ? `Holdout MAE ${fmtN(selected.smaAcc.mae)} vs ${fmtN(selected.sesAcc!.mae)} over ${selected.smaAcc.n} days.` : 'Not enough days to score accuracy yet.'}</p>
      </div>
    ) : <div className="panel mute mb-4">No products are in a store yet. Forecasts start after an admin assigns stock.</div>}
    {rows.length ? <div className="panel"><div className="wrap"><table>
      <thead><tr><th>Product</th>{scope === 'all' ? <th>Stores</th> : null}<th className="n">Left</th><th className="n">MA / day</th><th className="n">SES / day</th><th>More accurate</th><th>Stock-out</th><th>Reorder</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}>
          <td>{r.name}</td>
          {scope === 'all' ? <td>{r.stores}</td> : null}
          <td className="n">{fmtN(r.remaining)} {r.unit}</td>
          <td className="n">{fmtN(r.smaDaily)}</td>
          <td className="n">{fmtN(r.sesDaily)}</td>
          <td>{methodName(r.winner)}{r.smaAcc ? <span className="mute"> · MAE {fmtN(r.smaAcc.mae)} / {fmtN(r.sesAcc!.mae)}</span> : null}</td>
          <td>{r.daysLeft == null ? r.note : r.daysLeft > 365 ? 'More than a year' : `${r.stockout} · ${fmtN(r.daysLeft)} days`}</td>
          <td>{r.reorder}{r.note && r.daysLeft === 0 ? <span className="mute"> · {r.note}</span> : null}</td>
        </tr>
      ))}</tbody>
    </table></div></div> : null}
  </>)
}
