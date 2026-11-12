// Company settings (set by the admin) and personal notification choices.
// Both are stored as JSON in the database (companies.settings, profiles.prefs); anything missing falls back to a default.

export type DateFormat = 'medium' | 'iso' | 'dmy' | 'mdy'

export type CompanySettings = {
  currency: string
  dateFormat: DateFormat
  timeZone: string        // '' means the time zone of the device
  language: string
  lowStockPct: number     // a product is "Low" when this percent or less of what was assigned is left
  defaultUnit: string
  forecastDays: number    // days of history the forecast looks at
  requireArrival: boolean // the date arrived must be entered on every product
  allowGifts: boolean     // store managers can record gifts
  sessionTimeoutMinutes: number
}

export const DEFAULT_SETTINGS: CompanySettings = {
  currency: 'USD', dateFormat: 'medium', timeZone: '', language: 'en',
  lowStockPct: 20, defaultUnit: 'pieces', forecastDays: 56, requireArrival: true, allowGifts: true, sessionTimeoutMinutes: 30,
}

const clamp = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v))
  return isFinite(n) && n >= min && n <= max ? n : d
}

export function normalizeSettings(raw: any): CompanySettings {
  const r = raw && typeof raw === 'object' ? raw : {}
  const d = DEFAULT_SETTINGS
  return {
    currency: typeof r.currency === 'string' && r.currency ? r.currency.slice(0, 12) : d.currency,
    dateFormat: ['medium', 'iso', 'dmy', 'mdy'].includes(r.dateFormat) ? r.dateFormat : d.dateFormat,
    timeZone: typeof r.timeZone === 'string' ? r.timeZone : d.timeZone,
    language: 'en',
    lowStockPct: clamp(r.lowStockPct, 1, 90, d.lowStockPct),
    defaultUnit: typeof r.defaultUnit === 'string' && r.defaultUnit.trim() ? r.defaultUnit.trim().slice(0, 20) : d.defaultUnit,
    forecastDays: clamp(r.forecastDays, 28, 90, d.forecastDays),
    requireArrival: typeof r.requireArrival === 'boolean' ? r.requireArrival : d.requireArrival,
    allowGifts: typeof r.allowGifts === 'boolean' ? r.allowGifts : d.allowGifts,
    sessionTimeoutMinutes: [5, 15, 30, 60, 120].includes(Number(r.sessionTimeoutMinutes)) ? Number(r.sessionTimeoutMinutes) : d.sessionTimeoutMinutes,
  }
}

// The settings in force right now. SettingsProvider sets them before the pages render, so the plain
// helper functions (date formats, stock level) can read them without being passed anything.
let current: CompanySettings = DEFAULT_SETTINGS
export const applySettings = (s: CompanySettings) => { current = s }
export const getSettings = () => current

export type Prefs = {
  low: boolean       // a product is low or finished
  forecast: boolean  // the forecast says a product runs out soon
  report: boolean    // admin: a new report. Manager: one of my reports was resolved
  gift: boolean      // admin: gifts recorded
  loss: boolean      // admin: damaged or missing stock recorded
  inApp: boolean     // show notices on the dashboard
}
export const DEFAULT_PREFS: Prefs = { low: true, forecast: true, report: true, gift: false, loss: true, inApp: true }

export function normalizePrefs(raw: any): Prefs {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out: any = { ...DEFAULT_PREFS }
  for (const k of Object.keys(DEFAULT_PREFS)) if (typeof r[k] === 'boolean') out[k] = r[k]
  return out
}
