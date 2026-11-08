'use client'
import { useEffect, useState } from 'react'
import { Hd, Modal } from '@/components/ui'
import ThemeToggle from '@/components/ThemeToggle'
import SignOut from '@/components/SignOut'
import { q, toast } from '@/lib/data'
import { pwErr } from '@/lib/validate'
import { supabaseBrowser } from '@/lib/supabase/client'

function ResetBody({ onClose }: { onClose: () => void }) {
  const [wipe, setWipe] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (text.trim() !== 'RESET') return setErr('Type RESET to confirm.')
    setBusy(true); setErr('')
    const { error } = await supabaseBrowser().rpc('reset_all_data', { wipe_accounts: wipe })
    setBusy(false)
    if (error) {
      return setErr(/could not find the function|schema cache/i.test(error.message)
        ? 'The reset function is missing or outdated in your database. Run supabase/migration-007.sql in the Supabase SQL editor, then try again.'
        : error.message)
    }
    toast('Everything has been cleared')
    setTimeout(() => { location.href = '/admin' }, 700)
    onClose()
  }
  return (<>
    <p className="mute mt-0">This permanently deletes every store, product, supply, sheet entry, gift, report and activity record of your company. Other companies are not affected. It cannot be undone.</p>
    <label className="flex items-center gap-2">
      <input type="checkbox" className="m-0 w-auto" checked={wipe} onChange={(e) => setWipe(e.target.checked)} /> Also delete all store manager accounts of this company
    </label>
    <label>Type RESET to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" /></label>
    <p className="err" role="alert">{err}</p>
    <div className="mfoot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Resetting…' : 'Reset everything'}</button></div>
  </>)
}

function ResetData() {
  const [open, setOpen] = useState(false)
  return (<>
    <button className="btn danger sm" onClick={() => setOpen(true)}>Reset all data</button>
    <Modal open={open} title="Reset all data" onClose={() => setOpen(false)}><ResetBody onClose={() => setOpen(false)} /></Modal>
  </>)
}

function DeleteAccountBody({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    if (text.trim() !== 'DELETE') return setErr('Type DELETE to confirm.')
    setBusy(true); setErr('')
    const sb = supabaseBrowser()
    const { error } = await sb.rpc('delete_my_account')
    if (error) {
      setBusy(false)
      return setErr(/could not find the function|schema cache/i.test(error.message)
        ? 'The database is missing this update. Run supabase/migration-008.sql in the Supabase SQL editor, then try again.'
        : error.message)
    }
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

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  return (<>
    <button className="btn danger sm" onClick={() => setOpen(true)}>Delete account</button>
    <Modal open={open} title="Delete account" onClose={() => setOpen(false)}><DeleteAccountBody onClose={() => setOpen(false)} /></Modal>
  </>)
}

function Password() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [m, setM] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  async function save() {
    setOk(false)
    const e = pwErr(a); if (e) return setM(e)
    if (a !== b) return setM('Passwords do not match.')
    setBusy(true)
    const { error } = await supabaseBrowser().auth.updateUser({ password: a })
    setBusy(false)
    if (error) return setM(error.message)
    setOk(true); setM('Password updated.'); setA(''); setB('')
  }
  return (<>
    <label>New password<input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></label>
    <label>Confirm new password<input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></label>
    <p className={ok ? 'err ok' : 'err'} role="alert">{m}</p>
    <button className="btn sm" disabled={busy} onClick={save}>Update password</button>
  </>)
}

export default function Settings({ role }: { role: 'admin' | 'manager' }) {
  const [me, setMe] = useState<any>(null)
  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      const p = await q(sb.from('profiles').select('full_name, role, store_id, companies(name)').eq('id', user?.id ?? '').single())
      const store = p.store_id ? (await q(sb.from('stores').select('name').eq('id', p.store_id).single())).name : ''
      const co = p.companies
      setMe({ email: user?.email ?? '', ...p, store, company: (Array.isArray(co) ? co[0]?.name : co?.name) ?? '' })
    })().catch(() => setMe({ email: '', full_name: '', role, store: '' }))
  }, [role])
  return (<>
    <Hd title="Settings" sub="Your account and preferences" />
    <div className="set">
      <div className="panel"><h2>Profile</h2>
        {me ? <dl className="dl">
          <dt>Name</dt><dd>{me.full_name || '-'}</dd>
          <dt>Email</dt><dd>{me.email || '-'}</dd>
          <dt>Company</dt><dd>{me.company || '-'}</dd>
          <dt>Account type</dt><dd>{role === 'admin' ? 'Admin' : 'Store manager'}</dd>
          {role === 'manager' ? <><dt>Store</dt><dd>{me.store || '-'}</dd></> : null}
        </dl> : <p className="mute">Loading…</p>}
      </div>
      <div className="panel"><h2>Appearance</h2>
        <p className="mute mt-0">Choose a dark or light look. Your choice is remembered on this device.</p>
        <ThemeToggle />
      </div>
      <div className="panel"><h2>Change password</h2><Password /></div>
      <div className="panel"><h2>Session</h2>
        <p className="mute mt-0">Sign out of Stockroom on this device.</p>
        <SignOut />
      </div>
      {role === 'admin' ? (
        <div className="panel zone"><h2>Danger zone</h2>
          <p className="mute mt-0">Clear every store, product, supply, sheet, gift and report of your company. Use this to start fresh.</p>
          <ResetData />
          <p className="mute mb-2 mt-4">Delete your admin account, your company, all its data and all your store manager accounts, to start over from the sign-up page.</p>
          <DeleteAccount />
        </div>
      ) : null}
    </div>
  </>)
}
