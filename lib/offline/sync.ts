'use client'
import { supabaseBrowser } from '@/lib/supabase/client'
import { friendly } from '@/lib/data'
import { cacheGet, cacheSet, outboxAll, outboxDel, outboxPut, type ConflictCode, type OutboxItem } from '@/lib/offline/idb'

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

const net = (m: string) => /failed to fetch|networkerror|load failed|offline/i.test(m)

let gate: Promise<void> | null = null

export async function cacheLive<T>(key: string, load: () => Promise<T>): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await load()
    await cacheSet(key, data)
    return { data, fromCache: false }
  } catch (e: any) {
    const cached = await cacheGet<T>(key)
    if (cached != null) return { data: cached, fromCache: true }
    throw e
  }
}

export async function whoAmI() {
  try {
    const { data: { session } } = await supabaseBrowser().auth.getSession()
    const user = session?.user
    const name = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'You') as string
    return { id: user?.id ?? '', name }
  } catch {
    return { id: '', name: 'You' }
  }
}

export async function enqueue(item: Omit<OutboxItem, 'status'>): Promise<OutboxItem> {
  const row: OutboxItem = { ...item, status: 'pending' }
  await outboxPut(row)
  void syncOutbox()
  return row
}

export async function discardItem(id: string) { await outboxDel(id) }

export async function resolveItem(id: string, patch: Partial<OutboxItem['payload']>) {
  const rows = await outboxAll()
  const item = rows.find((x) => x.id === id)
  if (!item) return
  item.payload = { ...item.payload, ...patch }
  item.status = 'pending'
  item.conflict = undefined
  await outboxPut(item)
  await syncOutbox()
}

export function pendingFor(items: OutboxItem[], supplyId: string) {
  return items.filter((x) => x.supplyId === supplyId && (x.status === 'pending' || x.status === 'syncing'))
}

export function heldQty(items: OutboxItem[], supplyId: string) {
  return pendingFor(items, supplyId).reduce((n, x) => n + Number(x.payload.quantity ?? 0), 0)
}

export async function syncOutbox() {
  if (!isOnline()) return
  if (gate) return gate
  gate = (async () => {
    const rows = await outboxAll()
    for (const item of rows) {
      if (item.status === 'conflict') continue
      const startFirst = rows.find((x) => x.kind === 'start_sheet' && x.supplyId === item.supplyId && x.id !== item.id)
      if (item.kind !== 'start_sheet' && startFirst) continue
      const next = await pushOne({ ...item, status: 'syncing' })
      if (next === 'offline') break
    }
  })().finally(() => { gate = null })
  return gate
}

async function pushOne(item: OutboxItem): Promise<'ok' | 'conflict' | 'offline'> {
  await outboxPut(item)
  const sb = supabaseBrowser()
  try {
    if (item.kind === 'start_sheet') {
      const { error } = await sb.rpc('start_sheet', { p_supply: item.supplyId })
      if (error) return fail(item, error.message, error.code)
    } else if (item.kind === 'sheet_row') {
      const dup = await duplicateRef(item)
      if (dup) return conflict(item, 'duplicate', `Supply ID ${item.payload.supply_ref} is already on this sheet.`, undefined)
      const hit = await insertWithIdempotency('sheet_rows', {
        supply_id: item.supplyId,
        customer: item.payload.customer,
        supply_ref: item.payload.supply_ref,
        quantity: item.payload.quantity,
        client_id: item.id,
        created_at: item.createdAt,
      })
      if (hit === 'offline') return 'offline'
      if (hit !== 'ok') return interpret(item, hit)
    } else {
      const hit = await insertWithIdempotency('losses', {
        supply_id: item.supplyId,
        kind: item.payload.lossKind,
        quantity: item.payload.quantity,
        note: item.payload.note || null,
        client_id: item.id,
        created_at: item.createdAt,
      })
      if (hit === 'offline') return 'offline'
      if (hit !== 'ok') return interpret(item, hit)
    }
    if (item.log) await sb.from('activity_log').insert({ message: item.log })
    await outboxDel(item.id)
    return 'ok'
  } catch (e: any) {
    const m = String(e?.message ?? e)
    if (net(m)) { item.status = 'pending'; await outboxPut(item); return 'offline' }
    return conflict(item, 'error', friendly(m))
  }
}

async function duplicateRef(item: OutboxItem) {
  if (item.payload.force || !item.payload.supply_ref) return false
  const { data, error } = await supabaseBrowser().from('sheet_rows')
    .select('id, client_id').eq('supply_id', item.supplyId).eq('supply_ref', item.payload.supply_ref).limit(8)
  if (error) {
    if (net(error.message)) throw error
    return false
  }
  return (data ?? []).some((r: any) => r.client_id !== item.id)
}

async function insertWithIdempotency(table: 'sheet_rows' | 'losses', body: Record<string, unknown>): Promise<'ok' | { message: string; code?: string } | 'offline'> {
  const sb = supabaseBrowser()
  let { error } = await sb.from(table).insert(body)
  if (error && /client_id|schema cache|column/i.test(error.message)) {
    const { client_id: _c, ...rest } = body
    ;({ error } = await sb.from(table).insert(rest))
  }
  if (!error) return 'ok'
  if (net(error.message)) return 'offline'
  if (error.code === '23505') {
    const { data } = await sb.from(table).select('id').eq('client_id', body.client_id as string).maybeSingle()
    if (data) return 'ok'
  }
  return { message: error.message, code: error.code }
}

function interpret(item: OutboxItem, hit: { message: string; code?: string }) {
  const left = hit.message.match(/Only\s+([\d.]+)\s+left/i)
  if (left) return conflict(item, 'overdraw', `Only ${left[1]} left in the store now. Another entry used stock while this one was waiting.`, Number(left[1]))
  if (/not found|0 rows|does not exist|foreign/i.test(hit.message)) return conflict(item, 'gone', 'This product is no longer assigned to the store.')
  if (/jwt|auth|sign in|not authenticated/i.test(hit.message)) return conflict(item, 'auth', 'Sign in again to sync this entry.')
  return fail(item, hit.message, hit.code)
}

function fail(item: OutboxItem, message: string, code?: string) {
  if (net(message)) { item.status = 'pending'; return outboxPut(item).then(() => 'offline' as const) }
  if (code === 'PGRST301' || /jwt|not authenticated/i.test(message)) return conflict(item, 'auth', 'Sign in again to sync this entry.')
  return conflict(item, 'error', friendly(message))
}

async function conflict(item: OutboxItem, code: ConflictCode, message: string, remaining?: number): Promise<'conflict'> {
  item.status = 'conflict'
  item.conflict = { code, message, remaining }
  await outboxPut(item)
  return 'conflict'
}

export function overlaySheet(d: any, items: OutboxItem[]) {
  if (!d) return d
  const mine = items.filter((x) => x.supplyId === d.supply.id)
  const live = pendingFor(mine, d.supply.id)
  const started = d.supply.sheet_started_at || mine.some((x) => x.kind === 'start_sheet') ? (d.supply.sheet_started_at || live.find((x) => x.kind === 'start_sheet')?.createdAt || new Date().toISOString()) : null
  let supplied = Number(d.bal.supplied), dmg = Number(d.bal.damaged_in_supply), miss = Number(d.bal.missing_in_supply)
  const rows = [...d.rows], losses = [...d.losses]
  for (const x of live) {
    if (x.kind === 'sheet_row') {
      supplied += Number(x.payload.quantity)
      rows.unshift(ghostRow(x))
    } else if (x.kind === 'loss') {
      if (x.payload.lossKind === 'damaged') dmg += Number(x.payload.quantity)
      else miss += Number(x.payload.quantity)
      losses.unshift(ghostLoss(x))
    }
  }
  for (const x of mine.filter((i) => i.status === 'conflict')) {
    if (x.kind === 'sheet_row') rows.unshift({ ...ghostRow(x), conflict: x.conflict })
    if (x.kind === 'loss') losses.unshift({ ...ghostLoss(x), conflict: x.conflict })
  }
  const remaining = Number(d.bal.assigned) - supplied - dmg - miss
  return { ...d, supply: { ...d.supply, sheet_started_at: started }, bal: { ...d.bal, supplied, damaged_in_supply: dmg, missing_in_supply: miss, remaining }, rows, losses }
}

function ghostRow(x: OutboxItem) {
  return { id: x.id, supply_id: x.supplyId, customer: x.payload.customer, supply_ref: x.payload.supply_ref, quantity: x.payload.quantity, created_at: x.createdAt, pending: x.status !== 'conflict', profiles: { full_name: x.byName }, conflict: x.conflict }
}
function ghostLoss(x: OutboxItem) {
  return { id: x.id, supply_id: x.supplyId, kind: x.payload.lossKind, quantity: x.payload.quantity, note: x.payload.note, created_at: x.createdAt, pending: x.status !== 'conflict', profiles: { full_name: x.byName }, conflict: x.conflict }
}
