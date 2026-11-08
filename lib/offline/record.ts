'use client'
import { friendly } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { enqueue, isOnline, whoAmI } from '@/lib/offline/sync'
import type { OutboxItem } from '@/lib/offline/idb'

const net = (m: string) => /failed to fetch|networkerror|load failed|offline/i.test(m)

type Draft = Omit<OutboxItem, 'status' | 'byName' | 'id' | 'createdAt'> & { id?: string }

// Writes now when the network works. Otherwise keeps the entry on this device.
export async function recordOrQueue(
  draft: Draft,
  online: () => Promise<{ error: { message: string } | null }>,
): Promise<{ ok: true; queued: boolean } | { ok: false; message: string }> {
  const me = await whoAmI()
  const item = { ...draft, id: draft.id ?? crypto.randomUUID(), createdAt: new Date().toISOString(), byName: me.name }
  if (!isOnline()) {
    await enqueue(item)
    return { ok: true, queued: true }
  }
  try {
    const { error } = await online()
    if (!error) return { ok: true, queued: false }
    if (net(error.message)) { await enqueue(item); return { ok: true, queued: true } }
    return { ok: false, message: friendly(error.message) }
  } catch (e: any) {
    const message = String(e?.message ?? e)
    if (net(message)) { await enqueue(item); return { ok: true, queued: true } }
    return { ok: false, message: friendly(message) }
  }
}

export const browser = () => supabaseBrowser()

// Older databases have no client_id yet. Insert without it rather than failing the entry.
export async function insertEntry(table: 'sheet_rows' | 'losses' | 'gifts', body: Record<string, unknown>) {
  const sb = supabaseBrowser()
  let res = await sb.from(table).insert(body)
  if (res.error && /client_id|schema cache|column/i.test(res.error.message)) {
    const { client_id: _c, ...rest } = body
    res = await sb.from(table).insert(rest)
  }
  return res
}
