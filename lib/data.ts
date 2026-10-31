'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/client'

export const num = (v: unknown) => Number(v) || 0
export const r3 = (n: number) => Math.round(n * 1000) / 1000
export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0)
export const qn = (v: string) => { const n = r3(Number(v)); return n > 0 && isFinite(n) ? n : 0 }
export type Level = 'ok' | 'low' | 'out'
export const level = (assigned: number, remaining: number): Level => (remaining <= 0 ? 'out' : remaining <= assigned * 0.2 ? 'low' : 'ok')
export const fmtT = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
export const localDay = (d: string | Date) => new Date(d).toLocaleDateString('en-CA')

export const friendly = (m: string) =>
  /failed to fetch|networkerror|load failed/i.test(m) ? 'Cannot reach the server. Check your internet connection and that your Supabase project is running.' : m

export async function q(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<any> {
  const { data, error } = await p
  if (error) throw new Error(friendly(error.message))
  return data
}
export const toast = (m: string) => window.dispatchEvent(new CustomEvent('toast', { detail: m }))

// Runs a save. Errors go to onErr (shown inside a dialog) or, without it, to a toast.
export async function act(p: PromiseLike<{ error: { message: string; code?: string } | null }>, ok?: string, onErr?: (m: string) => void) {
  const { error } = await p
  if (error) {
    const m = error.code === '23505' ? 'That already exists.' : friendly(error.message)
    if (onErr) onErr(m); else toast(m)
    return false
  }
  if (ok) toast(ok)
  return true
}
export const logAct = async (message: string) => { await supabaseBrowser().from('activity_log').insert({ message }) }

// Deletes one row by id. Returns an error message, or '' when it worked.
export async function remove(table: string, id: string) {
  const { error } = await supabaseBrowser().from(table).delete().eq('id', id)
  return error ? friendly(error.message) : ''
}

// Loads data now and again whenever anyone changes the listed tables (live updates).
export function useLive<T>(load: (sb: SupabaseClient) => Promise<T>, tables: string[]) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const ref = useRef(load); ref.current = load
  const key = tables.join(',')
  const reload = useCallback(async () => {
    try { setData(await ref.current(supabaseBrowser())); setErr('') } catch (e: any) { setErr(friendly(e.message ?? 'Could not load data')) }
  }, [])
  useEffect(() => {
    reload()
    const sb = supabaseBrowser(); let t: any
    const ch = sb.channel('live-' + key + '-' + Math.random().toString(36).slice(2))
    key.split(',').forEach((table) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(t); t = setTimeout(reload, 200) }))
    ch.subscribe()
    return () => { clearTimeout(t); sb.removeChannel(ch) }
  }, [key, reload])
  return { data, err, reload }
}

export async function loadSheet(sb: SupabaseClient, id: string) {
  const [supply, bal, rows, losses] = await Promise.all([
    q(sb.from('supplies').select('*, products(name, container_no, unit), stores(name)').eq('id', id).single()),
    q(sb.from('supply_balance').select('*').eq('supply_id', id).single()),
    q(sb.from('sheet_rows').select('*, profiles(full_name)').eq('supply_id', id).order('created_at', { ascending: false })),
    q(sb.from('losses').select('*, profiles(full_name)').eq('supply_id', id).order('created_at', { ascending: false })),
  ])
  return { supply, bal, rows: rows as any[], losses: losses as any[] }
}

export const csv = (rows: (string | number)[][]) =>
  '\ufeff' + rows.map((r) => r.map((c) => { let v = String(c); if (typeof c === 'string' && /^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"' }).join(',')).join('\n')

export function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function downloadSheet(d: any) {
  const s = d.supply, p = s.products, b = d.bal
  const rows: (string | number)[][] = [
    ['Product', p.name], ['Container number', p.container_no], ['Store', s.stores.name], ['Unit', p.unit], ['Quantity assigned to this store', s.quantity], [],
    ['Date', 'Customer', 'Supply ID', 'Quantity', 'Entered by'],
    ...[...d.rows].reverse().map((r: any) => [fmtT(r.created_at), r.customer, r.supply_ref, r.quantity, r.profiles?.full_name ?? '']), [],
    ['Damaged or missing during supply'], ['Date', 'Type', 'Quantity', 'Note', 'Entered by'],
    ...[...d.losses].reverse().map((l: any) => [fmtT(l.created_at), l.kind, l.quantity, l.note ?? '', l.profiles?.full_name ?? '']), [],
    ['Supplied to customers', b.supplied], ['Damaged during supply', b.damaged_in_supply], ['Missing during supply', b.missing_in_supply], ['Remaining in store', b.remaining],
  ]
  const clean = (x: string) => x.replace(/[^\w\- ]+/g, '').trim()
  download(`${clean(p.name) || 'sheet'} - ${clean(s.stores.name)}.csv`, csv(rows))
}
