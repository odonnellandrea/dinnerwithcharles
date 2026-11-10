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
      return { ...o, name: profile ? displayName(profile) : (o.name && !o.name.includes('@') ? o.name : o.email), entrees: count('entree'), sides: count('salad'), addons: count('addon'), total: price.total, food: price.complimentary ? 0 : price.total - price.messengerFee, complimentary, pay,
        allergies: (profile?.allergies || '').trim(), health: (profile?.health_restrictions || '').trim(), preferences: (profile?.preference_restrictions || '').trim() }
    }).sort((a, b) => a.name.localeCompare(b.name))

    const orderedEmails = new Set(orders.map(o => o.email))
    const notOrdered = people.filter(p => !orderedEmails.has(String(p.email).toLowerCase()))
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
    setLoading(false)
  }

  const card = { background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }
  const chip = (label, value, strong) => (
    <div style={{ flex: '1 1 110px', padding: '14px 16px', background: strong ? '#1a441f' : '#faf8f3', border: '1px solid #e0dbd1' }}>
      <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: strong ? '#faf8f3' : '#1a441f', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: '6px 0 0 0', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: strong ? '#D4A373' : '#666' }}>{label}</p>
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
  const unpaid = ordered.filter(o => payOf(o) === 'unpaid').length
  // Food only: the courier fee is passed through at cost, so it isn't income
  const expected = ordered.reduce((n, o) => n + o.food, 0)
  const maxCount = Math.max(1, ...Object.values(dishes).flat().map(d => d.count))

  // One thin bar per dish, all on the same scale, the count at the end, names on hover
  const barList = (title, items) => items.length > 0 && (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>{title}</p>
      {items.map(d => (
        <div key={d.name} title={d.who.join(', ')} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 46%) 1fr', gap: '10px', alignItems: 'center', padding: '5px 0' }}>
          <span style={{ fontSize: '13px', color: '#333', lineHeight: 1.3 }}>{d.name}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span role="img" aria-label={`${d.count} order${d.count === 1 ? '' : 's'}`} style={{ display: 'block', height: '10px', width: `${(d.count / maxCount) * 100}%`, minWidth: '4px', background: '#1a441f' }} />
            <span style={{ fontSize: '12px', color: '#666', fontVariantNumeric: 'tabular-nums' }}>{d.count}</span>
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1a441f', margin: '0 0 4px 0' }}>This Week</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Delivery {deliveryDate ? niceDate(deliveryDate) : '…'}{live ? (live.is_live ? ' · ordering is open' : '') : ' · no menu is live yet'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label htmlFor="weekDate" style={{ fontSize: '12px', color: '#666' }}>Other week</label>
          <input id="weekDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e0dbd1', fontFamily: 'inherit' }} />
          <button onClick={load} style={{ padding: '6px 12px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Refresh</button>
        </div>
      </div>

      {error && <p style={{ color: '#c62828', background: '#ffebee', border: '1px solid #ffcdd2', padding: '12px 16px', fontSize: '13px' }}>Couldn't load this week: {error}</p>}
      {loading ? <p>Loading...</p> : (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {chip('Ordered', ordered.length, true)}
            {chip('Not yet', waiting.length)}
            {chip('Away', away.length)}
            {chip('Unpaid', unpaid)}
            {chip('Expected', `$${Math.round(expected)}`)}
          </div>

          {ordered.length > 0 && (
            <div style={card}>
              <h3 style={{ color: '#1a441f', margin: '0 0 4px 0', fontSize: '16px' }}>What's been ordered</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#999' }}>Orders per dish. Hover or hold a bar to see who.</p>
              {barList('Entrées', dishes.entree)}
              {barList('Sides', dishes.salad)}
              {barList('Add-ons', dishes.addon)}
            </div>
          )}

          {ordered.some(o => o.special_notes || o.allergies || o.health || o.preferences) && (() => {
            const flagged = ordered.filter(o => o.special_notes || o.allergies || o.health || o.preferences)
            const clip = (text, n = 48) => text.length > n ? text.slice(0, n - 1).trimEnd() + '…' : text
            return (
              <div style={{ ...card, borderLeft: '4px solid #D4A373' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                  <h3 style={{ color: '#1a441f', margin: '0 0 10px 0', fontSize: '16px' }}>Notes for the kitchen ({flagged.length})</h3>
                  <button onClick={() => setFullNotes(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: '#1a441f', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>{fullNotes ? 'Short version' : 'Full notes'}</button>
                </div>
                {flagged.map(o => fullNotes ? (
                  <div key={o.order_id} style={{ padding: '10px 0', borderTop: '1px solid #f0ece3' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#333' }}>{o.name}</p>
                    {o.allergies && <p style={{ margin: '2px 0', fontSize: '13px', color: '#c62828' }}><strong>Allergies:</strong> {o.allergies}</p>}
                    {o.health && <p style={{ margin: '2px 0', fontSize: '13px', color: '#333' }}><strong>Health:</strong> {o.health}</p>}
                    {o.preferences && <p style={{ margin: '2px 0', fontSize: '13px', color: '#333' }}><strong>Preferences:</strong> {o.preferences}</p>}
                    {o.special_notes && <p style={{ margin: '2px 0', fontSize: '13px', color: '#b8923f' }}><strong>This order:</strong> {o.special_notes}</p>}
                  </div>
                ) : (
                  <p key={o.order_id} style={{ margin: 0, padding: '5px 0', borderTop: '1px solid #f0ece3', fontSize: '13px', color: '#333', lineHeight: 1.5 }}>
                    <strong>{o.name.split(' ')[0]}:</strong>{' '}
                    {o.allergies && <span style={{ color: '#c62828' }}>{clip(o.allergies)}</span>}
                    {o.allergies && (o.health || o.preferences || o.special_notes) ? ' · ' : ''}
                    {[o.health, o.preferences].filter(Boolean).map(t => clip(t)).join(' · ')}
                    {(o.health || o.preferences) && o.special_notes ? ' · ' : ''}
                    {o.special_notes && <span style={{ color: '#b8923f' }}>{clip(o.special_notes)}</span>}
                  </p>
                ))}
              </div>
            )
          })()}

          <div style={card}>
            <h3 style={{ color: '#1a441f', margin: '0 0 12px 0', fontSize: '16px' }}>Not yet ordered ({waiting.length})</h3>
            {waiting.length === 0 && <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Everyone who's home has ordered.</p>}
            {waiting.map(p => {
              const phone = p.phone_number || p.delivery_phone
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid #f0ece3' }}>
                  <span style={{ fontSize: '14px', color: '#333' }}>{displayName(p)}<span style={{ color: '#999', fontSize: '12px' }}> · {p.email}</span></span>
                  <span style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    {p.sms_opt_in === true && phone && <a href={`sms:${String(phone).replace(/[^\d+]/g, '')}`} style={{ color: '#1a441f', fontWeight: '600', textDecoration: 'none', border: '1px solid #1a441f', padding: '3px 10px' }}>Text</a>}
                    <a href={`mailto:${p.email}`} style={{ color: '#1a441f', fontWeight: '600', textDecoration: 'none', border: '1px solid #e0dbd1', padding: '3px 10px' }}>Email</a>
                  </span>
                </div>
              )
            })}
          </div>

          <div style={card}>
            <h3 style={{ color: '#1a441f', margin: '0 0 12px 0', fontSize: '16px' }}>Ordered ({ordered.length})</h3>
            {ordered.length === 0 && <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>No orders yet for this date.</p>}
            {ordered.map(o => (
              <div key={o.order_id} style={{ padding: '10px 0', borderTop: '1px solid #f0ece3' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', color: '#333', fontWeight: '600' }}>{o.name}</span>
                  <span style={{ fontSize: '13px', color: '#1a441f', fontWeight: '600' }}>
                    {o.complimentary ? 'Complimentary' : `$${o.total.toFixed(2)}`}
                    <span style={{ marginLeft: '8px', padding: '1px 7px', fontSize: '11px', background: payOf(o) === 'paid' ? '#1a441f' : payOf(o) === 'free' ? '#e0dbd1' : '#ffebee', color: payOf(o) === 'paid' ? '#faf8f3' : payOf(o) === 'free' ? '#1a441f' : '#c62828' }}>
                      {payOf(o) === 'paid' ? `Paid${paidOn(o) ? ' ' + new Date(paidOn(o)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}` : payOf(o) === 'free' ? 'Free' : 'Unpaid'}
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {o.status === 'delivered'
                    ? <button onClick={() => markDelivered(o, false)} style={{ padding: '3px 10px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Mark undelivered</button>
                    : <button onClick={() => markDelivered(o, true)} style={{ padding: '3px 10px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Mark delivered</button>}
                  {payOf(o) !== 'paid' && <button onClick={() => setPayment(o, 'paid')} style={{ padding: '3px 10px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Mark paid</button>}
                  {payOf(o) !== 'unpaid' && <button onClick={() => setPayment(o, 'unpaid')} style={{ padding: '3px 10px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Mark unpaid</button>}
                  {payOf(o) !== 'free' && <button onClick={() => setPayment(o, 'free')} style={{ padding: '3px 10px', background: 'white', color: '#666', border: '1px solid #e0dbd1', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Mark free</button>}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
                  {o.entrees} entrée{o.entrees === 1 ? '' : 's'} · {o.sides} side{o.sides === 1 ? '' : 's'}{o.addons ? ` · ${o.addons} add-on${o.addons === 1 ? '' : 's'}` : ''}
                  {o.status === 'delivered' ? ' · ✓ delivered' : ''}
                </p>
              </div>
            ))}
            {ordered.length > 0 && onOpenOrders && (
              <button onClick={onOpenOrders} style={{ marginTop: '14px', background: 'none', border: 'none', padding: 0, color: '#1a441f', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>Open the full Orders tab</button>
            )}
          </div>

          {ordered.length > 0 && (
            <div style={card}>
              <h3 style={{ color: '#1a441f', margin: '0 0 12px 0', fontSize: '16px' }}>Delivery windows</h3>
              {ordered.map(o => (
                <div key={o.order_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', padding: '6px 0', borderTop: '1px solid #f0ece3', fontSize: '13px' }}>
                  <span style={{ color: '#333' }}>{o.name}{o.delivery_notes && <span style={{ display: 'block', color: '#b8923f', fontSize: '12px' }}>{o.delivery_notes}</span>}</span>
                  <span style={{ color: '#1a441f', fontWeight: '600', textAlign: 'right', lineHeight: 1.4 }}>{summarizeWindows(o.delivery_time_slot) || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {away.length > 0 && (
            <div style={card}>
              <h3 style={{ color: '#1a441f', margin: '0 0 12px 0', fontSize: '16px' }}>Away this week ({away.length})</h3>
              {away.map(p => (
                <div key={p.id} style={{ padding: '8px 0', borderTop: '1px solid #f0ece3', fontSize: '14px', color: '#333' }}>
                  {displayName(p)} <span style={{ color: '#b8923f', fontSize: '12px' }}>· ✈ {p.awayText}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
