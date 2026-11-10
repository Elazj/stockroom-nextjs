'use client'
import { useParams } from 'next/navigation'
import type { Role } from './SettingsFrame'
import Profile from './Profile'
import General from './General'
import Roles from './Roles'
import Inventory from './Inventory'
import Notifications from './Notifications'
import Appearance from './Appearance'
import Backup from './Backup'
import Activity from './Activity'
import About from './About'
import TeamManager from '@/components/TeamManager'

// Picks the settings page from the address (/admin/settings/general, /manager/settings/appearance ...).
export default function SettingsTab({ role }: { role: Role }) {
  const tab = String(useParams<{ tab: string }>()?.tab ?? '')
  const admin = role === 'admin'
  if (tab === 'profile') return <Profile role={role} />
  if (tab === 'notifications') return <Notifications role={role} />
  if (tab === 'appearance') return <Appearance />
  if (tab === 'activity') return <Activity role={role} />
  if (tab === 'about') return <About />
  if (admin && tab === 'general') return <General />
  if (admin && tab === 'users') return <TeamManager embedded />
  if (admin && tab === 'roles') return <Roles />
  if (admin && tab === 'inventory') return <Inventory />
  if (admin && tab === 'backup') return <Backup />
  return <p className="mute m-0">This settings page does not exist.</p>
}
