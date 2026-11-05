// Stock-out forecast from daily usage (customer supplies + damaged + missing).
// Moving average vs simple exponential smoothing, scored on a held-out tail.

export const HISTORY_DAYS = 56
export const SMA_WINDOW = 7
export const LEAD_DAYS = 7
const HOLDOUT_CAP = 14
const ALPHAS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

export type Accuracy = { mae: number; rmse: number; smape: number; n: number }

export type SeriesForecast = {
  alpha: number
  smaDaily: number
  sesDaily: number
  smaAcc: Accuracy | null
  sesAcc: Accuracy | null
  winner: 'sma' | 'ses' | 'tie' | 'none'
  backSma: (number | null)[]
  backSes: (number | null)[]
}

const dayKey = (d: Date) => d.toLocaleDateString('en-CA')

export function dailyUsage(events: { at: string; qty: number }[], days = HISTORY_DAYS): number[] {
  const map = new Map<string, number>()
  for (const e of events) {
    const k = dayKey(new Date(e.at))
    map.set(k, (map.get(k) ?? 0) + Number(e.qty))
  }
  const out: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    out.push(map.get(dayKey(d)) ?? 0)
  }
  return out
}

export function dayLabels(days: number): string[] {
  const labels: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString([], { month: 'short', day: 'numeric' }))
  }
  return labels
}

export const sma = (series: number[], window = SMA_WINDOW) => {
  const w = series.slice(-window)
  if (!w.length) return 0
  return w.reduce((s, n) => s + n, 0) / w.length
}

export const ses = (series: number[], alpha: number) => {
  if (!series.length) return 0
  let level = series[0]
  for (let i = 1; i < series.length; i++) level = alpha * series[i] + (1 - alpha) * level
  return level
}

function oneStep(past: number[], method: 'sma' | 'ses', alpha: number, window: number) {
  return method === 'sma' ? sma(past, window) : ses(past, alpha)
}

export function backcast(series: number[], method: 'sma' | 'ses', alpha: number, window = SMA_WINDOW): (number | null)[] {
  return series.map((_, t) => (t < window ? null : oneStep(series.slice(0, t), method, alpha, window)))
}

function scoreRange(series: number[], method: 'sma' | 'ses', alpha: number, from: number, window = SMA_WINDOW): Accuracy | null {
  let n = 0, abs = 0, sq = 0, sm = 0
  for (let t = from; t < series.length; t++) {
    const pred = oneStep(series.slice(0, t), method, alpha, window)
    const actual = series[t]
    const err = actual - pred
    abs += Math.abs(err)
    sq += err * err
    const den = Math.abs(actual) + Math.abs(pred)
    sm += den === 0 ? 0 : (2 * Math.abs(err)) / den
    n++
  }
  if (!n) return null
  return { mae: abs / n, rmse: Math.sqrt(sq / n), smape: sm / n, n }
}

function fitAlpha(train: number[], window = SMA_WINDOW) {
  let best = 0.3, bestMae = Infinity
  for (const alpha of ALPHAS) {
    const acc = scoreRange(train, 'ses', alpha, window, window)
    if (acc && acc.mae < bestMae) { bestMae = acc.mae; best = alpha }
  }
  return best
}

export function analyseSeries(series: number[]): SeriesForecast {
  const hold = Math.min(HOLDOUT_CAP, Math.floor(series.length / 3))
  const trainable = hold >= 3 && series.length >= SMA_WINDOW + hold
  const train = trainable ? series.slice(0, series.length - hold) : series
  const alpha = train.length > SMA_WINDOW ? fitAlpha(train) : 0.3
  const from = trainable ? series.length - hold : series.length
  const smaAcc = trainable ? scoreRange(series, 'sma', alpha, from) : null
  const sesAcc = trainable ? scoreRange(series, 'ses', alpha, from) : null
  let winner: SeriesForecast['winner'] = 'none'
  if (smaAcc && sesAcc) {
    const gap = smaAcc.mae - sesAcc.mae
    winner = Math.abs(gap) < 0.001 ? 'tie' : gap > 0 ? 'ses' : 'sma'
  }
  return {
    alpha, smaDaily: sma(series), sesDaily: ses(series, alpha), smaAcc, sesAcc, winner,
    backSma: backcast(series, 'sma', alpha), backSes: backcast(series, 'ses', alpha),
  }
}

export type StockPlan = {
  daysLeft: number | null
  stockout: Date | null
  reorder: Date | null
  note: string
}

export function planStock(remaining: number, daily: number, now = Date.now()): StockPlan {
  if (remaining <= 0) {
    const today = new Date(now)
    return { daysLeft: 0, stockout: today, reorder: today, note: 'Already finished. Reorder now.' }
  }
  if (daily <= 0.0001) return { daysLeft: null, stockout: null, reorder: null, note: 'No measured use, so there is no stock-out date.' }
  const daysLeft = remaining / daily
  const stockout = new Date(now + daysLeft * 864e5)
  const reorder = new Date(stockout.getTime() - LEAD_DAYS * 864e5)
  const today = new Date(now)
  return { daysLeft, stockout, reorder: reorder.getTime() < today.getTime() ? today : reorder, note: '' }
}

export const chosenRate = (f: SeriesForecast) => (f.winner === 'ses' ? f.sesDaily : f.smaDaily)

export const r2 = (n: number) => Math.round(n * 100) / 100
