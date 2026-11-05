import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
// Email confirmation links and Google sign-in both return here.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  if (code) {
    const sb = await supabaseServer()
    if (sb) await sb.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(origin + '/')
}
