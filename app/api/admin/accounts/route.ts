import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { emailOk, pwErr } from '@/lib/validate'

const fail = (m: string, status = 400) => NextResponse.json({ error: m }, { status })

// Only a signed-in admin may use this API.
async function guard(): Promise<{ error: string; status: number } | { ok: true }> {
  const sb = await supabaseServer()
  if (!sb) return { error: 'Supabase is not configured on the server.', status: 503 }
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Please sign in again.', status: 401 }
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') return { error: 'Only an admin can manage accounts.', status: 403 }
  return { ok: true }
}
async function body(req: Request) { try { return await req.json() } catch { return {} } }

// Create a store manager account with a password the admin chose.
export async function POST(req: Request) {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  const b: any = await body(req)
  const name = String(b.name ?? '').trim(), email = String(b.email ?? '').trim().toLowerCase()
  const password = String(b.password ?? ''), storeId = String(b.storeId ?? '')
  if (name.length < 2) return fail('Enter the full name.')
  if (!emailOk(email)) return fail('Enter a valid email address.')
  const pe = pwErr(password); if (pe) return fail(pe)
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: store } = await admin.from('stores').select('id, name, active').eq('id', storeId).single()
  if (!store || !store.active) return fail('Choose an active store.')
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('role', 'manager')
  if ((count ?? 0) >= 3) return fail(`${store.name} already has 3 accounts.`)
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: 'manager', store_id: storeId } })
  if (error) return fail(/already.*(registered|exists)|exists/i.test(error.message) ? 'An account with this email already exists.' : error.message)
  return NextResponse.json({ id: data.user?.id })
}

// Set a new password, or disable / enable a store manager account.
export async function PATCH(req: Request) {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  const b: any = await body(req)
  const id = String(b.id ?? ''), action = String(b.action ?? '')
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: target } = await admin.from('profiles').select('id, role').eq('id', id).single()
  if (!target || target.role !== 'manager') return fail('Only store manager accounts can be changed here.')
  if (action === 'password') {
    const password = String(b.password ?? ''); const pe = pwErr(password); if (pe) return fail(pe)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    return error ? fail(error.message) : NextResponse.json({ ok: true })
  }
  if (action === 'disable' || action === 'enable') {
    const off = action === 'disable'
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: off ? '876000h' : 'none' })
    if (error) return fail(error.message)
    await admin.from('profiles').update({ disabled: off }).eq('id', id)
    return NextResponse.json({ ok: true })
  }
  return fail('Unknown action.')
}

// Delete a store manager account that has no recorded entries.
export async function DELETE(req: Request) {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  const b: any = await body(req)
  const id = String(b.id ?? '')
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: target } = await admin.from('profiles').select('id, role').eq('id', id).single()
  if (!target || target.role !== 'manager') return fail('Only store manager accounts can be deleted here.')
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return fail(/database|foreign|violates/i.test(error.message) ? 'This account has recorded entries or reports, so it cannot be deleted. Disable it instead.' : error.message)
  return NextResponse.json({ ok: true })
}
