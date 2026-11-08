import Shell from '@/components/Shell'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  if (!sb) redirect('/login')
  const { data: { user } } = await sb.auth.getUser()
  const { data: p } = await sb.from('profiles').select('full_name, companies(name)').eq('id', user?.id ?? '').single()
  const co: any = (p as any)?.companies
  const company: string = (Array.isArray(co) ? co[0]?.name : co?.name) ?? ''
  return <Shell role="admin" name={p?.full_name ?? 'Admin'} company={company}>{children}</Shell>
}
