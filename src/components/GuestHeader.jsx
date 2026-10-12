import React, { useState } from 'react'

const linkStyle = {
  display: 'block',
  width: '100%',
  padding: '16px 24px',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid #e0dbd1',
  cursor: 'pointer',
  fontSize: '15px',
  color: '#1a441f',
  fontWeight: '500',
  fontFamily: 'inherit'
}

export default function GuestHeader({ screen, onNavigate, onLogout }) {
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
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
      <img
        src="/Green Horizontal Logo.png"
        alt="Dinner with Charles"
        onClick={() => go('menu')}
        style={{ maxWidth: '200px', height: 'auto', cursor: 'pointer' }}
      />
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        style={{ padding: '12px', background: '#1a441f', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px' }}
      >
        <span style={{ display: 'block', width: '22px', height: '2px', background: '#faf8f3' }} />
        <span style={{ display: 'block', width: '22px', height: '2px', background: '#faf8f3' }} />
        <span style={{ display: 'block', width: '22px', height: '2px', background: '#faf8f3' }} />
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <nav style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '240px', background: 'white', border: '1px solid #e0dbd1', boxShadow: '0 12px 32px rgba(26, 68, 31, 0.12)', zIndex: 100 }}>
            {items.map(item => (
              <button
                key={item.key}
                onClick={() => go(item.key)}
                style={{ ...linkStyle, fontWeight: screen === item.key ? '700' : '500', borderLeft: screen === item.key ? '3px solid #D4A373' : '3px solid transparent' }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setMenuOpen(false); onLogout() }}
              style={{ ...linkStyle, borderBottom: 'none', borderLeft: '3px solid transparent', color: '#666' }}
            >
              Logout
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
