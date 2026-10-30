'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

const emailOk = (e: string) => e.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(e) && !/\.\./.test(e)
const pwErr = (p: string) =>
  p.length < 8 ? 'Password needs at least 8 characters.' :
  !/[a-z]/.test(p) || !/[A-Z]/.test(p) ? 'Password needs upper and lower case letters.' :
  !/\d/.test(p) ? 'Password needs a number.' :
  !/[^A-Za-z0-9]/.test(p) ? 'Password needs a symbol such as ! or #.' : ''

export default function Login() {
  const sb = supabaseBrowser()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '', role: 'manager', store: '' })
  const [stores, setStores] = useState<{ id: string; name: string; accounts: number }[]>([])
  const [msg, setMsg] = useState('')
  const [good, setGood] = useState(false)
  useEffect(() => { sb.rpc('open_stores').then(({ data }) => setStores(data ?? [])) }, [])
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const bad = (m: string) => { setGood(false); setMsg(m) }
  const showFetchError = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    if (!/failed to fetch|fetch failed|network request failed/i.test(message)) return false
    bad('Could not reach Supabase. Check your Supabase URL and publishable key, then restart the app and try again.')
    return true
  }

  async function submit() {
    setMsg('')
    const email = f.email.trim().toLowerCase()
    if (!emailOk(email)) return bad('Enter a valid email address, like name@company.com.')
    if (mode === 'login') {
      let error
      try {
        ({ error } = await sb.auth.signInWithPassword({ email, password: f.pw }))
      } catch (error) {
        if (showFetchError(error)) return
        throw error
      }
      if (error) {
        if (showFetchError(error)) return
        return bad(error.message.includes('not confirmed') ? 'Confirm your email first. Check your inbox.' : 'Email or password is incorrect.')
      }
      location.href = '/'
      return
    }
    if (f.name.trim().length < 2) return bad('Enter your full name.')
    const e = pwErr(f.pw); if (e) return bad(e)
    if (f.pw !== f.pw2) return bad('Passwords do not match.')
    if (f.role === 'manager' && !f.store) return bad('Choose your store.')
    let error
    try {
      ({ error } = await sb.auth.signUp({
        email, password: f.pw,
        options: { emailRedirectTo: location.origin + '/auth/callback', data: { full_name: f.name.trim(), role: f.role, store_id: f.role === 'manager' ? f.store : '' } },
      }))
    } catch (error) {
      if (showFetchError(error)) return
      throw error
    }
    if (error) {
      if (showFetchError(error)) return
      return bad(error.message)
    }
    setGood(true); setMsg('Check your inbox and confirm your email, then log in.')
  }
  const google = async () => {
    setMsg('')
    try {
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/auth/callback' } })
      if (error && !showFetchError(error)) bad(error.message)
    } catch (error) {
      if (!showFetchError(error)) throw error
    }
  }
  const signup = mode === 'signup'

  return (
    <main className="auth">
      <div className="theme-fab"><ThemeToggle /></div>
      <div className="panel card">
        <h1>Stockroom</h1>
        <p className="mute" style={{ margin: 0 }}>Stock balances for every store, in one place.</p>
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
              {stores.map(s => <option key={s.id} value={s.id} disabled={s.accounts >= 3}>{s.name} ({s.accounts}/3 accounts)</option>)}
            </select></label>}
        </>)}
        <label>Password<input type="password" value={f.pw} onChange={set('pw')} autoComplete={signup ? 'new-password' : 'current-password'} /></label>
        {signup && <>
          <p className="mute" style={{ fontSize: 12, margin: '-6px 0 10px' }}>At least 8 characters with upper and lower case letters, a number and a symbol.</p>
          <label>Confirm password<input type="password" value={f.pw2} onChange={set('pw2')} autoComplete="new-password" /></label></>}
        <p role="alert" className={good ? 'err ok' : 'err'}>{msg}</p>
        <button className="btn" onClick={submit}>{signup ? 'Create account' : 'Log in'}</button>
        <div className="or">or</div>
        <button className="btn ghost" onClick={google}>Continue with Google</button>
      </div>
    </main>
  )
}
