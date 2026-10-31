'use client'
import { Hd } from '@/components/ui'
import { act, fmtT, logAct, q, useLive } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function AdminReports() {
  const { data: d, err, reload } = useLive<any>(async (sb) => ({
    reports: await q(sb.from('reports').select('*, profiles(full_name, store_id)').order('created_at', { ascending: false })),
    stores: await q(sb.from('stores').select('id, name')),
  }), ['reports', 'stores'])
  async function toggle(r: any) {
    if (await act(supabaseBrowser().from('reports').update({ resolved: !r.resolved }).eq('id', r.id))) { await logAct(`${r.resolved ? 'Reopened' : 'Resolved'} report: ${r.subject}`); reload() }
  }
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  const sm = new Map<string, string>(d.stores.map((s: any) => [s.id, s.name]))
  return (<>
    <Hd title="Reports" sub={`${d.reports.filter((r: any) => !r.resolved).length} open from store managers`} />
    {d.reports.length ? d.reports.map((r: any) => (
      <div key={r.id} className="panel rep">
        <div className="row"><b>{r.subject}</b><span className={'chip' + (r.resolved ? '' : ' low')}>{r.resolved ? 'Resolved' : 'Open'}</span></div>
        <div className="mute text-[13px]">{r.profiles?.full_name}, {sm.get(r.profiles?.store_id) ?? 'No store'} · {r.category} · {fmtT(r.created_at)}</div>
        <p>{r.message}</p>
        <button className="btn ghost sm" onClick={() => toggle(r)}>{r.resolved ? 'Reopen' : 'Mark resolved'}</button>
      </div>
    )) : <div className="panel mute">No reports yet. Reports from store managers appear here as soon as they send them.</div>}
  </>)
}
