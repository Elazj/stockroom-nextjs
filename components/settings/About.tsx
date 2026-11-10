'use client'
import { useEffect, useState } from 'react'
import { fmtT, q } from '@/lib/data'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Row, TabHead } from './shared'

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || ''

export default function About() {
  const [co, setCo] = useState<{ name: string; created_at: string } | null>(null)
  useEffect(() => { q(supabaseBrowser().from('companies').select('name, created_at').limit(1)).then((r) => setCo(r?.[0] ?? null)).catch(() => {}) }, [])
  const val = (t: string) => <span className="text-[15px] font-semibold">{t}</span>
  return (<>
    <TabHead title="About System" desc="Information about this Stockroom installation." />
    <div className="-mt-4">
      <Row title="Application">{val('Stockroom')}</Row>
      <Row title="Version">{val(VERSION)}</Row>
      <Row title="Company">{val(co?.name ?? '-')}</Row>
      <Row title="Company created">{val(co?.created_at ? fmtT(co.created_at) : '-')}</Row>
      <Row title="Accounts per store">{val('Up to 3 store manager accounts')}</Row>
      <Row title="Your data">{val('Kept separate from every other company')}</Row>
    </div>
    {SUPPORT ? <a className="btn ghost mt-5 no-underline" href={`mailto:${SUPPORT}`}>Contact support</a> : null}
  </>)
}
