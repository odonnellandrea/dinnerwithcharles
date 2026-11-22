import React, { useState } from 'react'

const linkStyle = {
  display: 'block',
  width: '100%',
  padding: '16px 24px',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--a-border)',
  cursor: 'pointer',
  fontSize: '15px',
  color: 'var(--a-green)',
  fontWeight: '500',
  fontFamily: 'inherit'
}

// The dark green bar across the top of every customer page, with the logo in gold
export default function GuestHeader({ screen, onNavigate, onLogout, onAdmin, maxWidth = '900px' }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (target) => {
    setMenuOpen(false)
    onNavigate(target)
  }

  const items = [
    { key: 'menu', label: 'Order This Week' },
    { key: 'history', label: 'Order History' },
    { key: 'settings', label: 'Settings' }
  ]

  return (
    <div style={{ background: 'var(--a-bar)', padding: '14px 20px' }}>
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth, margin: '0 auto' }}>
      <img
        src="/Gold Horizontal Logo.png"
        alt="Dinner with Charles"
        onClick={() => go('menu')}
        style={{ maxWidth: '180px', width: '50%', height: 'auto', cursor: 'pointer' }}
      />
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        style={{ padding: '11px', background: 'var(--a-cream)', border: '1px solid var(--a-cream)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px' }}
      >
        <span style={{ display: 'block', width: '22px', height: '2px', background: 'var(--a-green)' }} />
        <span style={{ display: 'block', width: '22px', height: '2px', background: 'var(--a-green)' }} />
        <span style={{ display: 'block', width: '22px', height: '2px', background: 'var(--a-green)' }} />
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <nav style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '240px', background: 'var(--a-surface)', border: '1px solid var(--a-border)', boxShadow: '0 12px 32px var(--a-shadow)', zIndex: 100 }}>
            {items.map(item => (
              <button
                key={item.key}
                onClick={() => go(item.key)}
                style={{ ...linkStyle, fontWeight: screen === item.key ? '700' : '500', borderLeft: screen === item.key ? '3px solid var(--a-gold)' : '3px solid transparent' }}
              >
                {item.label}
              </button>
            ))}
            {onAdmin && (
              <button
                onClick={() => { setMenuOpen(false); onAdmin() }}
                style={{ ...linkStyle, borderLeft: '3px solid transparent', color: 'var(--a-green)' }}
              >
                Admin dashboard
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); onLogout() }}
              style={{ ...linkStyle, borderBottom: 'none', borderLeft: '3px solid transparent', color: 'var(--a-muted)' }}
            >
              Logout
            </button>
          </nav>
        </>
      )}
    </div>
    </div>
  )
}
