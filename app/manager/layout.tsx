import { SettingsProvider } from '@/components/SettingsProvider'
import Shell from '@/components/Shell'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  if (!sb) redirect('/login')
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name, store_id, companies(name, settings)').eq('id', user?.id ?? '').single()
  let storeName = ''
  if (p?.store_id) storeName = (await sb.from('stores').select('name').eq('id', p.store_id).single()).data?.name ?? ''
  const co: any = (p as any)?.companies
  const c = Array.isArray(co) ? co[0] : co
  const company: string = c?.name ?? ''
  return (
    <SettingsProvider value={c?.settings}>
    <Shell role="manager" name={p?.full_name ?? 'Manager'} sub={storeName} company={company}>
      {p?.store_id ? children : (
        <div className="panel max-w-[460px]">
          <h1>No store yet</h1>
          <p className="mute">Your account is not linked to a store. Store manager accounts are created by the company admin on the Team page. Ask your admin to create yours, then sign in with it.</p>
        </div>
      )}
    </Shell>
    </SettingsProvider>
  )
}
