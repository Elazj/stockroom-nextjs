'use client'
import { useState } from 'react'
import { Confirm, Hd, Modal } from '@/components/ui'
import { act, friendly, logAct, q, remove, sum, toast, useLive } from '@/lib/data'
import { listManagerAccounts } from '@/lib/accounts'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function Stores() {
  const { data: d, err, reload } = useLive<any>(async (sb) => ({
    stores: await q(sb.from('stores').select('*').order('created_at')),
    profiles: await listManagerAccounts(),
    bal: await q(sb.from('supply_balance').select('store_id, remaining')),
  }), ['stores', 'profiles', 'supplies', 'sheet_rows', 'losses', 'gifts'])
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<any>(null)
  const [f, setF] = useState({ name: '', loc: '' })
  const [msg, setMsg] = useState('')
  async function add() {
    const name = f.name.trim()
    if (!name) return setMsg('Enter a store name.')
    const sb = supabaseBrowser()
    const { data: store, error } = await sb.from('stores')
      .insert({ name, location: f.loc.trim() || null, manager_name: null })
      .select('id')
      .single()
    if (error) return setMsg(friendly(error.message))
    if (!store) return setMsg('The store could not be confirmed as saved. Refresh the page before trying again.')
    toast('Store added')
    await logAct(`Added store ${name}`)
    setOpen(false); setF({ name: '', loc: '' }); setMsg(''); reload()
  }
  async function toggle(s: any) {
    if (await act(supabaseBrowser().from('stores').update({ active: !s.active }).eq('id', s.id))) { await logAct(`${s.active ? 'Deactivated' : 'Activated'} ${s.name}`); reload() }
  }
  if (err) return <p className="err">{err}</p>
  if (!d) return <p className="mute">Loading…</p>
  return (<>
    <Hd title="Stores and warehouses" sub={`${d.stores.length} locations`}><button className="btn" onClick={() => { setMsg(''); setF({ name: '', loc: '' }); setOpen(true) }}>Add store</button></Hd>
    <div className="panel">
      {d.stores.length ? <div className="wrap"><table>
        <thead><tr><th>Name</th><th>Location</th><th>Manager</th><th className="n">Accounts</th><th className="n">Products</th><th className="n">Remaining</th><th>Status</th><th /></tr></thead>
        <tbody>{d.stores.map((s: any) => {
          const B = d.bal.filter((b: any) => b.store_id === s.id)
          const assignedManagers = d.profiles
            .filter((p: any) => p.store_id === s.id)
            .map((p: any) => p.full_name)
          const managerNames = assignedManagers.join(', ') || s.manager_name || '—'
          return <tr key={s.id}><td>{s.name}</td><td>{s.location}</td><td>{managerNames}</td>
            <td className="n">{d.profiles.filter((p: any) => p.store_id === s.id).length} / 3</td>
            <td className="n">{B.length}</td><td className="n">{sum(B, (b: any) => Number(b.remaining))}</td>
            <td><button className="btn ghost sm" onClick={() => toggle(s)}>{s.active ? 'Active' : 'Inactive'}</button></td>
            <td><button className="btn ghost sm" onClick={() => setDel(s)}>Delete</button></td></tr>
        })}</tbody></table></div> : <p className="mute m-0">No stores yet. Add your first store or warehouse to begin.</p>}
    </div>
    <Modal open={open} title="Add store" onClose={() => setOpen(false)}>
      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Location<input value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })} /></label>
      <p className="text-xs text-mute">Assign store managers when creating their accounts on the Team tab.</p>
      <p className="err" role="alert">{msg}</p>
      <div className="mfoot"><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn" onClick={add}>Save</button></div>
    </Modal>
    <Confirm open={!!del} title="Delete store" label="Delete store" onClose={() => setDel(null)}
      text={`Delete ${del?.name ?? 'this store'}? Its products and sheets are removed from the store, and its manager accounts will be asked to choose a store again. This cannot be undone.`}
      onConfirm={async () => { const e = await remove('stores', del.id); if (!e) { await logAct(`Deleted store ${del.name}`); reload() } return e }} />
  </>)
}
