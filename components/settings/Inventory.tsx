'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { friendly, toast } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsProvider'
import { Row, Switch, TabHead } from './shared'

export default function Inventory() {
  const router = useRouter()
  const cur = useSettings()
  const [f, setF] = useState({ lowStockPct: String(cur.lowStockPct), defaultUnit: cur.defaultUnit, forecastDays: String(cur.forecastDays), requireArrival: cur.requireArrival, allowGifts: cur.allowGifts })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setMsg('')
    const low = Math.round(Number(f.lowStockPct)), days = Math.round(Number(f.forecastDays)), unit = f.defaultUnit.trim()
    if (!(low >= 1 && low <= 90)) return setMsg('The low-stock level must be between 1 and 90 percent.')
    if (!unit) return setMsg('Enter the default unit.')
    if (!(days >= 28 && days <= 90)) return setMsg('Forecast history must be between 28 and 90 days.')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('update_company_settings', {
      p_settings: { lowStockPct: low, defaultUnit: unit, forecastDays: days, requireArrival: f.requireArrival, allowGifts: f.allowGifts },
    })
    setBusy(false)
    if (error) return setMsg(friendly(error.message))
    toast('Settings saved')
    router.refresh()
  }

  return (<>
    <TabHead title="Inventory Configuration" desc="Rules for products, stock alerts and what store managers can record." />
    <div className="-mt-4">
      <Row title="Low-stock alert level" desc="A product shows as Low when this percent of the quantity assigned to a store, or less, is left.">
        <div className="flex items-center gap-2"><input className="mt-0 w-24" type="number" min={1} max={90} value={f.lowStockPct} onChange={(e) => setF({ ...f, lowStockPct: e.target.value })} aria-label="Low-stock alert level in percent" /><span className="text-mute">%</span></div>
      </Row>
      <Row title="Default unit" desc="Pre-filled when you add a product.">
        <input className="mt-0 w-full sm:w-40" value={f.defaultUnit} maxLength={20} onChange={(e) => setF({ ...f, defaultUnit: e.target.value })} aria-label="Default unit" />
      </Row>
      <Row title="Forecast history" desc="How many past days the stock-out forecast learns from (28 to 90).">
        <div className="flex items-center gap-2"><input className="mt-0 w-24" type="number" min={28} max={90} value={f.forecastDays} onChange={(e) => setF({ ...f, forecastDays: e.target.value })} aria-label="Forecast history in days" /><span className="text-mute">days</span></div>
      </Row>
      <Row title="Require date arrived on products" desc="When off, a product saved without an arrival date gets today's date."><Switch on={f.requireArrival} onChange={(v) => setF({ ...f, requireArrival: v })} label="Require date arrived" /></Row>
      <Row title="Let managers record gifts" desc="Shows the gift panel on each store manager's sheet."><Switch on={f.allowGifts} onChange={(v) => setF({ ...f, allowGifts: v })} label="Let managers record gifts" /></Row>
    </div>
    <p className="err mt-3" role="alert">{msg}</p>
    <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
  </>)
}
