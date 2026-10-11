'use client'
import { useEffect, useState } from 'react'

const MAKER = 'Elaz-Mahmud' // shows as "from ..." at the bottom of the welcome screen

// Welcome screen shown each time the app opens. Tap or press a key to skip.
export default function Splash() {
  const [phase, setPhase] = useState<'show' | 'out' | 'gone'>('show')
  useEffect(() => {
    const out = () => setPhase((p) => (p === 'show' ? 'out' : p))
    const t1 = setTimeout(out, 1900)
    window.addEventListener('keydown', out)
    return () => { clearTimeout(t1); window.removeEventListener('keydown', out) }
  }, [])
  useEffect(() => {
    if (phase !== 'out') return
    const t = setTimeout(() => setPhase('gone'), 450)
    return () => clearTimeout(t)
  }, [phase])
  if (phase === 'gone') return null
  return (
    <div role="status" aria-label="Stockroom is loading" onClick={() => setPhase('out')}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity .4s',
        opacity: phase === 'out' ? 0 : 1, pointerEvents: phase === 'out' ? 'none' : 'auto' }}>
      <style>{`@keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes pulse{50%{transform:scale(1.05)}} @keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
        @media (prefers-reduced-motion:reduce){.sp-a{animation:none!important}}`}</style>
      <div className="sp-a" style={{ width: 92, height: 92, borderRadius: 26, background: 'var(--acc)', color: 'var(--on)', display: 'grid',
        placeItems: 'center', animation: 'pop .7s ease-out both, pulse 1.6s ease-in-out .7s infinite' }}>
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </svg>
      </div>
      <div className="sp-a" style={{ font: '600 30px Georgia, serif', marginTop: 18, color: 'var(--ink)', animation: 'rise .6s ease-out .25s both' }}>Stockroom</div>
      <div className="sp-a" style={{ position: 'absolute', bottom: 36, textAlign: 'center', color: 'var(--mute)', fontSize: 13, animation: 'rise .6s ease-out .5s both' }}>
        from<b style={{ display: 'block', color: 'var(--ink)', fontSize: 17, letterSpacing: '.02em' }}>{MAKER}</b>
      </div>
    </div>
  )
}
