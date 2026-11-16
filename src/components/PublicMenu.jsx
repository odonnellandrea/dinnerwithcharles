import React, { useState, useEffect } from 'react'
import { fetchSheetMenu, getCachedSheetMenu } from '../lib/sheetMenu'

// dinnerwithcharles.com/menu: this week's menu, read live from the sheet, with no sign-in and no
// link from the homepage. Laid out like the printed menu PDF: tan page, cream card, Times and
// Courier, numbered dishes, gold add-on prices, and the badge in the footer box.
const PAGE = '#f6f1e4', EDGE = '#d9cdb2', BOX = '#e4dbc2', GREEN = '#083525', SOFT = '#1f4a38', GOLD = '#a8813f'
const INK = '#2a2620', MUTED = '#7d7a69', DARK = '#1a1610', RULE = '#cfc8b4', DASH = '#b3a988'
const serif = "'Times New Roman', Times, Georgia, serif"
const mono = "'Courier New', Courier, monospace"
const sans = "Helvetica, Arial, sans-serif"

const money = (cents) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
const shortDate = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : ''

// Phones: one column, like the PDF. Wide screens: a two-column spread like an opened printed menu.
const WIDE_CSS = `
  .pm-card { max-width: 440px; padding: 26px 26px 30px; }
  .pm-body { display: block; }
  .pm-col + .pm-col { margin-top: 0; }
  .pm-rule-between { display: block; }
  @media (min-width: 900px) {
    .pm-card { max-width: 980px; padding: 44px 56px 48px; }
    .pm-header h1 { font-size: 44px !important; }
    .pm-body { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); column-gap: 0; }
    .pm-col { min-width: 0; }
    .pm-col--left { padding-right: 44px; border-right: 1px solid ${RULE}; }
    .pm-col--right { padding-left: 44px; }
    .pm-rule-between { display: none; }
  }
`

const Rule = () => <div style={{ borderTop: `1px solid ${RULE}`, margin: '22px 0' }} />
const Dashed = () => <div style={{ borderTop: `1px dashed ${DASH}`, margin: '14px 0' }} />
const Caps = ({ children, color = SOFT, size = 11, style }) => <p style={{ margin: 0, fontFamily: mono, fontSize: size, letterSpacing: '0.08em', color, textTransform: 'uppercase', ...style }}>{children}</p>

export default function PublicMenu() {
  const [menu, setMenu] = useState(() => getCachedSheetMenu())
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'This week’s menu · Dinner with Charles'
    document.body.style.background = EDGE
    // Keep search engines off it: this page is for sharing by link, not for finding
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    fetchSheetMenu().then(setMenu).catch(err => setError(err.message || 'Could not load the menu'))
    return () => { robots.remove(); document.body.style.background = '' }
  }, [])

  const sections = (menu?.sections || []).filter(sec => sec.items.length)
  const intro = (menu?.intro || []).join('\n\n')
  const leftSections = sections.filter(sec => sec.type === 'entree')
  const rightSections = sections.filter(sec => sec.type !== 'entree')

  const renderSection = (section, isLast) => (
          <section key={section.title}>
            {section.type === 'addon' ? (
              <>
                <h2 style={{ margin: 0, fontFamily: serif, fontWeight: '700', fontSize: '22px', color: GREEN }}>{section.title}</h2>
                <p style={{ margin: '4px 0 16px', fontFamily: serif, fontStyle: 'italic', fontSize: '12.5px', color: MUTED }}>{section.note || 'Extras to round out your week'}</p>
                {section.items.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <div style={{ borderTop: `1px solid ${RULE}`, margin: '12px 0' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }}>
                      <h3 style={{ margin: 0, fontFamily: serif, fontWeight: '700', fontStyle: 'italic', fontSize: '16px', color: GREEN, lineHeight: 1.3 }}>{item.name}</h3>
                      {Number.isFinite(item.price) && <span style={{ fontWeight: '700', fontSize: '14px', color: GOLD, whiteSpace: 'nowrap' }}>{money(item.price)}</span>}
                    </div>
                    {item.note && <Caps size={10} color={MUTED} style={{ marginTop: '3px' }}>{item.note}</Caps>}
                    {item.description && <p style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: 1.6, color: INK, maxWidth: '92%' }}>{item.description}</p>}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <h2 style={{ margin: 0, fontFamily: serif, fontWeight: '700', fontSize: '22px', color: GREEN }}>{section.title}</h2>
                  {section.note && <span style={{ background: GREEN, color: PAGE, fontFamily: mono, fontSize: '10.5px', letterSpacing: '0.06em', padding: '5px 10px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{section.note}</span>}
                </div>
                <div style={{ marginTop: '18px' }}>
                  {section.items.map((item, i) => (
                    <div key={item.id}>
                      {i > 0 && <Dashed />}
                      <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', columnGap: '12px' }}>
                        <span aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', border: `1px solid ${MUTED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '12px', color: MUTED, marginTop: '1px' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3 style={{ margin: '5px 0 0', fontFamily: serif, fontWeight: '700', fontStyle: 'italic', fontSize: '17px', color: GREEN, lineHeight: 1.3 }}>{item.name}</h3>
                          {item.sides && <Caps size={10} color={MUTED} style={{ marginTop: '5px', lineHeight: 1.6 }}>{item.sides}</Caps>}
                          {item.description && <p style={{ margin: '8px 0 0', fontSize: '12.5px', lineHeight: 1.65, color: INK }}>{item.description}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!isLast && <Rule />}
          </section>
  )


  return (
    <div style={{ minHeight: '100vh', background: EDGE, padding: '28px 12px 40px', fontFamily: sans, color: INK }}>
      <style>{WIDE_CSS}</style>
      <article className="pm-card" style={{ margin: '0 auto', background: PAGE, borderTop: `2px solid ${DARK}`, borderBottom: `2px solid ${DARK}` }}>
        {/* Header, as on the printed menu */}
        <div className="pm-header">
        <Caps style={{ textAlign: 'center' }}>Dinner with Charles</Caps>
        <h1 style={{ margin: '8px 0 6px', fontFamily: serif, fontWeight: '700', fontSize: '34px', lineHeight: 1.1, color: GREEN, textAlign: 'center' }}>Weekly Kitchen</h1>
        <p style={{ margin: 0, fontFamily: serif, fontStyle: 'italic', fontSize: '14px', color: SOFT, textAlign: 'center' }}>from our kitchen to your table</p>
        <div style={{ textAlign: 'center', margin: '18px 0 0' }}>
          <span style={{ display: 'inline-block', background: GREEN, color: PAGE, fontFamily: mono, fontSize: '11px', letterSpacing: '0.08em', padding: '7px 14px' }}>
            {menu?.weekOf ? `WEEK OF ${shortDate(menu.weekOf)}` : 'THIS WEEK'}
          </span>
        </div>
        <Caps size={10} color={MUTED} style={{ textAlign: 'center', marginTop: '12px' }}>Each dish feeds 2–3 people</Caps>

        {error && <p style={{ textAlign: 'center', color: '#8a2d2d', marginTop: '28px', fontSize: '14px' }}>Sorry, the menu didn’t load. Please try again in a moment.</p>}
        {!error && !menu && <p style={{ textAlign: 'center', color: MUTED, marginTop: '28px', fontFamily: serif, fontStyle: 'italic' }}>Setting the table…</p>}
        {menu && sections.length === 0 && <p style={{ textAlign: 'center', color: MUTED, marginTop: '28px', fontFamily: serif, fontStyle: 'italic' }}>Next week’s menu is on its way.</p>}

        {intro && <p style={{ margin: '24px 0 0', fontSize: '13.5px', lineHeight: 1.65, color: SOFT, textAlign: 'center', whiteSpace: 'pre-line', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>{intro}</p>}
        {sections.length > 0 && <Rule />}
        </div>

        <div className="pm-body">
          <div className="pm-col pm-col--left">
            {leftSections.map((sec, i) => renderSection(sec, i === leftSections.length - 1))}
            {leftSections.length > 0 && rightSections.length > 0 && <div className="pm-rule-between"><Rule /></div>}
          </div>
          <div className="pm-col pm-col--right">
            {rightSections.map((sec, i) => renderSection(sec, i === rightSections.length - 1))}
          </div>
        </div>

        {/* Footer box, as on the printed menu, then the two ways in */}
        {menu && (
          <div style={{ background: BOX, padding: '24px 20px', marginTop: '28px', textAlign: 'center' }}>
            <img src="/Round Badge.png" alt="" style={{ width: '64px', height: '64px', display: 'block', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontFamily: serif, fontWeight: '700', fontStyle: 'italic', fontSize: '17px', color: GREEN }}>Pull up a chair.</p>
            <p style={{ margin: '6px 0 18px', fontFamily: serif, fontStyle: 'italic', fontSize: '12.5px', color: MUTED, lineHeight: 1.5 }}>
              $160 for 3 entrées and 2 sides, delivered Monday. Each dish feeds 2–3 people. Our kitchen is at capacity just now; join the waitlist and we’ll be in touch as a spot opens.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', maxWidth: '340px', margin: '0 auto' }}>
              <a href="/?join=1" style={{ display: 'block', background: GREEN, border: `1px solid ${GREEN}`, color: PAGE, fontFamily: mono, fontSize: '11px', letterSpacing: '0.08em', padding: '11px 8px', textDecoration: 'none', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Join the waitlist</a>
              <a href="/" style={{ display: 'block', border: `1px solid ${GREEN}`, color: GREEN, fontFamily: mono, fontSize: '11px', letterSpacing: '0.08em', padding: '11px 8px', textDecoration: 'none', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' }}>Sign in to order</a>
            </div>
          </div>
        )}
        <Caps style={{ textAlign: 'center', marginTop: '18px' }}>@dinnerwithcharles</Caps>
        <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '11px', color: MUTED }}><a href="mailto:info@dinnerwithcharles.com" style={{ color: SOFT }}>info@dinnerwithcharles.com</a></p>
      </article>
    </div>
  )
}
