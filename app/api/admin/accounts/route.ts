import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { emailOk, pwErr } from '@/lib/validate'

const fail = (m: string, status = 400) => NextResponse.json({ error: m }, { status })

// Only a signed-in admin may use this API.
async function guard(): Promise<{ error: string; status: number } | { ok: true; companyId: string }> {
  const sb = await supabaseServer()
  if (!sb) return { error: 'Supabase is not configured on the server.', status: 503 }
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'Please sign in again.', status: 401 }
  const { data: p } = await sb.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (p?.role !== 'admin' || !p.company_id) return { error: 'Only an admin can manage accounts.', status: 403 }
  return { ok: true, companyId: p.company_id as string }
}
async function body(req: Request) { try { return await req.json() } catch { return {} } }

async function syncStoreManagers(admin: ReturnType<typeof supabaseAdmin>, companyId: string, storeIds: (string | null)[]) {
  for (const storeId of [...new Set(storeIds.filter((id): id is string => !!id))]) {
    const { data: managers, error: managersError } = await admin.from('profiles')
      .select('full_name')
      .eq('company_id', companyId)
      .eq('store_id', storeId)
      .eq('role', 'manager')
      .order('full_name')
    if (managersError) return managersError
    const { error } = await admin.from('stores')
      .update({ manager_name: (managers ?? []).map((p) => p.full_name).join(', ') || null })
      .eq('id', storeId)
      .eq('company_id', companyId)
    if (error) return error
  }
  return null
}

// List only managers belonging to the signed-in admin's company.
export async function GET() {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: stores, error: storesError } = await admin.from('stores').select('id').eq('company_id', g.companyId)
  if (storesError) return fail(storesError.message, 500)
  const storeIds = (stores ?? []).map((store) => store.id)
  if (storeIds.length) {
    const { data: linkedProfiles, error: linkedError } = await admin.from('profiles')
      .select('id, full_name, email, store_id, role, company_id, disabled')
      .eq('role', 'manager')
      .in('store_id', storeIds)
    if (linkedError) return fail(linkedError.message, 500)
    const unlinkedProfiles = (linkedProfiles ?? []).filter((profile) => profile.company_id !== g.companyId)
    if (unlinkedProfiles.length) {
      const { error } = await admin.from('profiles').upsert(
        unlinkedProfiles.map((profile) => ({ ...profile, company_id: g.companyId })),
        { onConflict: 'id' },
      )
      if (error) return fail(error.message, 500)
    }
  }
  const { data, error } = await admin.from('profiles')
    .select('id, full_name, email, store_id, disabled')
    .eq('company_id', g.companyId)
    .eq('role', 'manager')
    .order('full_name')
  if (error) return fail(error.message, 500)
  return NextResponse.json({ people: data })
}

// Create a store manager account with a password the admin chose. The store must belong to the admin's company.
export async function POST(req: Request) {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  const b: any = await body(req)
  const name = String(b.name ?? '').trim(), email = String(b.email ?? '').trim().toLowerCase()
  const password = String(b.password ?? ''), storeId = String(b.storeId ?? '')
  if (name.length < 2) return fail('Enter the full name.')
  if (!emailOk(email)) return fail('Enter a valid email address.')
  const pe = pwErr(password); if (pe) return fail(pe)
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: store } = await admin.from('stores').select('id, name, active').eq('id', storeId).eq('company_id', g.companyId).single()
  if (!store || !store.active) return fail('Choose an active store.')
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('role', 'manager')
  if ((count ?? 0) >= 3) return fail(`${store.name} already has 3 accounts.`)
  // The store goes in app_metadata, which only this server can set. The database reads it from there to link the manager to the company.
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name }, app_metadata: { role: 'manager', store_id: storeId } })
  if (error) return fail(/already.*(registered|exists)|exists/i.test(error.message) ? 'An account with this email already exists.' : error.message)
  if (!data.user) return fail('The account was created without a user record. Check Supabase Auth before trying again.', 500)
  const { error: profileError } = await admin.from('profiles').upsert({
    id: data.user.id,
    full_name: name,
    email,
    role: 'manager',
    store_id: storeId,
    company_id: g.companyId,
  }, { onConflict: 'id' })
  if (profileError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
    const detail = cleanupError ? ` The Auth account could not be removed (${cleanupError.message}).` : ''
    return fail(`Could not link the new account to this company: ${profileError.message}.${detail}`, 500)
  }
  const syncError = await syncStoreManagers(admin, g.companyId, [storeId])
  if (syncError) return fail(`The manager account was created, but the store's manager names could not be refreshed: ${syncError.message}`, 500)
  return NextResponse.json({ id: data.user?.id })
}

// Set a new password, or disable / enable a store manager account of the admin's company.
export async function PATCH(req: Request) {
  const g = await guard(); if ('error' in g) return fail(g.error, g.status)
  const b: any = await body(req)
  const id = String(b.id ?? ''), action = String(b.action ?? '')
  let admin; try { admin = supabaseAdmin() } catch (e: any) { return fail(e.message, 500) }
  const { data: target } = await admin.from('profiles').select('id, role, company_id, store_id').eq('id', id).single()
  if (!target || target.role !== 'manager' || target.company_id !== g.companyId) return fail('Only store manager accounts of your company can be changed here.')
  if (action === 'password') {
    const password = String(b.password ?? ''); const pe = pwErr(password); if (pe) return fail(pe)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    return error ? fail(error.message) : NextResponse.json({ ok: true })
  }
  if (action === 'store') {
    const storeId = String(b.storeId ?? '')
    const { data: store } = await admin.from('stores').select('id, name, active')
      .eq('id', storeId).eq('company_id', g.companyId).single()
    if (!store || !store.active) return fail('Choose an active store.')
    const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('store_id', storeId).eq('role', 'manager').neq('id', id)
    if (countError) return fail(countError.message, 500)
    if ((count ?? 0) >= 3) return fail(`${store.name} already has 3 accounts.`)
    const { error } = await admin.from('profiles').update({ store_id: storeId }).eq('id', id).eq('company_id', g.companyId)
    if (error) return fail(error.message, 500)
    const syncError = await syncStoreManagers(admin, g.companyId, [target.store_id, storeId])
    if (syncError) return fail(`Manager assigned, but store manager names could not be refreshed: ${syncError.message}`, 500)
    return NextResponse.json({ ok: true })
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
  const { data: target } = await admin.from('profiles').select('id, role, company_id').eq('id', id).single()
  if (!target || target.role !== 'manager' || target.company_id !== g.companyId) return fail('Only store manager accounts of your company can be deleted here.')
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return fail(/database|foreign|violates/i.test(error.message) ? 'This account has recorded entries or reports, so it cannot be deleted. Disable it instead.' : error.message)
  return NextResponse.json({ ok: true })
}
