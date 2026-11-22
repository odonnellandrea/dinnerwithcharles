import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { summarizeWindows } from '../lib/deliveryWindows'
import { formatUsPhone } from '../lib/notificationConsent'
import { priceOrder, messengerFeeFor, pricingFor } from '../lib/pricing'
import { awaySummary, isAwayOn } from '../lib/awayDates'
import { nextMonday } from '../lib/deliveryDate'

const displayName = (p) => p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
const niceDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

// Who has ordered for the week, who hasn't yet, and who's away: the question that gets asked
// every Thursday, answered on one screen.
export default function ThisWeek({ onOpenOrders }) {
  const [deliveryDate, setDeliveryDate] = useState('')
  const [live, setLive] = useState(null) // the delivery_settings row, if any
  const [ordered, setOrdered] = useState([])
  const [waiting, setWaiting] = useState([])
  const [away, setAway] = useState([])
  const [inactive, setInactive] = useState([])
  // Reminder text for the Text buttons, with {first}, {date} and {close} filled in per person. Remembered on this device.
  const DEFAULT_NUDGE = "Hi {first}, a gentle reminder that this week's menu closes {close}. We'd love to cook for you Monday {date} — order anytime at dinnerwithcharles.com."
  const [nudgeText, setNudgeText] = useState(() => { try { return localStorage.getItem('dwc-nudge-text') || DEFAULT_NUDGE } catch { return DEFAULT_NUDGE } })
  const [showNudge, setShowNudge] = useState(false)
  const saveNudge = (text) => { setNudgeText(text); try { localStorage.setItem('dwc-nudge-text', text) } catch {} }
  const personalNudge = (p) => {
    const first = String(displayName(p) || '').trim().split(/\s+/)[0] || 'there'
    const date = deliveryDate ? new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Monday'
    const close = live?.order_close_datetime ? new Date(live.order_close_datetime).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : 'Thursday night'
    return nudgeText.replace(/\{first\}/g, first).replace(/\{date\}/g, date).replace(/\{close\}/g, close)
  }
  const nudgeLink = (p, phone) => `sms:${String(phone).replace(/[^\d+]/g, '')}&body=${encodeURIComponent(personalNudge(p))}`
  const [dishes, setDishes] = useState({ entree: [], salad: [], addon: [] }) // what's been ordered, per dish
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullNotes, setFullNotes] = useState(false)
  const [payments, setPayments] = useState({}) // order_id -> order_payments row

  // The live delivery date if one is open, else the coming Monday
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('delivery_settings').select('*').eq('is_live', true).order('delivery_date', { ascending: false }).limit(1)
      setLive(data?.[0] || null)
      setDeliveryDate(data?.[0]?.delivery_date || nextMonday())
    })()
  }, [])

  useEffect(() => { if (deliveryDate) load() }, [deliveryDate])

  const load = async () => {
    setLoading(true)
    setError('')
    const [ordersRes, peopleRes, awayRes, payRes, discountRes] = await Promise.all([
      supabase.from('Orders').select('*').eq('delivery_date', deliveryDate).neq('status', 'cancelled'),
      supabase.from('users').select('*').eq('approval_status', 'approved'),
      supabase.from('away_dates').select('*').lte('starts_on', deliveryDate).gte('ends_on', deliveryDate),
      supabase.from('order_payments').select('*'),
      supabase.from('order_discounts').select('order_id, amount_cents')
    ])
    if (ordersRes.error || peopleRes.error) { setError((ordersRes.error || peopleRes.error).message); setLoading(false); return }
    const people = peopleRes.data || []
    const byEmail = Object.fromEntries(people.map(p => [String(p.email).toLowerCase(), p]))
    const awayRows = awayRes.data || []
    const awayByUser = awayRows.reduce((acc, r) => { (acc[r.user_id] ||= []).push(r); return acc }, {})
    const payments = Object.fromEntries((payRes.data || []).map(p => [p.order_id, p]))
    setPayments(payments)
    const discounts = (discountRes.data || []).reduce((acc, d) => { acc[d.order_id] = (acc[d.order_id] || 0) + d.amount_cents / 100; return acc }, {})

    // One card per order
    const orders = Object.values((ordersRes.data || []).reduce((acc, row) => {
      const key = row.order_id
      acc[key] ||= { order_id: key, email: String(row.email).toLowerCase(), name: row.customer_name, delivery_time_slot: row.delivery_time_slot, special_notes: row.special_notes, delivery_notes: row.delivery_notes, status: row.status, rows: [] }
      acc[key].rows.push(row)
      return acc
    }, {})).map(o => {
      const profile = byEmail[o.email]
      const count = (type) => o.rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
      const addOnsCost = o.rows.filter(r => r.item_type === 'addon').reduce((n, r) => n + Number(r.total_order_price || 0) * Number(r.quantity || 0), 0)
      const { basePrice, complimentary } = pricingFor(profile)
      const price = priceOrder({ entreeCount: count('entree'), saladCount: count('salad'), addOnsCost, messengerFee: messengerFeeFor(profile), discount: discounts[o.order_id] || 0, basePrice, complimentary })
      const pay = complimentary ? 'free' : 'unpaid' // default; the saved row wins at render time
      return { ...o, name: profile ? displayName(profile) : (o.name && !o.name.includes('@') ? o.name : o.email), entrees: count('entree'), sides: count('salad'), addons: count('addon'), total: price.total, food: price.complimentary ? 0 : price.total - price.messengerFee, complimentary, pay, household: profile?.household === true,
        allergies: (profile?.allergies || '').trim(), health: (profile?.health_restrictions || '').trim(), preferences: (profile?.preference_restrictions || '').trim() }
    }).sort((a, b) => a.name.localeCompare(b.name))

    const orderedEmails = new Set(orders.map(o => o.email))
    // Household (Mom, parents) are never "expected" to order, so they don't count as waiting either
    const everyoneNotOrdered = people.filter(p => !orderedEmails.has(String(p.email).toLowerCase()) && p.household !== true)
    // Inactive customers (set on the Approvals tab) aren't expected to order, so they don't count as waiting
    const inactivePeople = everyoneNotOrdered.filter(p => p.inactive === true)
    const notOrdered = everyoneNotOrdered.filter(p => p.inactive !== true)
    const awayPeople = notOrdered.filter(p => isAwayOn(awayByUser[p.id], deliveryDate)).map(p => ({ ...p, awayText: awaySummary(awayByUser[p.id]) }))
    const stillWaiting = notOrdered.filter(p => !isAwayOn(awayByUser[p.id], deliveryDate))
    // Dish tallies: how many of each, and who, for the bars
    const tally = { entree: {}, salad: {}, addon: {} }
    orders.forEach(o => o.rows.forEach(r => {
      const bucket = tally[r.item_type]; if (!bucket) return
      const entry = bucket[r.item_name] ||= { name: r.item_name, count: 0, who: [] }
      entry.count += Number(r.quantity || 0)
      entry.who.push(o.name + (Number(r.quantity) > 1 ? ` ×${r.quantity}` : ''))
    }))
    setDishes(Object.fromEntries(Object.entries(tally).map(([type, byName]) => [type, Object.values(byName).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))])))
    setOrdered(orders)
    setWaiting(stillWaiting.sort((a, b) => displayName(a).localeCompare(displayName(b))))
    setAway(awayPeople.sort((a, b) => displayName(a).localeCompare(displayName(b))))
    setInactive(inactivePeople.sort((a, b) => displayName(a).localeCompare(displayName(b))))
    setLoading(false)
  }

  const card = { background: 'var(--a-surface)', padding: '20px', marginBottom: '20px', border: '1px solid var(--a-border)' }
  const chip = (label, value, strong) => (
    <div style={{ flex: '1 1 110px', padding: '14px 16px', background: strong ? 'var(--a-green)' : 'var(--a-cream)', border: '1px solid var(--a-border)' }}>
      <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: strong ? 'var(--a-cream)' : 'var(--a-green)', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: '6px 0 0 0', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: strong ? 'var(--a-gold)' : 'var(--a-muted)' }}>{label}</p>
    </div>
  )
  // Paid / unpaid / free: the saved row, else free for a complimentary customer, else unpaid
  const payOf = (o) => payments[o.order_id]?.status || o.pay
  const paidOn = (o) => payments[o.order_id]?.paid_at
  const setPayment = async (o, status) => {
    const row = { order_id: o.order_id, email: o.email, status, amount_cents: status === 'paid' ? Math.round(o.total * 100) : null, paid_at: status === 'paid' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
    const { error: saveError } = await supabase.from('order_payments').upsert(row, { onConflict: 'order_id' })
    if (saveError) { alert('Could not save the payment: ' + saveError.message); return }
    setPayments(prev => ({ ...prev, [o.order_id]: row }))
  }
  // Same as the Orders tab: mark delivered, then email the reheat guide (once per order)
  const markDelivered = async (o, delivered) => {
    const { error: updateError } = await supabase.from('Orders').update({ status: delivered ? 'delivered' : 'pending' }).eq('order_id', o.order_id)
    if (updateError) { alert('Could not update the order: ' + updateError.message); return }
    setOrdered(prev => prev.map(x => x.order_id === o.order_id ? { ...x, status: delivered ? 'delivered' : 'pending' } : x))
    if (!delivered) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'reheat_link', order_id: o.order_id })
      })
      if (!res.ok) {
        const { error: message } = await res.json().catch(() => ({}))
        alert('Marked delivered, but the reheat email failed: ' + (message || res.status))
      }
    } catch (err) {
      alert('Marked delivered, but the reheat email failed: ' + err.message)
    }
  }
  // Customers only: household orders (Mom, parents) are listed below but not counted
  const customerOrders = ordered.filter(o => !o.household)
  const unpaid = customerOrders.filter(o => payOf(o) === 'unpaid').length
  // Food only: the courier fee is passed through at cost, so it isn't income
  const expected = customerOrders.reduce((n, o) => n + o.food, 0)
  const maxCount = Math.max(1, ...Object.values(dishes).flat().map(d => d.count))

  // One thin bar per dish, all on the same scale, the count at the end, names on hover
  const barList = (title, items) => items.length > 0 && (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--a-gold)', fontWeight: '600' }}>{title}</p>
      {items.map(d => (
        <div key={d.name} title={d.who.join(', ')} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 46%) 1fr', gap: '10px', alignItems: 'center', padding: '5px 0' }}>
          <span style={{ fontSize: '13px', color: 'var(--a-ink)', lineHeight: 1.3 }}>{d.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span role="img" aria-label={`${d.count} order${d.count === 1 ? '' : 's'}`} style={{ display: 'block', height: '10px', width: `${(d.count / maxCount) * 100}%`, minWidth: '4px', background: 'var(--a-green)' }} />
            <span style={{ fontSize: '12px', color: 'var(--a-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.count}</span>
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--a-green)', margin: '0 0 4px 0' }}>This Week</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--a-muted)' }}>
            Delivery {deliveryDate ? niceDate(deliveryDate) : '…'}{live ? (live.is_live ? ' · ordering is open' : '') : ' · no menu is live yet'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label htmlFor="weekDate" style={{ fontSize: '12px', color: 'var(--a-muted)' }}>Other week</label>
          <input id="weekDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--a-border)', fontFamily: 'inherit' }} />
          <button onClick={load} style={{ padding: '6px 12px', background: 'var(--a-surface)', color: 'var(--a-green)', border: '1px solid var(--a-green)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Refresh</button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--a-bad-ink)', background: 'var(--a-bad-bg)', border: '1px solid var(--a-bad-border)', padding: '12px 16px', fontSize: '13px' }}>Couldn't load this week: {error}</p>}
      {loading ? <p>Loading...</p> : (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {chip('Ordered', customerOrders.length, true)}
            {chip('Not yet', waiting.length)}
            {chip('Away', away.length)}
            {chip('Unpaid', unpaid)}
            {chip('Expected', `$${Math.round(expected)}`)}
          </div>

          {ordered.length > 0 && (
            <div style={card}>
              <h3 style={{ color: 'var(--a-green)', margin: '0 0 4px 0', fontSize: '16px' }}>What's been ordered</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--a-faint)' }}>Orders per dish. Hover or hold a bar to see who.</p>
              {barList('Entrées', dishes.entree)}
              {barList('Sides', dishes.salad)}
              {barList('Add-ons', dishes.addon)}
            </div>
          )}

          {ordered.some(o => o.special_notes || o.allergies || o.health || o.preferences) && (() => {
            const flagged = ordered.filter(o => o.special_notes || o.allergies || o.health || o.preferences)
            const clip = (text, n = 48) => text.length > n ? text.slice(0, n - 1).trimEnd() + '…' : text
            return (
              <div style={{ ...card, borderLeft: '4px solid var(--a-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <h3 style={{ color: 'var(--a-green)', margin: '0 0 10px 0', fontSize: '16px' }}>Notes for the kitchen ({flagged.length})</h3>
                  <button onClick={() => setFullNotes(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--a-green)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>{fullNotes ? 'Short version' : 'Full notes'}</button>
                </div>
                {flagged.map(o => fullNotes ? (
                  <div key={o.order_id} style={{ padding: '10px 0', borderTop: '1px solid var(--a-hair)' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: 'var(--a-ink)' }}>{o.name}</p>
                    {o.allergies && <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--a-bad-ink)' }}><strong>Allergies:</strong> {o.allergies}</p>}
                    {o.health && <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--a-ink)' }}><strong>Health:</strong> {o.health}</p>}
                    {o.preferences && <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--a-ink)' }}><strong>Preferences:</strong> {o.preferences}</p>}
                    {o.special_notes && <p style={{ margin: '2px 0', fontSize: '13px', color: 'var(--a-gold-ink)' }}><strong>This order:</strong> {o.special_notes}</p>}
                  </div>
                ) : (
                  <p key={o.order_id} style={{ margin: 0, padding: '5px 0', borderTop: '1px solid var(--a-hair)', fontSize: '13px', color: 'var(--a-ink)', lineHeight: 1.5 }}>
                    <strong>{o.name.split(' ')[0]}:</strong>{' '}
                    {o.allergies && <span style={{ color: 'var(--a-bad-ink)' }}>{clip(o.allergies)}</span>}
                    {o.allergies && (o.health || o.preferences || o.special_notes) ? ' · ' : ''}
                    {[o.health, o.preferences].filter(Boolean).map(t => clip(t)).join(' · ')}
                    {(o.health || o.preferences) && o.special_notes ? ' · ' : ''}
                    {o.special_notes && <span style={{ color: 'var(--a-gold-ink)' }}>{clip(o.special_notes)}</span>}
                  </p>
                ))}
              </div>
            )
          })()}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
              <h3 style={{ color: 'var(--a-green)', margin: 0, fontSize: '16px' }}>Not yet ordered ({waiting.length})</h3>
              {waiting.length > 0 && (
                <button onClick={() => setShowNudge(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--a-green)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                  {showNudge ? 'Hide the text' : 'Edit the text'}
                </button>
              )}
            </div>
            {showNudge && (
              <div style={{ marginBottom: '12px' }}>
                <textarea value={nudgeText} onChange={(e) => saveNudge(e.target.value)} rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--a-border)', fontFamily: 'inherit', fontSize: '14px', lineHeight: 1.5, resize: 'vertical' }} />
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--a-faint)' }}>
                  {'{first}'}, {'{date}'} and {'{close}'} fill in per person. The Text buttons open Messages with this ready to send.
                  {' '}<button onClick={() => saveNudge(DEFAULT_NUDGE)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--a-green)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Reset</button>
                </p>
                {waiting[0] && <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--a-muted)', fontStyle: 'italic' }}>For {displayName(waiting[0])}: “{personalNudge(waiting[0])}”</p>}
              </div>
            )}
            {waiting.length === 0 && <p style={{ margin: 0, fontSize: '14px', color: 'var(--a-muted)' }}>Everyone who's home has ordered.</p>}
            {waiting.map(p => {
              const phone = p.phone_number || p.delivery_phone
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--a-hair)' }}>
                  <span style={{ fontSize: '14px', color: 'var(--a-ink)' }}>{displayName(p)}<span style={{ color: 'var(--a-faint)', fontSize: '12px' }}> · {p.email}</span></span>
                  <span style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    {p.sms_opt_in === true && phone && <a href={nudgeLink(p, phone)} style={{ color: 'var(--a-green)', fontWeight: '600', textDecoration: 'none', border: '1px solid var(--a-green)', padding: '3px 10px' }}>Text</a>}
                    <a href={`mailto:${p.email}`} style={{ color: 'var(--a-green)', fontWeight: '600', textDecoration: 'none', border: '1px solid var(--a-border)', padding: '3px 10px' }}>Email</a>
                  </span>
                </div>
              )
            })}
            {inactive.length > 0 && (
              <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: 'var(--a-faint)' }} title={inactive.map(p => displayName(p)).join(', ')}>
                Not counted: {inactive.length} inactive customer{inactive.length === 1 ? '' : 's'} ({inactive.map(p => displayName(p)).join(', ')}).
              </p>
            )}
          </div>

          <div style={card}>
            <h3 style={{ color: 'var(--a-green)', margin: '0 0 12px 0', fontSize: '16px' }}>Ordered ({customerOrders.length}{ordered.length > customerOrders.length ? ` + ${ordered.length - customerOrders.length} household` : ''})</h3>
            {ordered.length === 0 && <p style={{ margin: 0, fontSize: '14px', color: 'var(--a-muted)' }}>No orders yet for this date.</p>}
            {ordered.map(o => {
              const pay = payOf(o)
              const delivered = o.status === 'delivered'
              const done = delivered && pay !== 'unpaid'
              const pill = (text, tone) => (
                <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
                  background: tone === 'done' ? 'var(--a-good-bg)' : tone === 'warn' ? 'var(--a-bad-bg)' : 'var(--a-warn-bg)',
                  color: tone === 'done' ? 'var(--a-green)' : tone === 'warn' ? 'var(--a-bad-ink)' : 'var(--a-warn-ink)' }}>{text}</span>
              )
              const quiet = { background: 'none', border: 'none', padding: 0, color: 'var(--a-quiet)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }
              const primary = { padding: '5px 12px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit' }
              return (
                <div key={o.order_id} style={{ padding: '10px 0', borderTop: '1px solid var(--a-hair)', opacity: done ? 0.62 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14px', color: 'var(--a-ink)', fontWeight: '600' }}>{done ? '✓ ' : ''}{o.name}{o.household && <span style={{ marginLeft: '8px', padding: '1px 7px', fontSize: '10px', fontWeight: '600', background: 'var(--a-hair)', color: 'var(--a-muted)', verticalAlign: 'middle' }}>Household</span>}</span>
                    <span style={{ fontSize: '13px', color: 'var(--a-green)', fontWeight: '600' }}>{o.complimentary ? 'Complimentary' : `$${o.total.toFixed(2)}`}</span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--a-muted)' }}>
                    {o.entrees} entrée{o.entrees === 1 ? '' : 's'} · {o.sides} side{o.sides === 1 ? '' : 's'}{o.addons ? ` · ${o.addons} add-on${o.addons === 1 ? '' : 's'}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '7px', alignItems: 'center' }}>
                    {delivered ? pill('Delivered', 'done') : pill('Not delivered', 'soft')}
                    {pay === 'paid' ? pill('Paid', 'done')
                      : pay === 'free' ? pill('Free', 'done') : pill('Unpaid', 'warn')}
                  </div>
                  {/* Solid buttons only for what is still to do; everything else is a quiet link */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '7px', alignItems: 'center' }}>
                    {!delivered && <button onClick={() => markDelivered(o, true)} style={primary}>Mark delivered</button>}
                    {pay === 'unpaid' && <button onClick={() => setPayment(o, 'paid')} style={primary}>Mark paid</button>}
                    {delivered && <button onClick={() => markDelivered(o, false)} style={quiet}>Mark undelivered</button>}
                    {pay !== 'unpaid' && <button onClick={() => setPayment(o, 'unpaid')} style={quiet}>Mark unpaid</button>}
                    {pay === 'free' && <button onClick={() => setPayment(o, 'paid')} style={quiet}>Mark paid</button>}
                    {pay !== 'free' && <button onClick={() => setPayment(o, 'free')} style={quiet}>Mark free</button>}
                  </div>
                </div>
              )
            })}
            {ordered.length > 0 && onOpenOrders && (
              <button onClick={onOpenOrders} style={{ marginTop: '14px', background: 'none', border: 'none', padding: 0, color: 'var(--a-green)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>Open the full Orders tab</button>
            )}
          </div>

          {ordered.length > 0 && (
            <div style={card}>
              <h3 style={{ color: 'var(--a-green)', margin: '0 0 12px 0', fontSize: '16px' }}>Delivery windows</h3>
              {ordered.map(o => (
                <div key={o.order_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', padding: '6px 0', borderTop: '1px solid var(--a-hair)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--a-ink)' }}>{o.name}{o.delivery_notes && <span style={{ display: 'block', color: 'var(--a-gold-ink)', fontSize: '12px' }}>{o.delivery_notes}</span>}</span>
                  <span style={{ color: 'var(--a-green)', fontWeight: '600', textAlign: 'right', lineHeight: 1.4 }}>{summarizeWindows(o.delivery_time_slot) || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {away.length > 0 && (
            <div style={card}>
              <h3 style={{ color: 'var(--a-green)', margin: '0 0 12px 0', fontSize: '16px' }}>Away this week ({away.length})</h3>
              {away.map(p => (
                <div key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--a-hair)', fontSize: '14px', color: 'var(--a-ink)' }}>
                  {displayName(p)} <span style={{ color: 'var(--a-gold-ink)', fontSize: '12px' }}>· ✈ {p.awayText}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
