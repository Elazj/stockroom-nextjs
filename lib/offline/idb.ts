'use client'

export type OutboxStatus = 'pending' | 'syncing' | 'conflict'
export type OutboxKind = 'start_sheet' | 'sheet_row' | 'loss' | 'gift'
export type ConflictCode = 'overdraw' | 'duplicate' | 'gone' | 'auth' | 'error'

export type OutboxItem = {
  id: string
  kind: OutboxKind
  supplyId: string
  createdAt: string
  status: OutboxStatus
  byName: string
  log: string
  payload: {
    customer?: string
    supply_ref?: string
    quantity?: number
    lossKind?: 'damaged' | 'missing'
    recipient?: string
    note?: string
    productName?: string
    force?: boolean
  }
  conflict?: { code: ConflictCode; message: string; remaining?: number }
}

const DB = 'stockroom-offline'
const VER = 1
const OUTBOX = 'outbox'
const CACHE = 'cache'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const req = fn(s)
    t.oncomplete = () => resolve((req ? req.result : undefined) as T)
    t.onerror = () => reject(t.error)
  }))
}

export const cacheSet = (key: string, value: unknown) => run(CACHE, 'readwrite', (s) => s.put(value, key))
export const cacheGet = <T,>(key: string) => run<T>(CACHE, 'readonly', (s) => s.get(key))

export const outboxPut = (item: OutboxItem) => run(OUTBOX, 'readwrite', (s) => s.put(item)).then(() => bump())
export const outboxDel = (id: string) => run(OUTBOX, 'readwrite', (s) => s.delete(id)).then(() => bump())
export const outboxAll = () => run<OutboxItem[]>(OUTBOX, 'readonly', (s) => s.getAll()).then((rows) =>
  (rows ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)))

export const bump = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stockroom-outbox'))
}
