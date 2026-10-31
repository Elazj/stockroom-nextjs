'use client'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabaseBrowser } from '@/lib/supabase/client'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import { emailOk, pwErr } from '@/lib/validate'

type Conn = 'checking' | 'ok' | 'missing' | 'unreachable' | 'badkey'
const NET = /failed to fetch|networkerror|load failed|fetch failed/i

export default function Login() {
  const sb = supabaseBrowser()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '', role: 'manager', store: '' })
  const [stores, setStores] = useState<{ id: string; name: string; accounts: number }[]>([])
  const [msg, setMsg] = useState('')
  const [good, setGood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conn, setConn] = useState<Conn>('checking')

  // Checks the connection to Supabase so a "failed to fetch" always comes with a reason.
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) { setConn('missing'); return }
    fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => setConn(r.status === 401 || r.status === 403 ? 'badkey' : 'ok'))
      .catch(() => setConn('unreachable'))
    sb.rpc('open_stores').then(({ data }) => setStores(data ?? []), () => {})
  }, [])

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const bad = (m: string) => { setGood(false); setMsg(NET.test(m) ? 'Cannot reach the server. See the red notice above for what to check.' : m) }
  const host = SUPABASE_URL.replace(/^https?:\/\//, '')

  async function submit() {
    setMsg(''); setBusy(true)
    try {
      const email = f.email.trim().toLowerCase()
      if (!emailOk(email)) return bad('Enter a valid email address, like name@company.com.')
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password: f.pw })
        if (error) return bad(/not confirmed/i.test(error.message) ? 'Confirm your email first. Check your inbox.' : NET.test(error.message) ? error.message : 'Email or password is incorrect.')
        location.href = '/'
        return
      }
      if (f.name.trim().length < 2) return bad('Enter your full name.')
      const e = pwErr(f.pw); if (e) return bad(e)
      if (f.pw !== f.pw2) return bad('Passwords do not match.')
      if (f.role === 'manager' && !f.store) return bad('Choose your store.')
      const { error } = await sb.auth.signUp({
        email, password: f.pw,
        options: { emailRedirectTo: location.origin + '/auth/callback', data: { full_name: f.name.trim(), role: f.role, store_id: f.role === 'manager' ? f.store : '' } },
      })
      if (error) return bad(error.message)
      setGood(true); setMsg('Check your inbox and confirm your email, then log in.')
    } catch (err: any) {
      bad(err?.message ?? 'Something went wrong. Try again.')
    } finally { setBusy(false) }
  }
  async function google() {
    try { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/auth/callback' } }); if (error) bad(error.message) }
    catch (err: any) { bad(err?.message ?? 'Google sign-in failed.') }
  }
  const signup = mode === 'signup'

  return (
    <main className="auth">
      <div className="theme-fab"><ThemeToggle /></div>
      <div className="panel card">
        <div className="authlogo"><img src="/logo-icon.svg" alt="" width={44} height={44} /><h1>Stockroom</h1></div>
        <p className="mute m-0">Stock balances for every store, in one place.</p>
        {conn === 'missing' && <div className="banner" role="alert">The Supabase address or key is missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env.local, or in Vercel then redeploy).</div>}
        {conn === 'unreachable' && <div className="banner" role="alert">Cannot reach Supabase at <b>{host}</b>. Check that: the project is not paused (open the Supabase dashboard and Restore it); the URL has no typo, quotes or spaces; no ad blocker or firewall blocks supabase.co; and on Vercel you redeployed after setting the variables.</div>}
        {conn === 'badkey' && <div className="banner" role="alert">Supabase rejected the key. Copy the anon (or publishable) key from Project Settings, API, then update NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy.</div>}
        <div className="tabs">
          <button className={signup ? '' : 'on'} onClick={() => { setMode('login'); setMsg('') }}>Log in</button>
          <button className={signup ? 'on' : ''} onClick={() => { setMode('signup'); setMsg('') }}>Sign up</button>
        </div>
        {signup && <label>Full name<input value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        {signup && (<>
          <label>Account type
            <select value={f.role} onChange={set('role')}><option value="manager">Store manager</option><option value="admin">Admin</option></select></label>
          {f.role === 'manager' && <label>Your store (up to 3 accounts each)
            <select value={f.store} onChange={set('store')}>
              <option value="">{stores.length ? 'Choose a store' : 'No stores yet'}</option>
              {stores.map((s) => <option key={s.id} value={s.id} disabled={s.accounts >= 3}>{s.name} ({s.accounts}/3 accounts)</option>)}
            </select></label>}
        </>)}
        <label>Password<input type="password" value={f.pw} onChange={set('pw')} autoComplete={signup ? 'new-password' : 'current-password'} /></label>
        {signup && <>
          <p className="mute -mt-1.5 mb-2.5 text-xs">At least 8 characters with upper and lower case letters, a number and a symbol.</p>
          <label>Confirm password<input type="password" value={f.pw2} onChange={set('pw2')} autoComplete="new-password" /></label></>}
        <p role="alert" className={good ? 'err ok' : 'err'}>{msg}</p>
        <button className="btn" disabled={busy} onClick={submit}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
        <div className="or">or</div>
        <button className="btn ghost" onClick={google}>Continue with Google</button>
      </div>
    </main>
  )
}
