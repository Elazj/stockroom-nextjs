import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'

// Keeps the session fresh and keeps each role in its own area.
export async function proxy(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  let res = NextResponse.next({ request: req })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: Parameters<SetAllCookies>[0]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  const path = req.nextUrl.pathname
  const area = path.startsWith('/admin') ? 'admin' : path.startsWith('/manager') ? 'manager' : null
  if (!area) return res
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (p && p.role !== area) return NextResponse.redirect(new URL('/' + p.role, req.url))
  return res
}
export const config = { matcher: ['/admin/:path*', '/manager/:path*'] }
