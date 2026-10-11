import Shell from '@/components/Shell'
import JoinStore from '@/components/JoinStore'
import { supabaseServer } from '@/lib/supabase/server'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name, store_id').eq('id', user?.id ?? '').single()
  let storeName = ''
  let stores: { id: string; name: string; accounts: number }[] = []
  if (p?.store_id) storeName = (await sb.from('stores').select('name').eq('id', p.store_id).single()).data?.name ?? ''
  else stores = (await sb.rpc('open_stores')).data ?? []
  return <Shell role="manager" name={p?.full_name ?? 'Manager'} sub={storeName}>{p?.store_id ? children : <JoinStore stores={stores} />}</Shell>
}
