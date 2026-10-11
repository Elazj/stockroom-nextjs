'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

// Shown to a manager (for example after Google sign-in) who is not linked to a store yet.
export default function JoinStore({ stores }: { stores: { id: string; name: string; accounts: number }[] }) {
  const router = useRouter()
  const [id, setId] = useState('')
  const [msg, setMsg] = useState('')
  async function join() {
    if (!id) return setMsg('Choose your store.')
    const { error } = await supabaseBrowser().rpc('join_store', { p_store: id })
    if (error) return setMsg(error.message)
    router.refresh()
  }
  return (
    <div className="panel" style={{ maxWidth: 460 }}>
      <h1>Choose your store</h1>
      <p className="mute">Your account is not linked to a store yet. Pick yours to start. Each store can have up to 3 accounts.</p>
      <label>Store
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">{stores.length ? 'Choose a store' : 'No stores yet. Ask the admin to add one.'}</option>
          {stores.map((s) => <option key={s.id} value={s.id} disabled={s.accounts >= 3}>{s.name} ({s.accounts}/3 accounts)</option>)}
        </select>
      </label>
      <p className="err" role="alert">{msg}</p>
      <button className="btn" onClick={join}>Join store</button>
    </div>
  )
}
