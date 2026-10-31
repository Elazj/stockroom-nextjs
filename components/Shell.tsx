'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastHost } from '@/components/ui'
import { useLive } from '@/lib/data'

const NAV: Record<string, [string, string][]> = {
  admin: [['/admin', 'Dashboard'], ['/admin/stores', 'Stores'], ['/admin/products', 'Products'], ['/admin/supplies', 'Supplies'], ['/admin/reports', 'Reports']],
  manager: [['/manager', 'Dashboard'], ['/manager/entry', 'Daily entry'], ['/manager/reports', 'Reports']],
}

function OpenReports() {
  const { data } = useLive(async (sb) => (await sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false)).count ?? 0, ['reports'])
  return data ? <span className="badge">{data}</span> : null
}

export default function Shell({ role, name, sub, children }: { role: 'admin' | 'manager'; name: string; sub?: string; children: ReactNode }) {
  const path = usePathname()
  const on = (h: string) => (h === '/' + role ? path === h : path.startsWith(h))
  const settings = `/${role}/settings`
  return (
    <div className="app">
      <aside>
        <div className="brand"><img src="/logo-icon.svg" alt="" width={30} height={30} /><span>Stockroom</span></div>
        <nav>
          {NAV[role].map(([h, l]) => (
            <Link key={h} href={h} className={on(h) ? 'on' : ''}>{l}{role === 'admin' && h === '/admin/reports' ? <OpenReports /> : null}</Link>
          ))}
        </nav>
        <div className="foot">
          <div className="who"><b>{name}</b><span className="mute">{role === 'admin' ? 'Admin' : 'Store manager'}{sub ? ', ' + sub : ''}</span></div>
          <Link href={settings} className={'setlink' + (on(settings) ? ' on' : '')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" />
            </svg>
            Settings
          </Link>
        </div>
      </aside>
      <main className="main">{children}</main>
      <ToastHost />
    </div>
  )
}
