'use client'
import { useState } from 'react'
import { Hd } from '@/components/ui'
import { act, fmtT, logAct, q, useLive } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function ManagerReports() {
  const { data: d, err, reload } = useLive<any>((sb) => q(sb.from('reports').select('*').order('created_at', { ascending: false })), ['reports'])
  const [f, setF] = useState({ category: 'Store issue', subject: '', message: '' })
  const [msg, setMsg] = useState('')
  async function send() {
    const subject = f.subject.trim(), message = f.message.trim()
    if (subject.length < 3 || message.length < 10) return setMsg('Add a subject and a message of at least 10 characters.')
    setMsg('')
    if (!(await act(supabaseBrowser().from('reports').insert({ category: f.category, subject, message }), 'Report sent to the admin', setMsg))) return
    await logAct(`Sent a report: ${subject}`)
    setF({ category: f.category, subject: '', message: '' }); reload()
  }
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  return (<>
    <Hd title="Reports" sub="Tell the admin about any issue with your store or your job" />
    <div className="content-grid">
      <div className="panel"><h2>New report</h2>
        <label>Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Store issue', 'Job issue', 'Stock problem', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Subject<input value={f.subject} maxLength={120} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
        <label>Message<textarea className="mt-1 block w-full rounded-lg border border-line bg-panel px-[11px] py-[9px] text-ink [font:inherit]" rows={5} maxLength={2000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
        <p className="err" role="alert">{msg}</p><button className="btn" onClick={send}>Send to admin</button></div>
      <div className="panel"><h2>Your reports</h2>
        {d.length ? <div className="wrap"><table><thead><tr><th>Sent</th><th>Subject</th><th>Status</th></tr></thead><tbody>
          {d.map((r: any) => <tr key={r.id}><td>{fmtT(r.created_at)}</td><td className="w">{r.subject}</td><td><span className={'chip' + (r.resolved ? '' : ' low')}>{r.resolved ? 'Resolved' : 'Open'}</span></td></tr>)}</tbody></table></div> : <p className="mute m-0">You have not sent a report yet.</p>}
      </div>
    </div>
  </>)
}
