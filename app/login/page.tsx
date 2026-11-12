'use client'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabaseBrowser } from '@/lib/supabase/client'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'
import { markSessionActive } from '@/lib/session'
import { emailOk, pwErr } from '@/lib/validate'
import { btn, cx, err, errBase, panel } from '@/lib/tw'

type Conn = 'checking' | 'ok' | 'missing' | 'unreachable' | 'badkey'
const NET = /failed to fetch|networkerror|load failed|fetch failed/i
const COMPANY_EXISTS = 'Account/company name already exists. Choose a different company name.'

export default function Login() {
  const sb = supabaseBrowser()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [f, setF] = useState({ name: '', company: '', email: '', pw: '', pw2: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [msg, setMsg] = useState('')
  const [good, setGood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conn, setConn] = useState<Conn>('checking')

  // Checks the connection to Supabase so a "failed to fetch" always comes with a reason.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('reason') === 'idle') setMsg('You were signed out after being inactive.')
    if (!SUPABASE_URL || !SUPABASE_KEY) { setConn('missing'); return }
    fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => setConn(r.status === 401 || r.status === 403 ? 'badkey' : 'ok'))
      .catch(() => setConn('unreachable'))
  }, [])

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const bad = (m: string) => { setGood(false); setMsg(NET.test(m) ? 'Cannot reach the server. See the red notice above for what to check.' : m) }
  const host = SUPABASE_URL.replace(/^https?:\/\//, '')
  const tidy = (v: string) => v.trim().replace(/\s+/g, ' ')

  // Asks the database whether another company already uses this name.
  async function companyTaken(name: string) {
    try { const { data, error } = await sb.rpc('company_name_taken', { p_name: name }); return !error && data === true }
    catch { return false }
  }

  async function submit() {
    setMsg(''); setBusy(true)
    try {
      const email = f.email.trim().toLowerCase()
      if (!emailOk(email)) return bad('Enter a valid email address, like name@company.com.')
      if (mode === 'login') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: f.pw })
        if (error) return bad(/not confirmed/i.test(error.message) ? 'Confirm your email first. Check your inbox.' : NET.test(error.message) ? error.message : /banned|disabled/i.test(error.message) ? 'This account has been disabled. Ask your admin.' : 'Email or password is incorrect.')
        if (data.user?.id) markSessionActive(data.user.id)
        location.href = '/'
        return
      }
      if (f.name.trim().length < 2) return bad('Enter your full name.')
      const company = tidy(f.company)
      if (company.length < 2) return bad('Enter your company or business name.')
      if (company.length > 80) return bad('The company name can have at most 80 characters.')
      const e = pwErr(f.pw); if (e) return bad(e)
      if (f.pw !== f.pw2) return bad('Passwords do not match.')
      if (await companyTaken(company)) return bad(COMPANY_EXISTS)
      const { error } = await sb.auth.signUp({
        email, password: f.pw,
        options: { emailRedirectTo: location.origin + '/auth/callback', data: { full_name: f.name.trim(), role: 'admin', company_name: company } },
      })
      if (error) {
        // The database refuses a second company with the same name, even if two people try at the same moment.
        if (/database error saving new user/i.test(error.message)) return bad((await companyTaken(company)) ? COMPANY_EXISTS : 'Could not create the account. Try again in a moment.')
        return bad(error.message)
      }
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

  const tab = (active: boolean) => cx('flex-1 cursor-pointer rounded-[7px] border-0 px-2 py-2.5 font-semibold sm:py-2', active ? 'bg-panel text-acc' : 'bg-transparent text-mute')
  const notice = 'my-3 rounded-[10px] bg-badsoft px-3 py-2.5 text-[13px] text-bad'
  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-6 pt-16">
      <div className="fixed right-[calc(14px_+_env(safe-area-inset-right,0px))] top-[calc(14px_+_env(safe-area-inset-top,0px))] z-[5]"><ThemeToggle /></div>
      <div className={cx(panel, 'w-full max-w-[440px]')}>
        <div className="mb-1 flex items-center gap-3"><img src="/logo-icon.svg" alt="" width={44} height={44} /><h1 className="m-0">Stockroom</h1></div>
        <p className="m-0 text-mute">Stock balances for every store, in one place.</p>
        {conn === 'missing' && <div className={notice} role="alert">The Supabase address or key is missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env.local, or in Vercel then redeploy).</div>}
        {conn === 'unreachable' && <div className={notice} role="alert">Cannot reach Supabase at <b>{host}</b>. Check that: the project is not paused (open the Supabase dashboard and Restore it); the URL has no typo, quotes or spaces; no ad blocker or firewall blocks supabase.co; and on Vercel you redeployed after setting the variables.</div>}
        {conn === 'badkey' && <div className={notice} role="alert">Supabase rejected the key. Copy the anon (or publishable) key from Project Settings, API, then update NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy.</div>}
        <div className="mb-4 mt-3.5 flex gap-1 rounded-[10px] bg-bg p-1">
          <button className={tab(!signup)} onClick={() => { setMode('login'); setMsg(''); setShowPassword(false); setShowConfirmPassword(false) }}>Log in</button>
          <button className={tab(signup)} onClick={() => { setMode('signup'); setMsg(''); setShowPassword(false); setShowConfirmPassword(false) }}>Sign up</button>
        </div>
        {signup && <p className="-mt-1 mb-3 text-[13px] text-mute">Create the admin account for your company. Each company has one admin, who then creates the store manager accounts from the Team page.</p>}
        {signup && <label>Full name<input value={f.name} onChange={set('name')} placeholder="Enter your full name" autoComplete="name" /></label>}
        {signup && <label>Company / business name
          <input value={f.company} onChange={set('company')} placeholder="Company / business name" maxLength={80} autoComplete="organization"
            onBlur={async () => { const c = tidy(f.company); if (c.length >= 2 && await companyTaken(c)) bad(COMPANY_EXISTS) }} /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} placeholder="name@example.com" autoComplete="email" /></label>
        <label>Password
          <span className="relative block">
            <input className="pr-11" type={showPassword ? 'text' : 'password'} value={f.pw} onChange={set('pw')} placeholder={signup ? 'Create a password' : 'Enter your password'} autoComplete={signup ? 'new-password' : 'current-password'} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded border-0 bg-transparent p-1 text-mute hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {showPassword
                  ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
                  : <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a13.7 13.7 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8" /></>}
              </svg>
            </button>
          </span>
        </label>
        {signup && <>
          <p className="-mt-1.5 mb-2.5 text-xs text-mute">At least 8 characters with upper and lower case letters, a number and a symbol.</p>
          <label>Confirm password
            <span className="relative block">
              <input className="pr-11" type={showConfirmPassword ? 'text' : 'password'} value={f.pw2} onChange={set('pw2')} placeholder="Re-enter your password" autoComplete="new-password" />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded border-0 bg-transparent p-1 text-mute hover:text-ink" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {showConfirmPassword
                    ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
                    : <><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a13.7 13.7 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8" /></>}
                </svg>
              </button>
            </span>
          </label>
        </>}
        <p role="alert" className={cx(errBase, good ? 'text-acc' : 'text-bad')}>{msg}</p>
        <button className={btn('primary', 'md', true)} disabled={busy} onClick={submit}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
        {!signup && <>
          <div className="my-3 text-center text-[13px] text-mute">or</div>
          <button className={btn('ghost', 'md', true)} onClick={google}>Continue with Google</button>
        </>}
      </div>
    </main>
  )
}
