'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { friendly, toast } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsProvider'
import { Row, TabHead } from './shared'

const TIMEOUTS = [5, 10, 15, 30, 60, 120]

export default function Security() {
  const router = useRouter()
  const current = useSettings()
  const [minutes, setMinutes] = useState(String(current.sessionTimeoutMinutes))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setMsg('')
    const value = Number(minutes)
    if (!TIMEOUTS.includes(value)) return setMsg('Choose a session timeout between 5 minutes and 2 hours.')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('update_company_settings', {
      p_settings: { sessionTimeoutMinutes: value },
    })
    setBusy(false)
    if (error) return setMsg(friendly(error.message))
    toast('Security settings saved')
    router.refresh()
  }

  return (<>
    <TabHead title="Security" desc="Set how long signed-in users can be inactive before they are automatically signed out." />
    <div className="-mt-4">
      <Row title="Automatic sign-out" desc="Applies to all admin and store manager accounts in your company.">
        <select className="mt-0 w-full sm:w-44" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Automatic sign-out after inactivity">
          {TIMEOUTS.map((value) => <option key={value} value={value}>{value < 60 ? `${value} minutes` : `${value / 60} hour${value > 60 ? 's' : ''}`}</option>)}
        </select>
      </Row>
    </div>
    <p className="err mt-3" role="alert">{msg}</p>
    <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
  </>)
}
