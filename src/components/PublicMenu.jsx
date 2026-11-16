import React, { useState, useEffect } from 'react'
import { fetchSheetMenu, getCachedSheetMenu } from '../lib/sheetMenu'
import { BASE_PRICE, BASE_ENTREES, BASE_SALADS } from '../lib/pricing'
import '../styles/landing.css'

// dinnerwithcharles.com/menu: this week's menu, read live from the sheet, with no sign-in and no
// link from the homepage. For sending to someone who wants a look before they join.
const money = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`

export default function PublicMenu() {
  const [menu, setMenu] = useState(() => getCachedSheetMenu())
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'This week’s menu · Dinner with Charles'
    // Keep search engines off it: this page is for sharing by link, not for finding
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    fetchSheetMenu().then(setMenu).catch(err => setError(err.message || 'Could not load the menu'))
    return () => robots.remove()
  }, [])

  const sections = (menu?.sections || []).filter(sec => sec.items.length)
  const weekOf = menu?.weekOf ? new Date(`${menu.weekOf}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="landing" style={{ minHeight: '100vh' }}>
      <header className="landing-header">
        <div className="landing-wrap">
          <a href="/" className="landing-logo" aria-label="Dinner with Charles home"><img src="/Gold Horizontal Logo.png" alt="Dinner with Charles" /></a>
          <div className="landing-header-actions">
            <a className="landing-link" href="/" style={{ textDecoration: 'none' }}>Sign In</a>
          </div>
        </div>
      </header>

      <main className="landing-wrap" style={{ padding: '40px 24px 80px', maxWidth: '720px' }}>
        <p className="landing-eyebrow">This week’s menu</p>
        <h1 style={{ color: '#083525', fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.15, margin: '0 0 10px 0' }}>
          {weekOf ? `Delivered Monday, ${weekOf.replace(/^Monday, /, '')}` : 'Cooked this week, delivered Monday'}
        </h1>
        <p style={{ color: '#666', fontSize: '16px', lineHeight: 1.7, margin: '0 0 28px 0' }}>
          {money(BASE_PRICE * 100)} for {BASE_ENTREES} entrées and {BASE_SALADS} sides, cooked from scratch and delivered to your door, ready to reheat.
          Each dish serves two to three.
        </p>

        {error && <p style={{ color: '#c62828' }}>Sorry, the menu didn’t load. Please try again in a moment.</p>}
        {!error && !menu && <p style={{ color: '#999' }}>Loading this week’s menu…</p>}
        {menu && sections.length === 0 && <p style={{ color: '#666' }}>Next week’s menu is on its way. Check back soon.</p>}

        {menu?.intro?.map((text, i) => (
          <p key={i} style={{ color: '#444', fontSize: '15px', lineHeight: 1.7, margin: '0 0 20px 0', fontStyle: 'italic' }}>{text}</p>
        ))}

        {sections.map(sec => (
          <section key={sec.title} style={{ background: 'white', border: '1px solid #e0dbd1', padding: '22px 24px', marginBottom: '16px' }}>
            <p className="landing-eyebrow" style={{ marginBottom: '4px' }}>{sec.title}</p>
            {sec.note && <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#999' }}>{sec.note}</p>}
            {sec.items.map((item, i) => (
              <div key={item.id} style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #f0ece3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#083525', lineHeight: 1.3 }}>{item.name}</h3>
                  {sec.type === 'addon' && Number.isFinite(item.price) && <span style={{ color: '#083525', fontWeight: '600', whiteSpace: 'nowrap' }}>{money(item.price)}</span>}
                </div>
                {item.sides && <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#999' }}>{item.sides}</p>}
                {item.description && <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#555', lineHeight: 1.6 }}>{item.description}</p>}
                {item.note && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#b8923f' }}>{item.note}</p>}
              </div>
            ))}
          </section>
        ))}

        <section style={{ background: '#083525', color: '#faf8f3', padding: '28px 24px', marginTop: '28px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '600' }}>Pull up a chair.</p>
          <p style={{ margin: '0 0 18px 0', fontSize: '14px', color: 'rgba(250,248,243,0.85)', lineHeight: 1.6 }}>
            Tell us a little about your household and we’ll be in touch to get your first week on the table.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="landing-btn landing-btn--light" href="/?join=1">Request to Join</a>
            <a className="landing-btn landing-btn--ghost-light" href="/">Sign In to Order</a>
          </div>
        </section>
        <p style={{ margin: '24px 0 0 0', fontSize: '12px', color: '#999', textAlign: 'center' }}>Questions? <a href="mailto:info@dinnerwithcharles.com" style={{ color: '#083525' }}>info@dinnerwithcharles.com</a></p>
      </main>
    </div>
  )
}
