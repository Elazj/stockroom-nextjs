'use client'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function SignOut() {
  return (
    <button className="btn ghost sm" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = '/login' }}>
      Sign out
    </button>
  )
}
