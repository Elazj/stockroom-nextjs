import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
export default async function Home() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  redirect('/' + (p?.role ?? 'manager'))
}
