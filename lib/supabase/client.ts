import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/env'

const missingConfig = {
  message: 'Supabase is not configured in this app. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.',
}

const makeQuery = () => {
  const query: any = {}
  query.select = () => query
  query.eq = () => query
  query.order = () => query
  query.gte = () => query
  query.single = async () => ({ data: null, error: missingConfig })
  query.limit = async () => ({ data: [], error: null })
  query.insert = () => makeMutation()
  query.update = () => makeMutation()
  query.delete = () => makeMutation()
  return query
}

const makeMutation = (result: any = { error: missingConfig }) => {
  const p: any = Promise.resolve(result)
  p.eq = () => p
  return p
}

export const supabaseBrowser = () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      auth: {
        signInWithPassword: async () => ({ error: missingConfig }),
        signUp: async () => ({ error: missingConfig }),
        signInWithOAuth: async () => ({ error: missingConfig }),
        updateUser: async () => ({ error: missingConfig }),
        signOut: async () => ({ error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
      from: () => makeQuery(),
      rpc: async () => ({ data: null, error: missingConfig }),
      channel: () => ({ on: () => undefined, subscribe: () => undefined, unsubscribe: () => undefined }),
      removeChannel: () => undefined,
      insert: () => makeMutation(),
      update: () => makeMutation(),
      delete: () => makeMutation(),
    } as any
  }

  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
