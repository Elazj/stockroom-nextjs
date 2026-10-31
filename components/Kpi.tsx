import type { ReactNode } from 'react'

const ICONS: Record<string, ReactNode> = {
  store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
  box: <><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>,
  layers: <><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="m2 13 10 5 10-5" /></>,
  send: <path d="M7 17 17 7M8 7h9v9" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></>,
  archive: <><path d="M4 4h16v5H4z" /><path d="M6 9v11h12V9M10 13h4" /></>,
  flag: <path d="M5 21V4M5 4h12l-2 4 2 4H5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

export function Kpi({ icon, label, value, tone }: { icon: keyof typeof ICONS; label: string; value: ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <div className="panel kpi">
      <div className={'ic ' + (tone ?? '')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
      </div>
      <div><b>{value}</b><small>{label}</small></div>
    </div>
  )
}
