'use client'
import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/icons'
import { cx } from '@/lib/tw'

export type Role = 'admin' | 'manager'

// [address, label, icon]. Account & Profile is not listed: it opens from the profile at the bottom of the side bar.
export const MENU: Record<Role, [string, string, string][]> = {
  admin: [
    ['general', 'General Settings', 'sliders'], ['users', 'User Management', 'users'], ['roles', 'Roles & Permissions', 'shield'],
    ['inventory', 'Inventory Configuration', 'warehouse'], ['security', 'Security', 'shield'], ['notifications', 'Notifications', 'bell'], ['appearance', 'Appearance', 'palette'],
    ['backup', 'Backup & Restore', 'database'], ['activity', 'Activity Logs', 'history'], ['about', 'About System', 'info'],
  ],
  manager: [['notifications', 'Notifications', 'bell'], ['appearance', 'Appearance', 'palette'], ['activity', 'My Activity', 'history'], ['about', 'About System', 'info']],
}

export default function SettingsFrame({ role, children }: { role: Role; children: ReactNode }) {
  const path = usePathname()
  return (<>
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1>Settings</h1>
        <p className="mt-1.5 text-[15px] text-mute">{role === 'admin' ? 'Manage your company\u2019s inventory preferences and configuration.' : 'Manage your account and preferences.'}</p>
      </div>
      <span className="flex-none rounded-full bg-accsoft px-3.5 py-1.5 text-[13px] font-bold text-acc">{role === 'admin' ? 'Admin panel' : 'Store manager'}</span>
    </div>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <nav aria-label="Settings sections" className="flex w-full flex-none flex-col gap-0.5 rounded-2xl border border-line bg-panel p-2.5 lg:sticky lg:top-6 lg:w-[290px]">
        {MENU[role].map(([tab, label, icon]) => {
          const href = `/${role}/settings/${tab}`
          const on = path === href
          return (
            <Link key={tab} href={href} aria-current={on ? 'page' : undefined}
              className={cx('flex min-h-11 items-center justify-start gap-2.5 rounded-xl px-3.5 text-[15px] font-semibold no-underline transition-colors', on ? 'bg-accsoft text-acc' : 'text-ink hover:bg-accsoft')}>
              <Icon name={icon} />{label}
            </Link>
          )
        })}
      </nav>
      <section className="min-w-0 flex-1 rounded-2xl border border-line bg-panel p-5 sm:p-7 [&_.btn]:w-auto">{children}</section>
    </div>
  </>)
}
