'use client'
import { useEffect } from 'react'
import { discardItem, resolveItem, syncOutbox } from '@/lib/offline/sync'
import { useOnline, useOutbox } from '@/lib/offline/useOutbox'

export default function OfflineBar() {
  const on = useOnline()
  const { items } = useOutbox()
  const waiting = items.filter((x) => x.status !== 'conflict')
  const conflicts = items.filter((x) => x.status === 'conflict')

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  if (on && !items.length) return null

  return (
    <div className="offline-bar" role="status">
      <div>
        <b>{on ? (conflicts.length ? 'Some entries need a decision before they can sync.' : waiting.length ? `Syncing ${waiting.length} ${waiting.length === 1 ? 'entry' : 'entries'}…` : 'Back online.') : 'You are offline.'}</b>
        <p className="mute m-0">{on ? 'Queued entries send in the order you recorded them. If stock ran out while you were away, you choose what to do.' : 'You can still record supplies. They stay on this device and send when you are back online. Open each sheet once while online so it is saved here.'}</p>
      </div>
      {on && waiting.length ? <button className="btn ghost sm" onClick={() => { void syncOutbox() }}>Retry sync</button> : null}
      {conflicts.map((c) => (
        <div key={c.id} className="offline-conflict">
          <p className="m-0"><b>{c.payload.productName ?? 'Entry'}</b> — {c.kind === 'loss' ? `${c.payload.quantity} ${c.payload.lossKind}` : `${c.payload.quantity} to ${c.payload.customer ?? ''} (${c.payload.supply_ref ?? ''})`}</p>
          <p className="mute mt-[4px] mb-2">{c.conflict?.message}</p>
          <div className="btns">
            {c.conflict?.code === 'overdraw' && (c.conflict.remaining ?? 0) > 0 ? (
              <button className="btn sm" onClick={() => resolveItem(c.id, { quantity: c.conflict!.remaining })}>Record {c.conflict.remaining} instead</button>
            ) : null}
            {c.conflict?.code === 'duplicate' ? (
              <button className="btn sm" onClick={() => resolveItem(c.id, { force: true })}>Save anyway</button>
            ) : null}
            {c.conflict?.code !== 'auth' ? (
              <button className="btn ghost sm" onClick={() => discardItem(c.id)}>Discard</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
