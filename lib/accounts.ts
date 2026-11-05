// Browser helper for the admin-only accounts API. Returns an error message, or '' when it worked.
export async function accountsApi(method: 'POST' | 'PATCH' | 'DELETE', body: object): Promise<string> {
  try {
    const r = await fetch('/api/admin/accounts', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? '' : (j.error ?? 'Something went wrong. Try again.')
  } catch {
    return 'Cannot reach the server. Check your connection and try again.'
  }
}
