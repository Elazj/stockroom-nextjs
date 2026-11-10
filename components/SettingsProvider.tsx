'use client'
import { createContext, ReactNode, useContext, useMemo } from 'react'
import { applySettings, CompanySettings, DEFAULT_SETTINGS, normalizeSettings } from '@/lib/settings'

const Ctx = createContext<CompanySettings>(DEFAULT_SETTINGS)

// Wraps the signed-in area. The layouts read companies.settings on the server and pass it in here.
export function SettingsProvider({ value, children }: { value: unknown; children: ReactNode }) {
  const key = JSON.stringify(value ?? {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = useMemo(() => normalizeSettings(value), [key])
  applySettings(s) // before the children render, so the date and stock-level helpers see the new values
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
