'use client'
import { ChangeEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui'
import { friendly, q, toast } from '@/lib/data'
import { emailOk, pwErr } from '@/lib/validate'
import { supabaseBrowser } from '@/lib/supabase/client'
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
  const [email, setEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pw, setPw] = useState(false)
  const [del, setDel] = useState(false)

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser()
      const { data: { user }, error } = await sb.auth.getUser()
      if (error) throw error
      const p = await q(sb.from('profiles').select('full_name, store_id, avatar_path, companies(name)').eq('id', user?.id ?? '').single())
      const store = p.store_id ? (await q(sb.from('stores').select('name').eq('id', p.store_id).single())).name : ''
      const co = p.companies
      const path = p.avatar_path ?? ''
      setMe({ email: user?.email ?? '', pendingEmail: user?.new_email ?? '', store, company: (Array.isArray(co) ? co[0]?.name : co?.name) ?? '' })
      setName(p.full_name ?? '')
      setEmail(user?.new_email ?? user?.email ?? '')
      if (path) setAvatarUrl(sb.storage.from('avatars').getPublicUrl(path).data.publicUrl)
    })().catch((error) => {
      setMsg(friendly(error?.message ?? 'Could not load your profile.'))
      setMe({ email: '', pendingEmail: '', store: '', company: '' })
    })
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

  async function saveEmail() {
    setEmailMsg('')
    const nextEmail = email.trim().toLowerCase()
    if (!emailOk(nextEmail)) return setEmailMsg('Enter a valid email address.')
    if (nextEmail === me.email.toLowerCase()) return setEmailMsg('Enter a different email address.')
    setEmailBusy(true)
    try {
      const { data, error } = await supabaseBrowser().auth.updateUser({
        email: nextEmail,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (error) return setEmailMsg(friendly(error.message))
      if (data.user?.new_email) {
        setMe({ ...me, pendingEmail: data.user.new_email })
        setEmailMsg('Confirmation requested. Check your confirmation email to finish changing your sign-in address.')
      } else {
        setMe({ ...me, email: data.user?.email ?? nextEmail, pendingEmail: '' })
        setEmailMsg('Email updated.')
        setEmail(data.user?.email ?? nextEmail)
      }
    } catch (error) {
      setEmailMsg(error instanceof Error ? friendly(error.message) : 'Could not update your email.')
    } finally {
      setEmailBusy(false)
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoMsg('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setPhotoMsg('Choose a JPG, PNG, or WebP image.')
    if (file.size > 5 * 1024 * 1024) return setPhotoMsg('The image must be 5 MB or smaller.')
    setPhotoBusy(true)
    try {
      const sb = supabaseBrowser()
      const { data: { user }, error: userError } = await sb.auth.getUser()
      if (userError) return setPhotoMsg(friendly(userError.message))
      if (!user) return setPhotoMsg('Sign in again before uploading a profile picture.')
      const path = `${user.id}/avatar`
      const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: true,
      })
      if (uploadError) return setPhotoMsg(friendly(uploadError.message))
      const { error } = await sb.rpc('update_my_avatar', { p_avatar_path: path })
      if (error) return setPhotoMsg(friendly(error.message))
      setAvatarUrl(`${sb.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`)
      toast('Profile picture updated')
      router.refresh()
    } catch (error) {
      setPhotoMsg(error instanceof Error ? friendly(error.message) : 'Could not upload the profile picture.')
    } finally {
      setPhotoBusy(false)
    }
  }

  if (!me) return <p className="mute m-0">Loading…</p>
  return (<>
    <TabHead title="Account & Profile" desc="Your account and sign-in details." />
    <div className="mb-5 flex items-center gap-4">
      {avatarUrl
        ? <img src={avatarUrl} alt="Your profile" className="h-20 w-20 rounded-full border border-line object-cover" />
        : <span className="grid h-20 w-20 place-items-center rounded-full bg-accsoft text-acc"><span className="text-2xl font-semibold">{name.trim().charAt(0).toUpperCase() || '?'}</span></span>}
      <div>
        <label className="btn ghost inline-flex cursor-pointer items-center">
          {photoBusy ? 'Uploading…' : 'Upload profile picture'}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={uploadPhoto} />
        </label>
        <p className="mb-0 mt-1 text-xs text-mute">JPG, PNG, or WebP; up to 5 MB.</p>
        {photoMsg ? <p className="err mb-0 mt-1" role="alert">{photoMsg}</p> : null}
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="m-0">Full name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      {role === 'admin'
        ? <label className="m-0">Sign-in email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        : <label className="m-0">Email<input value={me.email} readOnly /></label>}
      <label className="m-0">Company<input value={me.company} readOnly /></label>
      {role === 'manager' ? <label className="m-0">Store<input value={me.store || '-'} readOnly /></label> : null}
      <label className="m-0">Account type<input value={role === 'admin' ? 'Admin' : 'Store manager'} readOnly /></label>
    </div>
    <p className="err mt-3" role="alert">{msg}</p>
    {role === 'admin' ? <div className="mt-3">
      <p className={emailMsg === 'Email updated.' || emailMsg.startsWith('Confirmation requested.') ? 'text-sm text-mute' : 'err'} role="status">{emailMsg}</p>
      {me.pendingEmail ? <p className="text-sm text-mute">Pending email confirmation: {me.pendingEmail}</p> : null}
    </div> : null}
    <div className="flex flex-wrap gap-3">
      <button className="btn" disabled={busy} onClick={save}>Save profile</button>
      {role === 'admin' ? <button className="btn ghost" disabled={emailBusy} onClick={saveEmail}>{emailBusy ? 'Saving…' : 'Update email'}</button> : null}
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
