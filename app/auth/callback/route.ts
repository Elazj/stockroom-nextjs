import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
// Email confirmation links and Google sign-in both return here.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  let sessionStarted = false
  if (code) {
    const sb = await supabaseServer()
    if (sb) {
      const { error } = await sb.auth.exchangeCodeForSession(code)
      sessionStarted = !error
    }
  }
  return NextResponse.redirect(origin + (sessionStarted ? '/?session_started=1' : '/'))
}
