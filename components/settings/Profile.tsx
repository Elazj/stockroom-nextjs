'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui'
import { q, toast } from '@/lib/data'
import { pwErr } from '@/lib/validate'
import { supabaseBrowser } from '@/lib/supabase/client'
import { friendly } from '@/lib/data'
import { DangerBox, TabHead } from './shared'
import type { Role } from './SettingsFrame'

function PasswordBody({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [m, setM] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    const e = pwErr(a); if (e) return setM(e)
    if (a !== b) return setM('Passwords do not match.')
    setBusy(true)
    const { error } = await supabaseBrowser().auth.updateUser({ password: a })
    setBusy(false)
    if (error) return setM(error.message)
    toast('Password updated'); onClose()
  }
  return (<>
    <label>New password<input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></label>
    <label>Confirm new password<input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></label>
    <p className="err" role="alert">{m}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>Update password</button></div>
  </>)
}

function DeleteBody({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (text.trim() !== 'DELETE') return setErr('Type DELETE to confirm.')
    setBusy(true); setErr('')
    const sb = supabaseBrowser()
    const { error } = await sb.rpc('delete_my_account')
    if (error) { setBusy(false); return setErr(friendly(error.message)) }
    try { await sb.auth.signOut({ scope: 'local' }) } catch {}
    location.href = '/login'
  }
  return (<>
    <p className="mute mt-0">This permanently deletes your admin account, your company and everything in it: stores, products, supplies, sheet entries, gifts, reports and activity. It also deletes every store manager account you created, so their logins stop working. It cannot be undone. Afterwards you can sign up again, even with the same company name.</p>
    <label>Type DELETE to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" /></label>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Deleting…' : 'Delete my account'}</button></div>
  </>)
}

export default function Profile({ role }: { role: Role }) {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState(false)
  const [del, setDel] = useState(false)

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      const p = await q(sb.from('profiles').select('full_name, store_id, companies(name)').eq('id', user?.id ?? '').single())
      const store = p.store_id ? (await q(sb.from('stores').select('name').eq('id', p.store_id).single())).name : ''
      const co = p.companies
      setMe({ email: user?.email ?? '', store, company: (Array.isArray(co) ? co[0]?.name : co?.name) ?? '' })
      setName(p.full_name ?? '')
    })().catch(() => setMe({ email: '', store: '', company: '' }))
  }, [])

  async function save() {
    setMsg('')
    if (name.trim().length < 2) return setMsg('Enter your full name.')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('update_my_profile', { p_name: name.trim() })
    setBusy(false)
    if (error) return setMsg(friendly(error.message))
    toast('Profile saved')
    router.refresh() // the name in the side bar comes from the server
  }

  if (!me) return <p className="mute m-0">Loading…</p>
  return (<>
    <TabHead title="Account & Profile" desc="Your account and sign-in details." />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="m-0">Full name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label className="m-0">Email<input value={me.email} readOnly /></label>
      <label className="m-0">Company<input value={me.company} readOnly /></label>
      {role === 'manager' ? <label className="m-0">Store<input value={me.store || '-'} readOnly /></label> : null}
      <label className="m-0">Account type<input value={role === 'admin' ? 'Admin' : 'Store manager'} readOnly /></label>
    </div>
    <p className="err mt-3" role="alert">{msg}</p>
    <div className="flex flex-wrap gap-3">
      <button className="btn" disabled={busy} onClick={save}>Save profile</button>
      <button className="btn ghost" onClick={() => setPw(true)}>Change password</button>
      <button className="btn ghost" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = '/login' }}>Sign out</button>
    </div>
    {role === 'manager'
      ? <p className="mb-0 mt-6 rounded-xl bg-accsoft p-3.5 text-[13px]">Your admin created this account. To change your store, or to remove the account, ask your admin.</p>
      : <DangerBox title="Delete account" text="Permanently deletes your admin account, your company, all its data and every store manager account. You can sign up again afterwards.">
          <button className="btn danger" onClick={() => setDel(true)}>Delete account</button>
        </DangerBox>}
    <Modal open={pw} title="Change password" onClose={() => setPw(false)}><PasswordBody onClose={() => setPw(false)} /></Modal>
    <Modal open={del} title="Delete account" onClose={() => setDel(false)}><DeleteBody onClose={() => setDel(false)} /></Modal>
  </>)
}
