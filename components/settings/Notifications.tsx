'use client'
import { useEffect, useState } from 'react'
import { friendly, q, toast } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { DEFAULT_PREFS, normalizePrefs, type Prefs } from '@/lib/settings'
import { Row, Switch, TabHead } from './shared'
import type { Role } from './SettingsFrame'

const ITEMS: Record<Role, [keyof Prefs, string, string][]> = {
  admin: [
    ['low', 'Low stock', 'When a product in a store is low or finished.'],
    ['forecast', 'Stock-out forecast', 'When the forecast says a product will run out within a week.'],
    ['report', 'New report from a manager', 'While a store manager\u2019s report is still open.'],
    ['gift', 'Gifts recorded', 'Gifts recorded by managers in the last 7 days.'],
    ['loss', 'Damaged or missing stock', 'Damaged or missing items recorded in the last 7 days.'],
  ],
  manager: [
    ['low', 'Low stock', 'When a product in your store is low or finished.'],
    ['forecast', 'Stock-out forecast', 'When the forecast says a product in your store will run out within a week.'],
    ['report', 'Report answered', 'When your admin marks one of your reports as resolved.'],
  ],
}

export default function Notifications({ role }: { role: Role }) {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      const me = await q(sb.from('profiles').select('prefs').eq('id', user?.id ?? '').single())
      setP(normalizePrefs(me?.prefs))
    })().catch(() => {}).finally(() => setReady(true))
  }, [])

  async function save() {
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('update_my_profile', { p_prefs: p })
    setBusy(false)
    toast(error ? friendly(error.message) : 'Notification settings saved')
  }
  const set = (k: keyof Prefs) => (v: boolean) => setP({ ...p, [k]: v })
  if (!ready) return <p className="mute m-0">Loading…</p>

  return (<>
    <TabHead title="Notifications" desc="Choose which events you want to be told about." />
    <div className="-mt-4">
      {ITEMS[role].map(([k, t, d]) => <Row key={k} title={t} desc={d}><Switch on={p[k]} onChange={set(k)} label={t} /></Row>)}
    </div>
    <h3 className="mb-0 mt-6 text-[15px]">How to receive them</h3>
    <div>
      <Row title="In the app" desc="A Notices list at the top of your dashboard."><Switch on={p.inApp} onChange={set('inApp')} label="Show notices in the app" /></Row>
      <Row title="By email" desc="Needs an email service connected to Stockroom, which is not set up yet."><Switch on={false} onChange={() => {}} label="By email" disabled /></Row>
    </div>
    <button className="btn mt-4" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
  </>)
}
