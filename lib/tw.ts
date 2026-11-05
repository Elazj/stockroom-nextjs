type ButtonVariant = 'primary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function btn(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', full = false) {
  return cx(
    'inline-flex cursor-pointer items-center justify-center rounded-lg border px-3.5 py-2.5 font-semibold transition-[transform,box-shadow] duration-150 ease-in-out hover:-translate-y-px disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' && 'border-transparent bg-acc text-on hover:shadow-[0_6px_16px_rgba(22,115,187,0.3)]',
    variant === 'ghost' && 'border-line bg-transparent text-ink',
    variant === 'danger' && 'border-transparent bg-bad text-white',
    size === 'sm' && 'px-3 py-1.5 text-[13px]',
    full && 'w-full',
  )
}

export const panel = 'rounded-2xl border border-transparent bg-panel p-4 shadow-panel'
export const err = 'mb-2 min-h-[22px] text-[13px] text-bad'
export const errBase = 'mb-2 min-h-[22px] text-[13px]'
export const iconbtn = 'inline-grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[10px] border border-line bg-panel'
export const chip = 'chip'
export const chipOut = 'chip out'
