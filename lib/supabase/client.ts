import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'
export const supabaseBrowser = () => createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
