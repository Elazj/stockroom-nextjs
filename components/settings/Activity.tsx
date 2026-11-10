'use client'
import { useMemo, useState } from 'react'
import { csv, download, fmtT, localDay, q, useLive } from '@/lib/data'
import { TabHead } from './shared'
import type { Role } from './SettingsFrame'

const PERIODS: [string, string, number][] = [['all', 'All time', 0], ['1', 'Last 24 hours', 1], ['7', 'Last 7 days', 7], ['30', 'Last 30 days', 30]]
const LIMIT = 500

// Admin: everything the company recorded. Store manager: only their own entries (the database only returns those).
export default function Activity({ role }: { role: Role }) {
  const admin = role === 'admin'
  const { data, err } = useLive<any[]>((sb) => q(sb.from('activity_log').select('id, message, created_at, actor, profiles(full_name)').order('created_at', { ascending: false }).limit(LIMIT)), ['activity_log'])
  const [text, setText] = useState('')
  const [who, setWho] = useState('')
  const [period, setPeriod] = useState('all')

  const people = useMemo(() => {
    const m = new Map<string, string>()
    ;(data ?? []).forEach((r) => m.set(r.actor, r.profiles?.full_name ?? 'Unknown'))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const rows = useMemo(() => {
    const days = PERIODS.find((p) => p[0] === period)?.[2] ?? 0
    const since = days ? Date.now() - days * 864e5 : 0
    const t = text.trim().toLowerCase()
    return (data ?? []).filter((r) =>
      (!who || r.actor === who) && (!since || new Date(r.created_at).getTime() >= since) &&
      (!t || r.message.toLowerCase().includes(t) || (r.profiles?.full_name ?? '').toLowerCase().includes(t)))
  }, [data, text, who, period])

  const save = () => download(`activity-${localDay(new Date())}.csv`, csv([['When', 'Who', 'What'], ...rows.map((r) => [fmtT(r.created_at), r.profiles?.full_name ?? '', r.message])]))

  return (<>
    <TabHead title={admin ? 'Activity Logs' : 'My Activity'} desc={admin ? 'Everything admins and store managers recorded, newest first.' : 'What you recorded in your store, newest first.'} />
    <div className="mb-3.5 flex flex-wrap gap-3">
      <input className="mt-0 min-w-0 flex-1 basis-48" placeholder="Search activity" aria-label="Search activity" value={text} onChange={(e) => setText(e.target.value)} />
      {admin ? <select className="mt-0 w-full sm:w-44" aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select> : null}
      <select className="mt-0 w-full sm:w-44" aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
    {err ? <p className="err" role="alert">{err}</p> : null}
    {!data ? <p className="mute m-0">Loading…</p> : rows.length ? (
      <div className="wrap"><table>
        <thead><tr><th>When</th>{admin ? <th>Who</th> : null}<th>What</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="text-mute">{fmtT(r.created_at)}</td>{admin ? <td>{r.profiles?.full_name ?? ''}</td> : null}<td className="!whitespace-normal">{r.message}</td></tr>)}</tbody>
      </table></div>
    ) : <p className="mute m-0">Nothing recorded yet.</p>}
    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-mute">{data && data.length >= LIMIT ? `Showing the latest ${LIMIT} entries` : admin ? 'Showing every entry' : 'Only your own entries are shown'}</span>
      <button className="btn ghost" disabled={!rows.length} onClick={save}>Download CSV</button>
    </div>
  </>)
}
