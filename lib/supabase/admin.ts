import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from '@/lib/supabase/env'

// Server only. This key bypasses every security rule, so it must never reach the browser.
// Do not import this file from a component that has 'use client'.
export function supabaseAdmin() {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim().replace(/^["']+|["']+$/g, '').trim()
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server. Add it to .env.local (and to Vercel), then restart or redeploy.')
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
