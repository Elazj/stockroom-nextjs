'use client'
import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import SignOut from '@/components/SignOut'
import { Modal, ToastHost } from '@/components/ui'
import { q, toast, useLive } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

const NAV: Record<string, [string, string][]> = {
  admin: [['/admin', 'Dashboard'], ['/admin/stores', 'Stores'], ['/admin/products', 'Products'], ['/admin/supplies', 'Supplies'], ['/admin/reports', 'Reports']],
  manager: [['/manager', 'Dashboard'], ['/manager/entry', 'Daily entry'], ['/manager/reports', 'Reports']],
}

function OpenReports() {
  const { data } = useLive(async (sb) => (await sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false)).count ?? 0, ['reports'])
  return data ? <span className="badge">{data}</span> : null
}

function ResetButton() {
  const [open, setOpen] = useState(false)
  const [wipe, setWipe] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (text.trim() !== 'RESET') return toast('Type RESET to confirm.')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('reset_all_data', { wipe_accounts: wipe })
    setBusy(false)
    if (error) return toast(error.message)
    toast('Everything has been cleared')
    setOpen(false); setText(''); setWipe(false)
    setTimeout(() => location.reload(), 600)
  }
  return (<>
    <button className="btn ghost sm" onClick={() => setOpen(true)}>Reset all data</button>
    <Modal open={open} title="Reset all data" onClose={() => setOpen(false)}>
      <p className="mute" style={{ marginTop: 0 }}>This permanently deletes every store, product, supply, sheet entry, report and activity record. It cannot be undone.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={wipe} onChange={(e) => setWipe(e.target.checked)} /> Also delete all other user accounts
      </label>
      <label>Type RESET to confirm<input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" /></label>
      <div className="mfoot"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={busy} onClick={go}>Reset everything</button></div>
    </Modal>
  </>)
}

export default function Shell({ role, name, sub, children }: { role: 'admin' | 'manager'; name: string; sub?: string; children: ReactNode }) {
  const path = usePathname()
  const on = (h: string) => (h === '/' + role ? path === h : path.startsWith(h))
  return (
    <div className="app">
      <aside>
        <div className="brand">Stockroom</div>
        <nav>{NAV[role].map(([h, l]) => (
          <Link key={h} href={h} className={on(h) ? 'on' : ''}>{l}{role === 'admin' && h === '/admin/reports' ? <OpenReports /> : null}</Link>
        ))}</nav>
        <div className="foot">
          <div><b>{name}</b><span className="mute">{role === 'admin' ? 'Admin' : 'Store manager'}{sub ? ', ' + sub : ''}</span></div>
          <ThemeToggle />
          {role === 'admin' ? <ResetButton /> : null}
          <SignOut />
        </div>
      </aside>
      <main className="main">{children}</main>
      <ToastHost />
    </div>
  )
}
