import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatUsPhone } from '../lib/notificationConsent'
import { deliveryOptionLabel } from '../lib/deliveryOptions'
import { awaySummary, isAwayOn, todayIso } from '../lib/awayDates'
import { nextMonday } from '../lib/deliveryDate'
import { BASE_PRICE } from '../lib/pricing'
import MessengerFeeEditor from './MessengerFeeEditor'
import CustomerPricing from './CustomerPricing'

// The customer list: search, status chips, stackable filters, one compact row per person that
// opens into the full detail and actions. Requests to join stay pinned on top whatever is filtered.
const displayName = (p) => p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
const shortDate = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
const agoText = (iso) => {
  if (!iso) return ''
  const d = daysAgo(iso)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? `${d}d ago` : d < 60 ? `${Math.round(d / 7)}w ago` : shortDate(iso)
}

const STATUS = [
  ['all', 'All'], ['pending', 'Needs approval'], ['active', 'Active'], ['inactive', 'Inactive'],
  ['paused', 'On hold'], ['waitlisted', 'Waitlist'], ['rejected', 'Rejected']
]
const EXTRA = [
  ['away', 'Away this week'], ['orderedThisWeek', 'Ordered this week'], ['quiet', "Hasn't ordered in 3+ weeks"],
  ['texts', 'Texts on'], ['messenger', 'Messenger delivery'], ['ff', 'Friends & family price'], ['allergies', 'Has allergies']
]
const SORTS = [['lastOrdered', 'Last ordered'], ['name', 'Name A–Z'], ['newest', 'Newest'], ['lastSignIn', 'Last sign-in']]

const pillStyle = (tone) => ({
  fontSize: '10px', fontWeight: '600', padding: '2px 7px', whiteSpace: 'nowrap',
  background: tone === 'good' ? '#e6efe9' : tone === 'warn' ? '#fff6e5' : tone === 'bad' ? '#ffebee' : '#f0ece3',
  color: tone === 'good' ? '#083525' : tone === 'warn' ? '#9a6b14' : tone === 'bad' ? '#c62828' : '#666'
})
const btn = (kind) => ({
  padding: '7px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
  background: kind === 'primary' ? '#083525' : kind === 'gold' ? '#D4A373' : 'white',
  color: kind === 'primary' || kind === 'gold' ? '#faf8f3' : kind === 'quiet' ? '#555' : '#083525',
  border: kind === 'quiet' ? '1px solid #e0dbd1' : kind === 'primary' ? '1px solid #083525' : kind === 'gold' ? '1px solid #D4A373' : '1px solid #083525'
})
const chipStyle = (on, small) => ({
  flex: '0 0 auto', padding: small ? '4px 9px' : '6px 11px', border: `1px solid ${on ? (small ? '#e6efe9' : '#083525') : '#e0dbd1'}`,
  background: on ? (small ? '#e6efe9' : '#083525') : 'white', color: on ? (small ? '#083525' : '#faf8f3') : (small ? '#555' : '#083525'),
  fontSize: small ? '11px' : '12px', fontWeight: '600', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit'
})

export default function Customers({ customers, loading, loginStats, awayByUser, answerFields, optInLabel, onApprove, onReject, onSetStatus, onSetInactive, onEdit, onPatch, onRefresh }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [extras, setExtras] = useState({})
  const [sort, setSort] = useState('lastOrdered')
  const [open, setOpen] = useState({})
  const [showAnswers, setShowAnswers] = useState({})
  const [orderStats, setOrderStats] = useState({}) // email -> { count, last, unpaid, thisWeek }
  const [weekDate, setWeekDate] = useState(nextMonday())

  // Order history per person, plus which delivery date counts as "this week"
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [settings, orders, payments] = await Promise.all([
        supabase.from('delivery_settings').select('delivery_date, is_live').eq('is_live', true).order('delivery_date', { ascending: false }).limit(1),
        supabase.from('Orders').select('order_id, email, delivery_date, status'),
        supabase.from('order_payments').select('order_id, status')
      ])
      if (cancelled) return
      const week = settings.data?.[0]?.delivery_date || nextMonday()
      const fourWeeksAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10) })()
      setWeekDate(week)
      const pay = Object.fromEntries((payments.data || []).map(p => [p.order_id, p.status]))
      const seen = new Set(); const stats = {}
      for (const row of orders.data || []) {
        if (row.status === 'cancelled' || !row.email) continue
        const key = `${row.order_id}|${row.email}`
        if (seen.has(key)) continue
        seen.add(key)
        const email = String(row.email).toLowerCase()
        const s = stats[email] ||= { count: 0, last: '', unpaid: 0, thisWeek: false }
        s.count += 1
        if (row.delivery_date > s.last) s.last = row.delivery_date
        if (row.delivery_date === week) s.thisWeek = true
        // Unpaid only counts recent deliveries: older orders predate payment tracking
        if (row.delivery_date <= todayIso() && row.delivery_date >= fourWeeksAgo && (pay[row.order_id] || 'unpaid') === 'unpaid') s.unpaid += 1
      }
      setOrderStats(stats)
    })()
    return () => { cancelled = true }
  }, [customers.length])

  const statOf = (c) => orderStats[String(c.email).toLowerCase()] || { count: 0, last: '', unpaid: 0, thisWeek: false }
  const bucket = (c) => c.approval_status === 'approved' ? (c.inactive ? 'inactive' : 'active') : c.approval_status
  const isFF = (c) => c.complimentary === true || (Number.isFinite(Number(c.base_price)) && c.base_price !== null && Number(c.base_price) < BASE_PRICE)
  const threeWeeksAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 21); return d.toISOString().slice(0, 10) }, [])

  const counts = useMemo(() => {
    const n = { all: customers.length }
    for (const c of customers) n[bucket(c)] = (n[bucket(c)] || 0) + 1
    return n
  }, [customers])

  const q = search.trim().toLowerCase()
  const matches = (c) => {
    if (q) {
      const hay = [displayName(c), c.email, c.phone_number, c.delivery_phone, c.delivery_address].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q) && !formatUsPhone(c.phone_number || c.delivery_phone || '').toLowerCase().includes(q)) return false
    }
    const b = bucket(c)
    if (status === 'all' ? b === 'rejected' : b !== status) return false
    const s = statOf(c)
    if (extras.away && !isAwayOn(awayByUser[c.id], weekDate)) return false
    if (extras.orderedThisWeek && !s.thisWeek) return false
    if (extras.quiet && !(s.count === 0 || s.last < threeWeeksAgo)) return false
    if (extras.texts && c.sms_opt_in !== true) return false
    if (extras.messenger && c.messenger_delivery !== true) return false
    if (extras.ff && !isFF(c)) return false
    if (extras.allergies && !(c.allergies || '').trim()) return false
    return true
  }

  const sorters = {
    lastOrdered: (a, b) => (statOf(b).last || '').localeCompare(statOf(a).last || '') || displayName(a).localeCompare(displayName(b)),
    name: (a, b) => displayName(a).localeCompare(displayName(b)),
    newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    lastSignIn: (a, b) => String(loginStats[b.id]?.last_sign_in_at || '').localeCompare(String(loginStats[a.id]?.last_sign_in_at || ''))
  }
  const pending = customers.filter(c => c.approval_status === 'pending' && (!q || matches({ ...c, approval_status: 'pending' }))).sort(sorters.newest)
  const rows = customers.filter(c => c.approval_status !== 'pending' && matches(c)).sort(sorters[sort])
  const toggle = (setter) => (id) => setter(prev => ({ ...prev, [id]: !prev[id] }))

  const summary = (c) => {
    const s = statOf(c); const parts = []
    if (s.thisWeek) parts.push(`Ordered ${shortDate(s.last)}`)
    else if (s.last) parts.push(`Last ordered ${shortDate(s.last)}`)
    else parts.push('No orders yet')
    if (s.count) parts.push(`${s.count} order${s.count === 1 ? '' : 's'}`)
    const away = awaySummary(awayByUser[c.id]); if (away) parts.push(`✈ ${away}`)
    const login = loginStats[c.id]
    if (login?.last_sign_in_at) parts.push(`signed in ${agoText(login.last_sign_in_at)}`)
    if (c.complimentary === true) parts.push('complimentary')
    else if (s.unpaid) parts.push(`${s.unpaid} unpaid`)
    return parts.join(' · ')
  }
  const pills = (c) => {
    const s = statOf(c); const b = bucket(c); const out = []
    out.push(b === 'active' ? ['Active', 'good'] : b === 'inactive' ? ['Inactive', 'muted'] : b === 'paused' ? ['On hold', 'warn'] : b === 'waitlisted' ? ['Waitlist', 'warn'] : b === 'rejected' ? ['Rejected', 'bad'] : ['Pending', 'warn'])
    if (isAwayOn(awayByUser[c.id], weekDate)) out.push(['Away', 'warn'])
    if (c.complimentary === true) out.push(['Free', 'muted'])
    else if (s.unpaid) out.push(['Unpaid', 'bad'])
    if (c.sms_opt_in === true) out.push(['Texts', 'good'])
    if (c.messenger_delivery === true) out.push(['Messenger', 'muted'])
    return out
  }

  const actions = (c) => {
    const name = displayName(c)
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        {c.approval_status !== 'approved' && <button onClick={() => onApprove(c.id)} style={btn('primary')}>Approve</button>}
        {c.approval_status === 'paused' && <button onClick={() => onSetStatus(c.id, 'approved')} style={btn('primary')}>Resume</button>}
        <button onClick={() => onEdit(c)} style={btn()}>Edit details</button>
        <button onClick={() => toggle(setShowAnswers)(c.id)} style={btn('quiet')}>{showAnswers[c.id] ? 'Hide answers' : 'All answers'}</button>
        {c.approval_status === 'approved' && (
          <button onClick={() => onSetInactive(c.id, !c.inactive)} title={c.inactive ? 'Count them as expected to order again' : "They keep their login and emails, but This Week won't count them as not yet ordered"} style={btn('quiet')}>
            {c.inactive ? 'Mark active' : 'Mark inactive'}
          </button>
        )}
        {c.approval_status === 'approved' && (
          <button onClick={() => { if (window.confirm(`Pause ${name}? They can still sign in but won't see the menu or be able to order until you resume them.`)) onSetStatus(c.id, 'paused') }} style={btn('quiet')}>Pause</button>
        )}
        {(c.approval_status === 'pending' || c.approval_status === 'rejected') && (
          <button onClick={() => { if (window.confirm(`Put ${name} on the neighborhood waitlist? They'll see a note that we don't deliver to them yet, and you can approve them when you do.`)) onSetStatus(c.id, 'waitlisted') }} style={btn()}>Waitlist</button>
        )}
        {c.approval_status !== 'rejected' && (
          <button onClick={() => { if (window.confirm(`Reject ${name}? They'll no longer be able to order.`)) onReject(c.id) }} style={btn('gold')}>Reject</button>
        )}
      </div>
    )
  }

  const detail = (c) => {
    const login = loginStats[c.id]
    const kv = (label, value) => value ? <span><strong style={{ color: '#083525', fontWeight: '600' }}>{label}</strong> {value}</span> : null
    const line = (items) => { const shown = items.filter(Boolean); return shown.length ? <p style={{ margin: 0 }}>{shown.map((it, i) => <React.Fragment key={i}>{i > 0 && ' · '}{it}</React.Fragment>)}</p> : null }
    return (
      <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.7, marginTop: '4px' }}>
        {line([kv('Email', c.email), kv('Phone', formatUsPhone(c.phone_number || c.delivery_phone || '') || null)])}
        {line([kv('Address', c.delivery_address), kv('Delivery', c.delivery_option ? deliveryOptionLabel(c.delivery_option) : null), kv('Instructions', c.delivery_instructions)])}
        {line([kv('Allergies', c.allergies), kv('Health', c.health_restrictions), kv('Preferences', c.preference_restrictions)])}
        {line([kv('Referral code', c.referral_code), kv('Heard about us', [c.heard_about, c.heard_about_detail].filter(Boolean).join(': ') || null), kv('Joined', shortDate(c.created_at))])}
        {line([kv('Away', awaySummary(awayByUser[c.id])), login ? kv('Sign-ins', login.last_sign_in_at ? `last ${shortDate(login.last_sign_in_at)}${Number(login.login_count) > 0 ? `, ${login.login_count} since Oct 27` : ''}` : 'never') : null])}
        {line([kv('Email updates', optInLabel(c, 'email_opt_in')), kv('Order texts', optInLabel(c, 'sms_opt_in')), kv('Offers texts', c.sms_marketing_opt_in === true ? 'Yes' : 'No')])}
        {c.resubmitted_at && <p style={{ margin: '4px 0 0 0', color: '#083525', fontWeight: '600' }}>Resubmitted {shortDate(c.resubmitted_at)}</p>}

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 0 0', color: '#083525', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={c.messenger_delivery === true}
            onChange={async (e) => {
              const checked = e.target.checked
              onPatch(c.id, { messenger_delivery: checked })
              const { error } = await supabase.from('users').update({ messenger_delivery: checked }).eq('id', c.id)
              if (error) alert('Failed to save: ' + error.message)
              else onRefresh()
            }}
            style={{ cursor: 'pointer' }}
          />
          Messenger delivery (outside walking range, fee passed through per order)
        </label>
        {c.messenger_delivery === true && <MessengerFeeEditor customer={c} onSaved={(fee) => onPatch(c.id, { messenger_fee: fee })} />}
        {c.approval_status === 'approved' && <CustomerPricing customer={c} onSaved={(changes) => onPatch(c.id, changes)} />}

        {actions(c)}

        {showAnswers[c.id] && (
          <dl className="admin-answers">
            {answerFields.map(([label, field]) => (
              <div key={field}><dt>{label}</dt><dd>{c[field] ? String(c[field]) : '—'}</dd></div>
            ))}
            <div><dt>Email updates</dt><dd>{optInLabel(c, 'email_opt_in')}</dd></div>
            <div><dt>Order and menu texts</dt><dd>{optInLabel(c, 'sms_opt_in')}{optInLabel(c, 'sms_opt_in') === 'Yes' && c.phone_number ? ` · ${formatUsPhone(c.phone_number)}` : ''}</dd></div>
            <div><dt>News and offers texts</dt><dd>{c.sms_marketing_opt_in === true ? 'Yes' : 'No'}</dd></div>
          </dl>
        )}
      </div>
    )
  }

  const rowStyle = (isOpen) => ({ background: 'white', border: '1px solid #e0dbd1', borderTop: 'none', padding: '11px 14px', cursor: 'pointer', ...(isOpen ? { background: '#fffdf9' } : {}) })
  const row = (c, extra) => {
    const isOpen = !!open[c.id]
    return (
      <div key={c.id}>
        <div style={rowStyle(isOpen)} onClick={() => toggle(setOpen)(c.id)} role="button" aria-expanded={isOpen}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '600', color: '#083525', fontSize: '14px', overflowWrap: 'anywhere' }}>{displayName(c)}</span>
            <span style={{ color: '#bbb', fontSize: '12px', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#777' }}>{extra || summary(c)}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {pills(c).map(([text, tone]) => <span key={text} style={pillStyle(tone)}>{text}</span>)}
          </div>
        </div>
        {isOpen && <div style={{ background: '#fffdf9', border: '1px solid #e0dbd1', borderTop: 'none', padding: '0 14px 14px' }}>{detail(c)}</div>}
      </div>
    )
  }

  const activeExtras = Object.keys(extras).filter(k => extras[k])
  const headline = [`${customers.length} people`, counts.active ? `${counts.active} active` : '', counts.inactive ? `${counts.inactive} inactive` : '', counts.paused ? `${counts.paused} on hold` : '', counts.waitlisted ? `${counts.waitlisted} on the waitlist` : '', pending.length ? `${pending.length} waiting for approval` : ''].filter(Boolean).join(' · ')

  return (
    <div>
      <h2 style={{ color: '#083525', margin: '0 0 4px 0' }}>Customers</h2>
      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666' }}>{loading ? 'Loading…' : headline}</p>

      <input
        type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" aria-label="Search customers"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #e0dbd1', fontSize: '16px', background: 'white', fontFamily: 'inherit', borderRadius: 0, WebkitAppearance: 'none', appearance: 'none' }}
      />
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '12px 0 4px', scrollbarWidth: 'none' }}>
        {STATUS.map(([key, label]) => (
          <button key={key} onClick={() => setStatus(key)} style={chipStyle(status === key)}>
            {label}{counts[key] ? <small style={{ fontWeight: '500', opacity: 0.75, marginLeft: '4px' }}>{counts[key]}</small> : null}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', padding: '4px 0 10px', flexWrap: 'wrap' }}>
        {EXTRA.map(([key, label]) => (
          <button key={key} onClick={() => setExtras(prev => ({ ...prev, [key]: !prev[key] }))} style={chipStyle(!!extras[key], true)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#777', margin: '6px 0 8px', gap: '12px' }}>
        <span>Showing {rows.length + pending.length}{activeExtras.length || status !== 'all' || q ? <> · <button onClick={() => { setSearch(''); setStatus('all'); setExtras({}) }} style={{ background: 'none', border: 'none', padding: 0, color: '#083525', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Clear filters</button></> : null}</span>
        <label>Sort <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ border: 'none', background: 'none', font: 'inherit', color: '#083525', fontWeight: '600' }}>
          {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>

      {pending.length > 0 && (
        <div style={{ background: '#fff6e5', border: '1px solid #f0dcb0', padding: '12px 14px', marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#9a6b14', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Needs approval</h3>
          {pending.map(c => (
            <div key={c.id} style={{ padding: '6px 0', borderTop: '1px solid #f0dcb0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                <span style={{ fontWeight: '600', color: '#083525', fontSize: '14px' }}>{displayName(c)}</span>
                <span style={pillStyle('warn')}>Pending</span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#777' }}>
                Joined {shortDate(c.created_at)}{c.heard_about ? ` · heard about us: ${[c.heard_about, c.heard_about_detail].filter(Boolean).join(', ')}` : ''}{c.delivery_address ? ` · ${c.delivery_address}` : ''}{c.resubmitted_at ? ` · resubmitted ${shortDate(c.resubmitted_at)}` : ''}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button onClick={() => onApprove(c.id)} style={btn('primary')}>Approve</button>
                <button onClick={() => { if (window.confirm(`Put ${displayName(c)} on the neighborhood waitlist? They'll see a note that we don't deliver to them yet, and you can approve them when you do.`)) onSetStatus(c.id, 'waitlisted') }} style={btn()}>Waitlist</button>
                <button onClick={() => { const next = !open[c.id]; setOpen(prev => ({ ...prev, [c.id]: next })); setShowAnswers(prev => ({ ...prev, [c.id]: next })) }} style={btn('quiet')}>{open[c.id] ? 'Hide details' : 'View answers'}</button>
                <button onClick={() => { if (window.confirm(`Reject ${displayName(c)}?`)) onReject(c.id) }} style={btn('gold')}>Reject</button>
              </div>
              {open[c.id] && <div style={{ marginTop: '6px' }}>{detail(c)}</div>}
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && pending.length === 0 && (
        <p style={{ color: '#666', fontSize: '14px' }}>{customers.length ? 'Nobody matches those filters.' : 'No customers yet.'}</p>
      )}
      {rows.length > 0 && (
        <div style={{ borderTop: '1px solid #e0dbd1' }}>
          {rows.map(c => row(c))}
        </div>
      )}
    </div>
  )
}
