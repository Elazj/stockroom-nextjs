'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { friendly, q, toast } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsProvider'
import type { DateFormat } from '@/lib/settings'
import { Row, TabHead } from './shared'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'GMD', 'XOF', 'NGN', 'GHS', 'KES', 'ZAR', 'CAD', 'AUD', 'INR', 'AED']
const FORMATS: [DateFormat, string][] = [['medium', 'Nov 8, 2026'], ['dmy', '08/11/2026'], ['mdy', '11/08/2026'], ['iso', '2026-11-08']]

export default function General() {
  const router = useRouter()
  const cur = useSettings()
  const [name, setName] = useState('')
  const [f, setF] = useState({ currency: cur.currency, dateFormat: cur.dateFormat, timeZone: cur.timeZone })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const zones = useMemo(() => {
    try { return (Intl as any).supportedValuesOf('timeZone') as string[] } catch { return ['UTC', 'Africa/Banjul', 'Africa/Lagos', 'Europe/London', 'America/New_York'] }
  }, [])

  useEffect(() => {
    q(supabaseBrowser().from('companies').select('name').limit(1)).then((r) => setName(r?.[0]?.name ?? '')).catch(() => {})
  }, [])

  async function save() {
    setMsg('')
    if (name.trim().length < 2) return setMsg('Enter the company or business name.')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('update_company_settings', { p_name: name.trim(), p_settings: f })
    setBusy(false)
    if (error) return setMsg(friendly(error.message))
    toast('Settings saved')
    router.refresh() // every page reads the new name and formats from the server
  }

  return (<>
    <TabHead title="General Settings" desc="Company-wide defaults for how information is shown." />
    <div className="-mt-4">
      <Row title="Company name" desc="Edit the name to correct a spelling mistake. It appears on dashboards and in the side bar for you and your managers.">
        <input className="mt-0 w-full sm:w-64" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Company name" />
      </Row>
      <Row title="Currency" desc="Kept for the company. Stockroom does not track prices yet, so no amounts are shown.">
        <select className="mt-0 w-full sm:w-44" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} aria-label="Currency">
          {[...new Set([f.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Row>
      <Row title="Date format" desc="How dates appear in tables, sheets and the activity log.">
        <select className="mt-0 w-full sm:w-44" value={f.dateFormat} onChange={(e) => setF({ ...f, dateFormat: e.target.value as DateFormat })} aria-label="Date format">
          {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Row>
      <Row title="Time zone" desc="Used for times and daily totals. Choose the device option to follow each person's own clock.">
        <select className="mt-0 w-full sm:w-64" value={f.timeZone} onChange={(e) => setF({ ...f, timeZone: e.target.value })} aria-label="Time zone">
          <option value="">This device</option>
          {zones.map((z) => <option key={z}>{z}</option>)}
        </select>
      </Row>
      <Row title="Language" desc="The language of menus and messages. English is the only language for now.">
        <select className="mt-0 w-full sm:w-44" value="en" disabled aria-label="Language"><option value="en">English</option></select>
      </Row>
    </div>
    <p className="err mt-3" role="alert">{msg}</p>
    <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
  </>)
}
