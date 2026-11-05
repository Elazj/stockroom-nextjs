'use client'
import { useCallback, useEffect, useState } from 'react'
import { outboxAll, type OutboxItem } from '@/lib/offline/idb'
import { syncOutbox } from '@/lib/offline/sync'

export function useOnline() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const go = () => setOn(navigator.onLine)
    go()
    window.addEventListener('online', go)
    window.addEventListener('offline', go)
    return () => { window.removeEventListener('online', go); window.removeEventListener('offline', go) }
  }, [])
  useEffect(() => {
    if (!on) return
    void syncOutbox()
  }, [on])
  return on
}

export function useOutbox(supplyId?: string) {
  const [items, setItems] = useState<OutboxItem[]>([])
  const reload = useCallback(async () => {
    const all = await outboxAll()
    setItems(supplyId ? all.filter((x) => x.supplyId === supplyId) : all)
  }, [supplyId])
  useEffect(() => {
    reload()
    const h = () => { void reload() }
    window.addEventListener('stockroom-outbox', h)
    return () => window.removeEventListener('stockroom-outbox', h)
  }, [reload])
  return { items, reload }
}
