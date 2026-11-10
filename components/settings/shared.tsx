'use client'
import { ReactNode } from 'react'
import { cx } from '@/lib/tw'

export function TabHead({ title, desc }: { title: string; desc: string }) {
  return (<>
    <h2 className="m-0 font-head text-2xl">{title}</h2>
    <p className="mb-5 mt-1.5 text-sm text-mute">{desc}</p>
  </>)
}

// One setting: name and explanation on the left, the control on the right.
export function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0"><b className="block text-[15px]">{title}</b>{desc ? <span className="mt-0.5 block text-[13px] text-mute">{desc}</span> : null}</div>
      <div className="flex-none">{children}</div>
    </div>
  )
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx('flex h-[26px] w-[46px] cursor-pointer items-center rounded-full border-0 p-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50', on ? 'justify-end bg-acc' : 'justify-start bg-line')}>
      <span className={cx('block h-5 w-5 rounded-full', on ? 'bg-on' : 'bg-mute')} />
    </button>
  )
}

export const DangerBox = ({ title, text, children }: { title: string; text: string; children: ReactNode }) => (
  <div className="mt-7 flex flex-col gap-4 rounded-[14px] border border-bad bg-bad/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div><b className="text-[15px] text-bad">{title}</b><p className="m-0 mt-1 text-[13px]">{text}</p></div>
    <div className="flex-none">{children}</div>
  </div>
)

export const inputCls = 'mt-0 w-full'
