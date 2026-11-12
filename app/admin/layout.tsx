import { SettingsProvider } from '@/components/SettingsProvider'
import Shell from '@/components/Shell'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  if (!sb) redirect('/login')
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name, avatar_path, companies(name, settings)').eq('id', user?.id ?? '').single()
  const co: any = (p as any)?.companies
  const c = Array.isArray(co) ? co[0] : co
  const company: string = c?.name ?? ''
  const avatarUrl = p?.avatar_path ? sb.storage.from('avatars').getPublicUrl(p.avatar_path).data.publicUrl : undefined
  return <SettingsProvider value={c?.settings} userId={user?.id ?? ''}><Shell role="admin" name={p?.full_name ?? 'Admin'} company={company} avatarUrl={avatarUrl}>{children}</Shell></SettingsProvider>
}
