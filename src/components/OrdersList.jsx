import React, { useState } from 'react'
import { summarizeWindows } from '../lib/deliveryWindows'
import { orderNumber } from '../lib/orderNumber'

// The Orders tab: a search box, chips for week / status / payment, and one compact row per order
// grouped under its delivery date. A row opens into the dishes, delivery details and actions.
const shortDate = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
const money = (n) => `$${Number(n || 0).toFixed(2).replace(/\.00$/, '')}`
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

const pillStyle = (tone) => ({
  fontSize: '10px', fontWeight: '600', padding: '2px 7px', whiteSpace: 'nowrap',
  background: tone === 'good' ? 'var(--a-good-bg)' : tone === 'warn' ? 'var(--a-warn-bg)' : tone === 'bad' ? 'var(--a-bad-bg)' : 'var(--a-hair)',
  color: tone === 'good' ? 'var(--a-green)' : tone === 'warn' ? 'var(--a-warn-ink)' : tone === 'bad' ? 'var(--a-bad-ink)' : 'var(--a-muted)'
})
const chipStyle = (on, small) => ({
  flex: '0 0 auto', padding: small ? '4px 9px' : '6px 11px', border: `1px solid ${on ? (small ? 'var(--a-good-bg)' : 'var(--a-green)') : 'var(--a-border)'}`,
  background: on ? (small ? 'var(--a-good-bg)' : 'var(--a-green)') : 'var(--a-surface)', color: on ? (small ? 'var(--a-green)' : 'var(--a-cream)') : (small ? 'var(--a-ink-2)' : 'var(--a-green)'),
  fontSize: small ? '11px' : '12px', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit'
})
const primary = { padding: '7px 12px', background: 'var(--a-green)', color: 'var(--a-cream)', border: '1px solid var(--a-green)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit' }
const quiet = { background: 'none', border: 'none', padding: 0, color: 'var(--a-quiet)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }
const danger = { ...quiet, color: 'var(--a-bad-ink)' }

export default function OrdersList({
  orders, totalCount, loading, error, dates,
  search, setSearch, dateFilter, setDateFilter, statusFilter, setStatusFilter, paymentFilter, setPaymentFilter,
  paymentOf, orderTotal, isHousehold = () => false, setPayment, onDelivered, onUndelivered, onResend, onSendConfirmation, onCancel, onRefresh,
  onExport, includeCancelled, setIncludeCancelled
}) {
  const [open, setOpen] = useState({})
  const toggle = (id) => setOpen(prev => ({ ...prev, [id]: !prev[id] }))
  const filtersActive = search || dateFilter !== 'all' || statusFilter !== 'all' || paymentFilter !== 'all'

  const count = (o, type) => o.rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
  const summary = (o) => {
    const parts = [plural(count(o, 'entree'), 'entrée'), plural(count(o, 'salad'), 'side')]
    const addons = count(o, 'addon'); if (addons) parts.push(plural(addons, 'add-on'))
    const win = summarizeWindows(o.delivery_time_slot); if (win) parts.push(win)
    return parts.join(' · ')
  }
  const pills = (o) => {
    const out = []
    if (o.status === 'delivered') out.push(['Delivered', 'good'])
    else if (o.status === 'cancelled') out.push(['Cancelled', 'bad'])
    else out.push(['Open', 'warn'])
    if (o.status !== 'cancelled') {
      const pay = paymentOf(o).status
      out.push(pay === 'paid' ? ['Paid', 'good'] : pay === 'free' ? ['Free', 'muted'] : ['Unpaid', 'bad'])
    }
    if (isHousehold(o)) out.push(['Household', 'muted'])
    if (o.rows.some(r => (r.special_notes || '').trim())) out.push(['Kitchen note', 'muted'])
    return out
  }

  // Group what's visible under each delivery date, newest week first
  const groups = []
  for (const o of orders) {
    const last = groups[groups.length - 1]
    if (last && last.date === o.delivery_date) last.orders.push(o)
    else groups.push({ date: o.delivery_date, orders: [o] })
  }
  const groupLine = (g) => {
    // Customers only: household orders (Mom, parents) are listed but not counted
    const live = g.orders.filter(o => o.status !== 'cancelled' && !isHousehold(o))
    const expected = live.reduce((n, o) => { const t = orderTotal(o); return n + (t.complimentary ? 0 : t.total) }, 0)
    const unpaid = live.filter(o => paymentOf(o).status === 'unpaid').length
    return [plural(live.length, 'order'), money(expected), unpaid ? `${unpaid} unpaid` : 'all settled'].join(' · ')
  }

  const detail = (o) => {
    const pay = paymentOf(o); const total = orderTotal(o)
    const first = o.rows[0] || {}
    const kitchen = [...new Set(o.rows.map(r => (r.special_notes || '').trim()).filter(Boolean))]
    const deliveryNotes = [...new Set(o.rows.map(r => (r.delivery_notes || '').trim()).filter(Boolean))]
    const kv = (label, value) => value ? <span><strong style={{ color: 'var(--a-green)', fontWeight: '600' }}>{label}</strong> {value}</span> : null
    const line = (items) => { const shown = items.filter(Boolean); return shown.length ? <p style={{ margin: 0 }}>{shown.map((it, i) => <React.Fragment key={i}>{i > 0 && ' · '}{it}</React.Fragment>)}</p> : null }
    const bySection = { entree: 'Entrées', salad: 'Sides', addon: 'Add-ons' }
    return (
      <div style={{ fontSize: '12px', color: 'var(--a-ink-2)', lineHeight: 1.7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px 16px', margin: '4px 0 8px' }}>
          {['entree', 'salad', 'addon'].map(type => {
            const rows = o.rows.filter(r => r.item_type === type)
            if (!rows.length) return null
            return (
              <div key={type}>
                <p style={{ margin: 0, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--a-gold)', fontWeight: '600' }}>{bySection[type]}</p>
                {rows.map((r, i) => <p key={i} style={{ margin: 0, color: 'var(--a-ink)' }}>{Number(r.quantity) > 1 ? `${r.quantity} × ` : ''}{r.item_name}</p>)}
              </div>
            )
          })}
        </div>
        {line([kv('Delivery', `${shortDate(o.delivery_date)}${summarizeWindows(o.delivery_time_slot) ? ', ' + summarizeWindows(o.delivery_time_slot) : ''}`), deliveryNotes.length ? kv('Delivery note', deliveryNotes.join(' · ')) : null])}
        {kitchen.length > 0 && <p style={{ margin: 0 }}><strong style={{ color: 'var(--a-green)', fontWeight: '600' }}>For the kitchen</strong> <span style={{ color: 'var(--a-warn-ink)' }}>{kitchen.join(' · ')}</span></p>}
        {line([kv('Email', o.email), kv('Order', orderNumber(o.order_id)), first.created_at ? kv('Placed', shortDate(first.created_at)) : null])}
        {o.status !== 'cancelled' && line([
          kv('Total', total.complimentary ? 'Complimentary' : money(total.total)),
          total.discount ? kv('Discount', `−${money(total.discount)}`) : null,
          total.messengerFee ? kv('Courier', money(total.messengerFee)) : null,
          kv('Payment', pay.status === 'paid' ? 'Paid' : pay.status === 'free' ? 'Free' : 'Unpaid')
        ])}

        {/* Solid buttons only for the next step; the rest are quiet links */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
          {o.status === 'cancelled' ? (
            <span style={{ color: 'var(--a-faint)' }}>Cancelled. The customer can place a new order for this date.</span>
          ) : (
            <>
              {o.status !== 'delivered' && <button onClick={() => onDelivered(o)} style={primary}>Mark delivered</button>}
              {pay.status === 'unpaid' && <button onClick={() => setPayment(o, 'paid')} style={primary}>Mark paid</button>}
              {o.status === 'delivered' && <button onClick={() => onUndelivered(o)} style={quiet}>Mark undelivered</button>}
              {o.status === 'delivered' && <button onClick={() => onResend(o)} style={quiet}>Resend reheat email</button>}
              {o.status !== 'delivered' && onSendConfirmation && <button onClick={() => onSendConfirmation(o)} style={quiet}>Send confirmation email</button>}
              {pay.status !== 'unpaid' && <button onClick={() => setPayment(o, 'unpaid')} style={quiet}>Mark unpaid</button>}
              {pay.status === 'free' && <button onClick={() => setPayment(o, 'paid')} style={quiet}>Mark paid</button>}
              {pay.status !== 'free' && <button onClick={() => setPayment(o, 'free')} style={quiet}>Mark free</button>}
              {(o.status === 'pending' || o.status === 'confirmed') && <button onClick={() => onCancel(o)} style={danger}>Cancel order</button>}
            </>
          )}
        </div>
      </div>
    )
  }

  const row = (o) => {
    const isOpen = !!open[o.order_id]
    const done = o.status === 'delivered' && paymentOf(o).status !== 'unpaid'
    const total = orderTotal(o)
    return (
      <div key={o.order_id}>
        <div onClick={() => toggle(o.order_id)} role="button" aria-expanded={isOpen}
          style={{ background: isOpen ? 'var(--a-surface-2)' : 'var(--a-surface)', border: '1px solid var(--a-border)', borderTop: 'none', padding: '11px 14px', cursor: 'pointer', opacity: done && !isOpen ? 0.7 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontWeight: '600', color: 'var(--a-green)', fontSize: '14px', overflowWrap: 'anywhere' }}>{done ? '✓ ' : ''}{o.customer_name}</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: o.status === 'cancelled' ? 'var(--a-faint)' : 'var(--a-green)', whiteSpace: 'nowrap', textDecoration: o.status === 'cancelled' ? 'line-through' : 'none' }}>
              {total.complimentary ? 'Free' : money(total.total)}
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--a-muted-2)' }}>{summary(o)}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {pills(o).map(([text, tone]) => <span key={text} style={pillStyle(tone)}>{text}</span>)}
          </div>
        </div>
        {isOpen && <div style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)', borderTop: 'none', padding: '0 14px 14px' }}>{detail(o)}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ color: 'var(--a-green)', margin: '0 0 4px 0' }}>Orders</h2>
        <button onClick={onExport} style={{ ...quiet, color: 'var(--a-green)' }}>Export CSV</button>
      </div>
      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--a-muted)' }}>
        {loading ? 'Loading…' : `${plural(totalCount, 'order')} in all`}
        {' · '}<button onClick={onRefresh} style={{ ...quiet, color: 'var(--a-green)' }}>Refresh</button>
      </p>

      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, order number or dish" aria-label="Search orders"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--a-border)', fontSize: '16px', background: 'var(--a-surface)', fontFamily: 'inherit', borderRadius: 0, WebkitAppearance: 'none', appearance: 'none' }} />

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '12px 0 4px', scrollbarWidth: 'none' }}>
        <button onClick={() => setDateFilter('all')} style={chipStyle(dateFilter === 'all')}>All weeks</button>
        {dates.map(d => <button key={d} onClick={() => setDateFilter(d)} style={chipStyle(dateFilter === d)}>{shortDate(d)}</button>)}
      </div>
      <div style={{ display: 'flex', gap: '6px', padding: '4px 0 10px', flexWrap: 'wrap' }}>
        {[['active', 'Open'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)} style={chipStyle(statusFilter === key, true)}>{label}</button>
        ))}
        <span style={{ width: '8px' }} />
        {[['unpaid', 'Unpaid'], ['paid', 'Paid'], ['free', 'Free']].map(([key, label]) => (
          <button key={key} onClick={() => setPaymentFilter(paymentFilter === key ? 'all' : key)} style={chipStyle(paymentFilter === key, true)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--a-muted-2)', margin: '6px 0 8px', gap: '12px' }}>
        <span>Showing {orders.length}{filtersActive ? <> · <button onClick={() => { setSearch(''); setDateFilter('all'); setStatusFilter('all'); setPaymentFilter('all') }} style={{ ...quiet, color: 'var(--a-green)' }}>Clear filters</button></> : null}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} /> Export cancelled too
        </label>
      </div>

      {error && (
        <div style={{ color: 'var(--a-bad-ink)', background: 'var(--a-bad-bg)', border: '1px solid var(--a-bad-border)', padding: '16px', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Couldn't load the orders: {error}</p>
          <button onClick={onRefresh} style={primary}>Try again</button>
        </div>
      )}
      {!loading && !error && orders.length === 0 && (
        <p style={{ color: 'var(--a-muted)', fontSize: '14px' }}>{totalCount ? 'No orders match these filters.' : 'No orders yet.'}</p>
      )}
      {groups.map(g => (
        <div key={g.date || 'none'} style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', padding: '0 0 6px', borderBottom: '1px solid var(--a-border)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--a-green)' }}>{g.date ? `Delivery ${shortDate(g.date)}` : 'No delivery date'}</h3>
            <span style={{ fontSize: '12px', color: 'var(--a-muted-2)', textAlign: 'right' }}>{groupLine(g)}</span>
          </div>
          {g.orders.map(row)}
        </div>
      ))}
    </div>
  )
}
