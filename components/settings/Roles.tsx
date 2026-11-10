'use client'
import { Icon } from '@/components/icons'
import { TabHead } from './shared'

const PERMS: [string, boolean, boolean][] = [
  ['Create stores and products', true, false],
  ['Assign products to stores', true, false],
  ['Create and manage manager accounts', true, false],
  ['View every store of the company', true, false],
  ['Record daily supplies', true, true],
  ['Record gifts', true, true],
  ['Record damaged or missing stock', true, true],
  ['Send reports to the admin', true, true],
  ['Reset data and delete the account', true, false],
]

const Yes = () => <span className="inline-block text-acc" role="img" aria-label="Allowed"><Icon name="shield" size={18} /></span>
const No = () => <span className="text-mute" role="img" aria-label="Not allowed">&ndash;</span>

export default function Roles() {
  return (<>
    <TabHead title="Roles & Permissions" desc="What each kind of account can do. Roles are fixed: one admin per company, plus store managers." />
    <div className="wrap"><table>
      <thead><tr><th>Permission</th><th className="text-center">Admin</th><th className="text-center">Store manager</th></tr></thead>
      <tbody>{PERMS.map(([p, a, m]) => <tr key={p}><td>{p}</td><td className="text-center">{a ? <Yes /> : <No />}</td><td className="text-center">{m ? <Yes /> : <No />}</td></tr>)}</tbody>
    </table></div>
    <p className="mb-0 mt-4 text-[13px] text-mute">A store manager only ever sees the store they are assigned to. Only the admin can create manager accounts, from the Team page or User Management.</p>
  </>)
}
