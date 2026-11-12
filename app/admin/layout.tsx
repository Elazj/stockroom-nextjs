import { SettingsProvider } from '@/components/SettingsProvider'
import Shell from '@/components/Shell'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  if (!sb) redirect('/login')
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name, companies(name, settings)').eq('id', user?.id ?? '').single()
  const co: any = (p as any)?.companies
  const c = Array.isArray(co) ? co[0] : co
  const company: string = c?.name ?? ''
  return <SettingsProvider value={c?.settings} userId={user?.id ?? ''}><Shell role="admin" name={p?.full_name ?? 'Admin'} company={company}>{children}</Shell></SettingsProvider>
}
