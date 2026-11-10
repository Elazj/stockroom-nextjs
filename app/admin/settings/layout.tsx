import SettingsFrame from '@/components/settings/SettingsFrame'
export default function Layout({ children }: { children: React.ReactNode }) { return <SettingsFrame role="admin">{children}</SettingsFrame> }
