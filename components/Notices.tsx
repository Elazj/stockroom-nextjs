'use client'
import { useMemo } from 'react'
import { fmtT, level, q, useLive } from '@/lib/data'
import { LEAD_DAYS, analyseSeries, chosenRate, dailyUsage, planStock } from '@/lib/forecast'
import { normalizePrefs } from '@/lib/settings'
import { useSettings } from '@/components/SettingsProvider'
import { cx } from '@/lib/tw'

type Item = { id: string; tone: 'bad' | 'warn' | 'info'; text: string; at?: string }
const MAX = 10

// The Notices list on the dashboards. What it shows follows the person's choices in Settings > Notifications.
export default function Notices({ role }: { role: 'admin' | 'manager' }) {
  const admin = role === 'admin'
  const settings = useSettings()
  const days = settings.forecastDays
  const { data: d } = useLive<any>(async (sb) => {
    const { data: { user } } = await sb.auth.getUser()
    const since = new Date(Date.now() - (days + 2) * 864e5).toISOString()
    const week = new Date(Date.now() - 7 * 864e5).toISOString()
    const fortnight = new Date(Date.now() - 14 * 864e5).toISOString()
    const ev = (t: string) => q(sb.from(t).select('supply_id, quantity, created_at').gte('created_at', since))
    const who = 'profiles(full_name), supplies(products(name, unit), stores(name))'
    return {
      prefs: normalizePrefs((await q(sb.from('profiles').select('prefs').eq('id', user?.id ?? '').single()))?.prefs),
      bal: await q(sb.from('supply_balance').select('supply_id, product_id, store_id, assigned, remaining')),
      products: await q(sb.from('products').select('id, name, unit')),
      stores: await q(sb.from('stores').select('id, name')),
      rows: await ev('sheet_rows'), losses: await ev('losses'), gifts: await ev('gifts'),
      reports: admin
        ? await q(sb.from('reports').select('id, subject, created_at, profiles(full_name)').eq('resolved', false).order('created_at', { ascending: false }).limit(5))
        : await q(sb.from('reports').select('id, subject, created_at').eq('resolved', true).gte('created_at', fortnight).order('created_at', { ascending: false }).limit(3)),
      giftList: admin ? await q(sb.from('gifts').select(`id, quantity, recipient, created_at, ${who}`).gte('created_at', week).order('created_at', { ascending: false }).limit(5)) : [],
      lossList: admin ? await q(sb.from('losses').select(`id, kind, quantity, created_at, ${who}`).gte('created_at', week).order('created_at', { ascending: false }).limit(5)) : [],
    }
  }, ['supplies', 'sheet_rows', 'losses', 'gifts', 'reports', 'products'], `notices-${role}-${days}`)

  const items = useMemo<Item[]>(() => {
    if (!d || !d.prefs.inApp) return []
    const p = d.prefs
    const pn = new Map<string, any>(d.products.map((x: any) => [x.id, x]))
    const sn = new Map<string, string>(d.stores.map((x: any) => [x.id, x.name]))
    const out: Item[] = []

    if (p.low) {
      d.bal.map((b: any) => ({ b, lv: level(Number(b.assigned), Number(b.remaining)) })).filter((x: any) => x.lv !== 'ok')
        .sort((a: any, b: any) => (a.lv === 'out' ? 0 : 1) - (b.lv === 'out' ? 0 : 1) || a.b.remaining - b.b.remaining).slice(0, 6)
        .forEach(({ b, lv }: any) => {
          const pr = pn.get(b.product_id)
          out.push({ id: 'low-' + b.supply_id, tone: lv === 'out' ? 'bad' : 'warn', text: `${admin ? (sn.get(b.store_id) ?? 'Store') + ': ' : ''}${pr?.name ?? 'Product'} is ${lv === 'out' ? 'finished' : `low (${b.remaining} ${pr?.unit ?? ''} left)`}` })
        })
    }

    if (p.forecast) { // same method as the Forecast page
      const slots = new Map<string, { events: { at: string; qty: number }[]; remaining: number }>()
      const supplyProduct = new Map<string, string>()
      for (const b of d.bal) {
        supplyProduct.set(b.supply_id, b.product_id)
        const s = slots.get(b.product_id) ?? { events: [], remaining: 0 }
        s.remaining += Number(b.remaining); slots.set(b.product_id, s)
      }
      for (const list of [d.rows, d.losses, d.gifts]) for (const r of list) slots.get(supplyProduct.get(r.supply_id) ?? '')?.events.push({ at: r.created_at, qty: Number(r.quantity) })
      for (const [id, s] of slots) {
        if (s.remaining <= 0) continue
        const plan = planStock(s.remaining, chosenRate(analyseSeries(dailyUsage(s.events, days))))
        if (plan.daysLeft !== null && plan.daysLeft <= LEAD_DAYS) out.push({ id: 'fc-' + id, tone: 'warn', text: `${pn.get(id)?.name ?? 'Product'} is forecast to run out in about ${Math.max(1, Math.round(plan.daysLeft))} day${Math.round(plan.daysLeft) === 1 ? '' : 's'}` })
      }
    }

    if (p.report) d.reports.forEach((r: any) => out.push({ id: 'rp-' + r.id, tone: 'info', at: r.created_at, text: admin ? `Open report from ${r.profiles?.full_name ?? 'a manager'}: ${r.subject}` : `Your report was resolved: ${r.subject}` }))
    if (p.gift) d.giftList.forEach((g: any) => out.push({ id: 'g-' + g.id, tone: 'info', at: g.created_at, text: `${g.profiles?.full_name ?? 'A manager'} gifted ${g.quantity} ${g.supplies?.products?.unit ?? ''} of ${g.supplies?.products?.name ?? 'a product'} to ${g.recipient}${g.supplies?.stores?.name ? ` (${g.supplies.stores.name})` : ''}` }))
    if (p.loss) d.lossList.forEach((l: any) => out.push({ id: 'l-' + l.id, tone: 'warn', at: l.created_at, text: `${l.profiles?.full_name ?? 'A manager'} recorded ${l.quantity} ${l.supplies?.products?.unit ?? ''} of ${l.supplies?.products?.name ?? 'a product'} as ${l.kind}${l.supplies?.stores?.name ? ` (${l.supplies.stores.name})` : ''}` }))
    return out.slice(0, MAX)
  }, [d, days, admin])

  if (!items.length) return null
  return (
    <div className="panel mb-4" role="region" aria-label="Notices">
      <h2>Notices</h2>
      <ul className="m-0 list-none p-0">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0 last:pb-0">
            <span className={cx('mt-[7px] h-2 w-2 flex-none rounded-full', i.tone === 'bad' ? 'bg-bad' : i.tone === 'warn' ? 'bg-warn' : 'bg-acc')} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm">{i.text}</span>
            {i.at ? <span className="flex-none text-xs text-mute">{fmtT(i.at)}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
