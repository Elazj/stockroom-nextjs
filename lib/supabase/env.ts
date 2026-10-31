// Cleans the values so stray quotes, spaces or a trailing slash cannot break the connection.
const clean = (v?: string) => (v ?? '').trim().replace(/^["']+|["']+$/g, '').trim()
export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '')
export const SUPABASE_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
