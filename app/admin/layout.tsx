import Shell from '@/components/Shell'
import { supabaseServer } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name').eq('id', user?.id ?? '').single()
  return <Shell role="admin" name={p?.full_name ?? 'Admin'}>{children}</Shell>
}
