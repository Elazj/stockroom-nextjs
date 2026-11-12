'use client'
import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastHost } from '@/components/ui'
import OfflineBar from '@/components/OfflineBar'
import { Icon } from '@/components/icons'
import { useLive } from '@/lib/data'
import { cx, iconbtn } from '@/lib/tw'

const NAV: Record<string, [string, string, string][]> = {
  admin: [['/admin', 'Dashboard', 'dashboard'], ['/admin/stores', 'Stores', 'stores'], ['/admin/team', 'Team', 'users'], ['/admin/products', 'Products', 'products'], ['/admin/supplies', 'Supplies', 'supplies'], ['/admin/forecast', 'Forecast', 'forecast'], ['/admin/reports', 'Reports', 'reports'], ['/admin/settings', 'Settings', 'settings']],
  manager: [['/manager', 'Dashboard', 'dashboard'], ['/manager/entry', 'Daily entry', 'entry'], ['/manager/forecast', 'Forecast', 'forecast'], ['/manager/reports', 'Reports', 'reports'], ['/manager/settings', 'Settings', 'settings']],
}

const linkCls = (active: boolean) => cx(
  'flex items-center justify-start gap-2.5 rounded-lg px-2.5 py-2 no-underline transition-colors [@media(pointer:coarse)]:min-h-11',
  active ? 'bg-accsoft font-semibold text-acc shadow-[inset_3px_0_0_var(--acc)]' : 'text-mute hover:bg-bg',
)

function OpenReports() {
  const { data } = useLive(async (sb) => (await sb.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false)).count ?? 0, ['reports'])
  return data ? <span className="ml-auto rounded-full bg-bad px-[7px] text-[11px] text-white">{data}</span> : null
}

export default function Shell({ role, name, sub, company, avatarUrl, children }: { role: 'admin' | 'manager'; name: string; sub?: string; company?: string; avatarUrl?: string; children: ReactNode }) {
  const path = usePathname()
  const [open, setOpen] = useState(false) // side bar on small screens
  const on = (h: string) => (h === '/' + role ? path === h : path.startsWith(h))
  const profile = `/${role}/settings/profile`
  const [showCompany, setShowCompany] = useState(true) // Appearance > show the company name in the side bar

  useEffect(() => {
    const read = () => { try { setShowCompany(localStorage.getItem('stockroom-hide-company') !== '1') } catch {} }
    read()
    window.addEventListener('stockroom-appearance', read)
    return () => window.removeEventListener('stockroom-appearance', read)
  }, [])

  useEffect(() => { setOpen(false) }, [path]) // close after choosing a tab

  useEffect(() => {
    document.body.classList.toggle('nav-open', open) // stops the page scrolling behind the side bar
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); document.body.classList.remove('nav-open') }
  }, [open])

  useEffect(() => { // close if the screen grows to desktop size
    const mq = matchMedia('(min-width: 1000px)')
    const h = () => { if (mq.matches) setOpen(false) }
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  return (
    <div className="min-h-dvh lg:flex">
      {/* top bar: phones and tablets */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-panel pb-2 pl-[calc(12px_+_env(safe-area-inset-left,0px))] pr-[calc(12px_+_env(safe-area-inset-right,0px))] pt-[calc(8px_+_env(safe-area-inset-top,0px))] lg:hidden">
        <button className={iconbtn} aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <img src="/logo-icon.svg" alt="" width={28} height={28} />
        <span className="font-head text-[19px] font-semibold">Stockroom</span>
      </header>

      {/* dark area behind the open side bar */}
      <div onClick={() => setOpen(false)} aria-hidden="true"
        className={cx('fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} />

      <aside id="sidebar" aria-label="Main menu"
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(300px,86vw)] flex-col gap-1 overflow-y-auto border-r border-line bg-panel pl-[calc(12px_+_env(safe-area-inset-left,0px))] pr-3 pt-[calc(16px_+_env(safe-area-inset-top,0px))] pb-[calc(16px_+_env(safe-area-inset-bottom,0px))] shadow-panel transition-[transform,visibility] duration-200 ease-out',
          'lg:sticky lg:top-0 lg:z-auto lg:w-[230px] lg:flex-none lg:visible lg:translate-x-0 lg:pb-5 lg:pl-3 lg:pt-5 lg:shadow-none lg:transition-none',
          open ? 'visible translate-x-0' : 'invisible -translate-x-[105%]',
        )}>
        <div className="flex items-center gap-2.5 px-2 pb-4 font-head text-[21px] font-semibold">
          <img src="/logo-icon.svg" alt="" width={30} height={30} />
          <span className="bg-stockroom bg-clip-text text-transparent">Stockroom</span>
          <button className={cx(iconbtn, 'ml-auto lg:hidden')} aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {company && showCompany ? <div className="-mt-2 mb-3 truncate px-2 text-[13px] font-semibold text-mute" title={company}>{company}</div> : null}
        <nav className="flex flex-col gap-0.5">
          {NAV[role].map(([h, l, ic]) => (
            <Link key={h} href={h} className={linkCls(on(h))} aria-current={on(h) ? 'page' : undefined}>
              <Icon name={ic} />{l}{role === 'admin' && h === '/admin/reports' ? <OpenReports /> : null}
            </Link>
          ))}
        </nav>
        <Link href={profile} aria-current={path === profile ? 'page' : undefined} aria-label={`${name}, account and profile`}
          className={cx('mt-auto flex items-center gap-3 rounded-2xl border p-3 no-underline transition-colors hover:bg-accsoft', path === profile ? 'border-acc bg-accsoft' : 'border-line')}>
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="h-11 w-11 flex-none rounded-full object-cover" />
            : <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accsoft text-acc"><Icon name="user" size={24} /></span>}
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px]">{name}</b>
            <span className="block truncate text-[13px] text-mute">{role === 'admin' ? 'Admin account' : 'Store manager' + (sub ? ' · ' + sub : '')}</span>
          </span>
          <Icon name="chevron" size={18} className="flex-none text-mute" />
        </Link>
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 px-3 pb-9 pt-3.5 min-[1500px]:max-w-[1360px] sm:px-[18px] sm:pt-[18px] lg:px-7 lg:pb-12 lg:pt-6 [&>*]:animate-fadeup">
        {role === 'manager' ? <OfflineBar /> : null}
        {children}
      </main>
      <ToastHost />
    </div>
  )
}
