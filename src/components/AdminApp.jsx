import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { formatWindows } from '../lib/deliveryWindows'
import { formatUsPhone } from '../lib/notificationConsent'
import '../styles/admin.css'
import NotificationsDashboard from './NotificationsDashboard'
import DocumentGenerationDashboard from './DocumentGenerationDashboard'
import CustomerEditModal from './CustomerEditModal'
import { MESSENGER_FEE } from '../lib/pricing'
import { deliveryOptionLabel } from '../lib/deliveryOptions'
import { fetchSheetMenu, MENU_SHEET_URL } from '../lib/sheetMenu'

// The sheet itself, for editing (the URL above is its CSV export)
const MENU_SHEET_EDIT_URL = MENU_SHEET_URL.replace(/\/gviz\/.*$/, '/edit')

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)


export default function AdminApp({ onLogout }) {
  const [screen, setScreen] = useState('approvals')
  const [orders, setOrders] = useState([])
  const [includeCancelledInExport, setIncludeCancelledInExport] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderDateFilter, setOrderDateFilter] = useState('all')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all') // all | active | delivered | cancelled
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [expandedAnswers, setExpandedAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  
  // Menu states
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderCloseLocal, setOrderCloseLocal] = useState('') // value for <input type="datetime-local">
  const [menuLive, setMenuLive] = useState(false) // delivery_settings.is_live for the selected date
  const [menuEmailSentAt, setMenuEmailSentAt] = useState(null)
  const [menuEmailRecipients, setMenuEmailRecipients] = useState(null) // approved customers opted in to menu emails
  const [sendingMenuEmail, setSendingMenuEmail] = useState(false)
  const [sheetMenu, setSheetMenu] = useState(null) // what customers see right now, read from the Google Sheet
  const [sheetError, setSheetError] = useState('')
  const [surveyQuestion, setSurveyQuestion] = useState('')
  const [isSurveyActive, setIsSurveyActive] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0) // requests to join waiting for approval

  // Badge on the Approvals tab, refreshed whenever the admin changes tabs
  useEffect(() => {
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending')
      .then(({ count }) => setWaitingCount(count || 0))
  }, [screen, pendingCustomers])

  useEffect(() => {
    if (screen === 'orders') {
      fetchOrders()
    } else if (screen === 'approvals') {
      fetchPendingCustomers()
    } else if (screen === 'menu') {
      initializeMenu()
    }
  }, [screen])

  const initializeMenu = async () => {
    setLoading(true)
    loadSheetMenu()
    const nextDate = getNextDeliveryDate()
    setDeliveryDate(nextDate)
    await fetchOrderClose(nextDate)
    await fetchMenuEmailRecipients()
    setLoading(false)
  }

  // datetime-local inputs want local "YYYY-MM-DDTHH:mm"; the DB stores a UTC timestamp
  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Default close time: 11:00 PM on the Thursday before the delivery date (local time)
  const defaultCloseLocal = (date) => {
    const [y, m, d] = String(date).split('-').map(Number)
    if (!y || !m || !d) return ''
    const dt = new Date(y, m - 1, d)
    do { dt.setDate(dt.getDate() - 1) } while (dt.getDay() !== 4)
    const pad = (n) => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T23:00`
  }

  const fetchOrderClose = async (date) => {
    const { data } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('delivery_date', date)
    setOrderCloseLocal(data?.[0]?.order_close_datetime ? toLocalInput(data[0].order_close_datetime) : defaultCloseLocal(date))
    setMenuLive(data?.[0]?.is_live === true)
    setMenuEmailSentAt(data?.[0]?.menu_email_sent_at || null)
  }

  const fetchMenuEmailRecipients = async () => {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'approved')
      .eq('email_opt_in', true)
    setMenuEmailRecipients(count ?? 0)
  }

  // Emails this week's menu to every approved customer who opted in. The function refuses
  // to send twice for the same delivery date unless resend is true.
  const sendMenuEmail = async () => {
    const resend = !!menuEmailSentAt
    const who = `${menuEmailRecipients ?? 'all opted-in'} customer${menuEmailRecipients === 1 ? '' : 's'}`
    if (!window.confirm(resend ? `Send the menu email again to ${who}?` : `Send this week's menu to ${who}?`)) return
    setSendingMenuEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'menu_live', delivery_date: deliveryDate, resend })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert('The menu email failed: ' + (body.error || res.status))
      } else if (body.skipped) {
        alert('The menu email already went out for this date.')
      } else {
        alert(`✓ Menu email sent to ${body.sent} customer${body.sent === 1 ? '' : 's'}` + (body.failed?.length ? `. Failed for: ${body.failed.join(', ')}` : ''))
      }
    } catch (err) {
      alert('The menu email failed: ' + err.message)
    }
    setSendingMenuEmail(false)
    await fetchOrderClose(deliveryDate)
  }

  const saveOrderClose = async () => {
    if (!orderCloseLocal) {
      alert('Pick the date and time orders close')
      return
    }
    const closeIso = new Date(orderCloseLocal).toISOString()
    const { data } = await supabase
      .from('delivery_settings')
      .select('delivery_date')
      .eq('delivery_date', deliveryDate)
    const { error } = data?.length > 0
      ? await supabase.from('delivery_settings').update({ order_close_datetime: closeIso }).eq('delivery_date', deliveryDate)
      : await supabase.from('delivery_settings').insert({ delivery_date: deliveryDate, order_open_datetime: new Date().toISOString(), order_close_datetime: closeIso, is_live: false })
    alert(error ? 'Error saving close time: ' + error.message : '✓ Orders close ' + new Date(closeIso).toLocaleString())
  }

  const getNextDeliveryDate = () => {
    const today = new Date()
    let nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7))
    return nextMonday.toISOString().split('T')[0]
  }


  const loadSheetMenu = async () => {
    setSheetError('')
    try {
      setSheetMenu(await fetchSheetMenu({ force: true }))
    } catch (err) {
      setSheetMenu(null)
      setSheetError("Couldn't read the menu sheet. Check that it's shared as \"Anyone with the link can view\".")
    }
  }

  const handleDeliveryDateChange = async (e) => {
    const newDate = e.target.value
    setDeliveryDate(newDate)
    await fetchOrderClose(newDate)
  }

  const toggleMenuLive = async () => {
    if (!orderCloseLocal) {
      alert('Set when orders close before going live')
      return
    }

    const failed = (what, error, note = 'Nothing else was changed.') => alert(`Couldn't ${what}: ${error.message}\n\n${note} Please try again.`)

    const { data, error: readError } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('delivery_date', deliveryDate)
    if (readError) return failed('check this delivery date', readError)

    const existing = data?.length > 0 ? data[0] : null
    const turningOn = !existing || !existing.is_live

    // Only one delivery date is ever live. Switch every other date off first, so if the
    // next step fails the result is "nothing live" rather than two live menus.
    if (turningOn) {
      const { error: othersError } = await supabase
        .from('delivery_settings')
        .update({ is_live: false })
        .neq('delivery_date', deliveryDate)
      if (othersError) return failed('switch the other dates off', othersError)
    }

    const { error: saveError } = existing
      ? await supabase
          .from('delivery_settings')
          .update({ is_live: turningOn })
          .eq('delivery_date', deliveryDate)
      : await supabase
          .from('delivery_settings')
          .insert({
            delivery_date: deliveryDate,
            order_open_datetime: new Date().toISOString(),
            order_close_datetime: new Date(orderCloseLocal).toISOString(),
            is_live: true
          })
    if (saveError) {
      failed(turningOn ? 'go live' : 'take ordering offline', saveError, turningOn ? 'The other dates were switched off, so nothing is live right now.' : 'Ordering is still open.')
    }

    await fetchOrderClose(deliveryDate)
  }

  // The function only emails the first time an order is delivered, so re-marking is safe.
  // resend: true sends it again on purpose (the Resend Reheat Email button).
  const sendReheatEmail = async (orderId, { resend = false } = {}) => {
    const failed = resend ? 'The reheat email failed: ' : 'Marked delivered, but the reheat email failed: '
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'reheat_link', order_id: orderId, resend })
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        alert(failed + (error || res.status))
      } else if (resend) {
        alert('✓ Reheat email sent')
      }
    } catch (err) {
      alert(failed + err.message)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('Orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const fetchPendingCustomers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    // Waiting for approval always on top, then approved, then rejected; newest first within each
    const rank = { pending: 0, approved: 1, rejected: 2 }
    setPendingCustomers((data || []).slice().sort((a, b) => (rank[a.approval_status] ?? 0) - (rank[b.approval_status] ?? 0)))
    setLoading(false)
  }

  // Request-to-join answers, in the order the form asks them
  const ANSWER_FIELDS = [
    ['Household', 'household_composition'],
    ['Delivery address', 'delivery_address'],
    ['Delivery option', 'delivery_option'],
    ['Phone', 'delivery_phone'],
    ['Delivery time preferences', 'delivery_time_slots'],
    ['Special delivery instructions', 'delivery_instructions'],
    ['Payment method', 'payment_method'],
    ['Allergies', 'allergies'],
    ['Health restrictions', 'health_restrictions'],
    ['Preference restrictions', 'preference_restrictions'],
    ['Favorite proteins', 'protein_preferences'],
    ['Cuisines enjoyed', 'cuisines_enjoyed'],
    ['Flavor tolerance', 'flavor_tolerance'],
    ['Kids eating', 'kids_eating'],
    ['Kids quirks', 'kids_quirks'],
    ['Reheating preference', 'reheating_preference'],
    ['Anything else', 'anything_else']
  ]

  // Customers who joined before the opt-ins have a value from the old default, not a
  // real choice, until they answer the one-time prompt (notification_prefs_set_at)
  const optInLabel = (customer, field) => {
    if ('notification_prefs_set_at' in customer && !customer.notification_prefs_set_at) return 'Not chosen yet'
    return customer[field] === true ? 'Yes' : 'No'
  }

  const handleApprove = async (userId) => {
    const { error } = await supabase
      .from('users')
      .update({ approval_status: 'approved' })
      .eq('id', userId)
    fetchPendingCustomers()
    if (error) {
      alert('Failed to approve: ' + error.message)
      return
    }
    // Best effort: the approval stands even if the welcome email fails
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'approved', user_id: userId })
      })
      if (!res.ok) {
        const { error: message } = await res.json().catch(() => ({}))
        alert('Approved, but the welcome email failed: ' + (message || res.status))
      }
    } catch (err) {
      alert('Approved, but the welcome email failed: ' + err.message)
    }
  }

  const handleReject = async (userId) => {
    await supabase
      .from('users')
      .update({ approval_status: 'rejected' })
      .eq('id', userId)
    fetchPendingCustomers()
  }

  // The kitchen works from this file, so cancelled orders stay out unless asked for
  const exportToCSV = (rows) => {
    const csv = [
      ['Order ID', 'Customer', 'Email', 'Item Type', 'Item Name', 'Quantity', 'Delivery Date', 'Delivery Windows', 'Total Price', 'Status']
    ]
    
    rows.filter(order => includeCancelledInExport || order.status !== 'cancelled').forEach(order => {
      csv.push([
        order.order_id,
        order.customer_name,
        order.email,
        order.item_type,
        order.item_name,
        order.quantity,
        order.delivery_date,
        formatWindows(order.delivery_time_slot),
        order.total_order_price,
        order.status
      ])
    })

    // Quote every field so commas, quotes and line breaks in names/notes don't shift columns
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csvContent = csv.map(row => row.map(cell).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // One entry per order (Orders has a row per item), newest first
  const groupedOrders = Object.values(orders.reduce((acc, row) => {
    acc[row.order_id] ??= {
      order_id: row.order_id,
      customer_name: row.customer_name,
      email: row.email,
      delivery_date: row.delivery_date,
      delivery_time_slot: row.delivery_time_slot,
      status: row.status,
      rows: []
    }
    acc[row.order_id].rows.push(row)
    return acc
  }, {}))

  const orderDeliveryDates = [...new Set(groupedOrders.map(o => o.delivery_date).filter(Boolean))].sort().reverse()

  const matchesStatusFilter = (status) => {
    if (orderStatusFilter === 'all') return true
    if (orderStatusFilter === 'active') return status === 'pending' || status === 'confirmed'
    return status === orderStatusFilter
  }

  const searchTerm = orderSearch.trim().toLowerCase()
  const visibleOrders = groupedOrders.filter(order =>
    matchesStatusFilter(order.status) &&
    (orderDateFilter === 'all' || order.delivery_date === orderDateFilter) &&
    (!searchTerm || [order.customer_name, order.email, order.order_id, ...order.rows.map(r => r.item_name)]
      .some(value => String(value || '').toLowerCase().includes(searchTerm)))
  )

  const filtersActive = orderSearch || orderDateFilter !== 'all' || orderStatusFilter !== 'all'

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', width: '55%', height: 'auto' }} />
          <button 
            onClick={onLogout} 
            style={{ padding: '10px 16px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Logout
          </button>
        </div>

        <nav className="admin-tabs">
          {[
            ['approvals', 'Approvals'],
            ['menu', 'Menu'],
            ['orders', 'Orders'],
            ['notifications', 'Notifications'],
            ['documents', 'Documents']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScreen(key)}
              className={`admin-tab${screen === key ? ' is-active' : ''}`}
            >
              {label}
              {key === 'approvals' && waitingCount > 0 && (
                <span style={{ marginLeft: '8px', background: '#c62828', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '700' }}>{waitingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {screen === 'approvals' && (
          <div>
            <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Pending Approvals</h2>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {pendingCustomers.length === 0 ? (
                  <p style={{ color: '#666' }}>No customers to manage</p>
                ) : (
                  pendingCustomers.map(customer => (
                    <div key={customer.id} className="admin-card">
                      <div className="admin-card-row">
                        <div className="admin-card-text">
                          <p style={{ fontWeight: '600', margin: '0 0 8px 0', color: '#1a441f' }}>
                            {customer.name || 'Name not provided'}
                            <button
                              onClick={() => setEditingCustomer(customer)}
                              title="Edit customer details"
                              style={{ marginLeft: '10px', padding: '2px 8px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit', verticalAlign: 'middle' }}
                            >
                              Edit
                            </button>
                          </p>
                          <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>{customer.email}</p>
                          <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>Status: <strong>{customer.approval_status}</strong>{customer.delivery_option ? <> &middot; {deliveryOptionLabel(customer.delivery_option)}</> : null}</p>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 0 0', fontSize: '12px', color: '#1a441f', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={customer.messenger_delivery === true}
                              onChange={async (e) => {
                                const checked = e.target.checked
                                // Flip it on screen right away; the refetch below settles it
                                setPendingCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, messenger_delivery: checked } : c))
                                const { error } = await supabase.from('users').update({ messenger_delivery: checked }).eq('id', customer.id)
                                if (error) alert('Failed to save: ' + error.message + (/messenger_delivery/.test(error.message) ? '\n\nRun supabase/migrations/20261020_messenger_delivery.sql in the Supabase SQL editor first.' : ''))
                                else fetchPendingCustomers()
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            Messenger delivery (outside walking range, fee passed through per order)
                          </label>
                          {customer.messenger_delivery === true && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0 0 24px', fontSize: '12px', color: '#1a441f' }}>
                              Messenger fee $
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                defaultValue={Number(customer.messenger_fee) || MESSENGER_FEE}
                                onBlur={async (e) => {
                                  const fee = Number(e.target.value)
                                  if (!Number.isFinite(fee) || fee < 0 || fee === Number(customer.messenger_fee)) return
                                  const { error } = await supabase.from('users').update({ messenger_fee: fee }).eq('id', customer.id)
                                  if (error) alert('Failed to save fee: ' + error.message)
                                  else fetchPendingCustomers()
                                }}
                                style={{ width: '70px', padding: '4px 6px', border: '1px solid #e0dbd1', fontFamily: 'inherit', fontSize: '12px' }}
                              />
                            </label>
                          )}
                          {customer.resubmitted_at && (
                            <p style={{ margin: '8px 0 0 0', display: 'inline-block', padding: '3px 8px', background: '#faf8f3', border: '1px solid #D4A373', color: '#1a441f', fontSize: '12px', fontWeight: '600' }}>
                              Resubmitted {new Date(customer.resubmitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="admin-card-actions">
                          <button
                            onClick={() => setExpandedAnswers(prev => ({ ...prev, [customer.id]: !prev[customer.id] }))}
                            aria-expanded={!!expandedAnswers[customer.id]}
                            className="admin-button-outline"
                          >
                            {expandedAnswers[customer.id] ? 'Hide answers' : 'View answers'}
                          </button>
                          {customer.approval_status !== 'approved' && (
                            <button 
                              onClick={() => handleApprove(customer.id)} 
                              style={{ background: '#1a441f' }}
                            >
                              Approve
                            </button>
                          )}
                          {customer.approval_status !== 'rejected' && (
                            <button 
                              onClick={() => handleReject(customer.id)} 
                              style={{ background: '#D4A373' }}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedAnswers[customer.id] && (
                        <dl className="admin-answers">
                          {ANSWER_FIELDS.map(([label, field]) => (
                            <div key={field}>
                              <dt>{label}</dt>
                              <dd>{customer[field] ? String(customer[field]) : '—'}</dd>
                            </div>
                          ))}
                          <div>
                            <dt>Email updates</dt>
                            <dd>{optInLabel(customer, 'email_opt_in')}</dd>
                          </div>
                          <div>
                            <dt>Text updates</dt>
                            <dd>{optInLabel(customer, 'sms_opt_in')}{optInLabel(customer, 'sms_opt_in') === 'Yes' && customer.phone_number ? ` · ${formatUsPhone(customer.phone_number)}` : ''}</dd>
                          </div>
                        </dl>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {screen === 'menu' && (
          <div>
            <h2 style={{ color: '#1a441f', marginBottom: '6px' }}>This Week</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#666' }}>Edit the menu in the sheet, then work down this page.</p>
            
            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Step 1 · Check the sheet</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', marginBottom: '6px' }}>
                <h3 style={{ color: '#1a441f', margin: 0 }}>This Week's Menu</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <a href={MENU_SHEET_EDIT_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#1a441f', fontWeight: '600' }}>Open the menu sheet ↗</a>
                  <button onClick={loadSheetMenu} style={{ padding: '6px 12px', background: 'none', border: '1px solid #e0dbd1', color: '#1a441f', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Refresh</button>
                </div>
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
                Exactly what customers see: every row in the sheet with visible set to TRUE. Edit the sheet, then refresh here to check it.
              </p>
              {sheetError && <p style={{ color: '#c62828', fontSize: '13px', margin: 0 }}>{sheetError}</p>}
              {!sheetError && !sheetMenu && <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Loading the sheet...</p>}
              {sheetMenu && sheetMenu.weeks.length > 1 && (
                <p style={{ margin: '0 0 14px 0', padding: '12px 14px', background: '#fdf3f2', border: '1px solid #e8b4ae', color: '#c62828', fontSize: '13px', lineHeight: 1.6 }}>
                  <strong>Rows from weeks {sheetMenu.weeks.join(' and ')} are all visible.</strong> Customers would see both menus. In the sheet, set last week's rows to FALSE, then refresh.
                </p>
              )}
              {sheetMenu && sheetMenu.weeks.length === 1 && (
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#1a441f' }}>Showing week {sheetMenu.weeks[0]}{sheetMenu.weekOf ? `, week of ${sheetMenu.weekOf}` : ''}.</p>
              )}
              {sheetMenu && sheetMenu.sections.filter(sec => sec.items.length).length === 0 && (
                <p style={{ color: '#c62828', fontSize: '13px', margin: 0 }}>Nothing is visible in the sheet right now, so customers see "Menu coming soon".</p>
              )}
              {sheetMenu && sheetMenu.intro.map((text, i) => (
                <p key={i} style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#555', lineHeight: 1.6, fontStyle: 'italic' }}>{text}</p>
              ))}
              {sheetMenu && sheetMenu.intro.length === 0 && sheetMenu.sections.some(sec => sec.items.length) && (
                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#c62828' }}>No intro text this week. Add an "intro" row to the sheet if you want the welcome paragraph.</p>
              )}
              {sheetMenu && sheetMenu.sections.filter(sec => sec.items.length).map(sec => (
                <div key={sec.title} style={{ marginBottom: '14px' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>{sec.title}{sec.note ? ` · ${sec.note}` : ''}</p>
                  {sec.items.map(item => (
                    <div key={item.id} style={{ margin: '0 0 10px 0' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                        <strong style={{ color: '#1a441f' }}>{item.name}</strong>
                        {item.sides ? <span style={{ color: '#999' }}> · {item.sides}</span> : null}
                        {sec.type === 'addon' && Number.isFinite(item.price) ? <span style={{ color: '#999' }}> · ${(item.price / 100).toFixed(2)}</span> : null}
                        {item.note ? <span style={{ color: '#999' }}> · {item.note}</span> : null}
                      </p>
                      {item.description
                        ? <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{item.description}</p>
                        : <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#c62828' }}>No description in the sheet</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Step 2 · Set the dates</p>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1a441f' }}>Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={handleDeliveryDateChange}
                style={{ padding: '8px 12px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px' }}
              />

              <label style={{ display: 'block', margin: '20px 0 10px', fontWeight: '600', color: '#1a441f' }}>Orders Close</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="datetime-local"
                  value={orderCloseLocal}
                  onChange={(e) => setOrderCloseLocal(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px', fontFamily: 'inherit' }}
                />
                <button
                  onClick={saveOrderClose}
                  style={{ padding: '8px 20px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  Save Close Time
                </button>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>Customers can't order after this time, even while the menu is live. Starts at 11:00 PM on the Thursday before delivery until you save a different time.</p>
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Step 3 · Ask a question</p>
              <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '12px' }}>Customer Survey Question</h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1a441f' }}>Question</label>
                <textarea
                  value={surveyQuestion}
                  onChange={(e) => setSurveyQuestion(e.target.value)}
                  placeholder="Ask customers something about this week's menu..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0dbd1', minHeight: '60px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="surveyActive"
                  checked={isSurveyActive}
                  onChange={(e) => setIsSurveyActive(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="surveyActive" style={{ fontSize: '13px', color: '#1a441f', fontWeight: '500', cursor: 'pointer' }}>
                  Active (show to customers)
                </label>
              </div>
              <button
                onClick={async () => {
                  if (!surveyQuestion.trim()) {
                    alert('Please enter a survey question')
                    return
                  }
                  const { error } = await supabase.from('surveys').upsert({
                    delivery_date: deliveryDate,
                    question: surveyQuestion,
                    is_active: isSurveyActive
                  }, { onConflict: 'delivery_date' })
                  if (error) {
                    alert('Error saving survey: ' + error.message)
                  } else {
                    alert('✓ Survey question saved!')
                  }
                }}
                style={{ width: '100%', padding: '10px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Save Survey Question
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Step 4 · Go live</p>
              <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '8px' }}>Ordering</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
                {menuLive
                  ? <>Ordering is <strong style={{ color: '#1a441f' }}>open</strong> for delivery on {deliveryDate}. Customers see the sheet menu above.</>
                  : <>Ordering is <strong style={{ color: '#1a441f' }}>closed</strong> for {deliveryDate}. Check the sheet above and the close time, then go live.</>}
              </p>
              <button
                onClick={() => {
                  const warn = !menuLive && sheetMenu?.weeks.length > 1 ? `Weeks ${sheetMenu.weeks.join(' and ')} are both visible in the sheet. Hide last week first?\n\nPress OK to go live anyway, or Cancel to fix the sheet.\n\n` : ''
                  if (window.confirm(warn + (menuLive ? 'Take ordering offline for ' + deliveryDate + '?' : 'Open ordering for delivery on ' + deliveryDate + '?'))) toggleMenuLive()
                }}
                style={{ padding: '12px 24px', background: menuLive ? '#D4A373' : '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}
              >
                {menuLive ? 'Take Offline' : 'Go Live'}
              </button>
            </div>


            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Step 5 · Tell customers</p>
              <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '8px' }}>Menu Email</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
                Tells every approved customer who opted in to menu emails that the menu is up, with the delivery date and close time, and sends them to the site
                {menuEmailRecipients != null && <> ({menuEmailRecipients} right now)</>}.
                {' '}{menuLive ? '' : 'Go live first, then send.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={sendMenuEmail}
                  disabled={!menuLive || sendingMenuEmail}
                  style={{ padding: '8px 20px', background: menuEmailSentAt ? '#D4A373' : '#1a441f', color: '#faf8f3', border: 'none', cursor: !menuLive || sendingMenuEmail ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'inherit', opacity: !menuLive || sendingMenuEmail ? 0.6 : 1 }}
                >
                  {sendingMenuEmail ? 'Sending...' : menuEmailSentAt ? 'Resend Menu Email' : 'Send Menu Email'}
                </button>
                {menuEmailSentAt && <span style={{ fontSize: '13px', color: '#1a441f' }}>✓ Sent {new Date(menuEmailSentAt).toLocaleString()}</span>}
              </div>
            </div>

          </div>
        )}

        {screen === 'orders' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <h2 style={{ color: '#1a441f' }}>Orders</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <button 
                  onClick={() => exportToCSV(visibleOrders.flatMap(o => o.rows))} 
                  style={{ padding: '10px 20px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
                >
                  Export to CSV
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeCancelledInExport} onChange={(e) => setIncludeCancelledInExport(e.target.checked)} />
                  Include cancelled orders in export
                </label>
              </div>
            </div>

            <div className="admin-filters">
              <div className="admin-filter admin-filter-search">
                <label htmlFor="orderSearch">Search</label>
                <input
                  id="orderSearch"
                  type="search"
                  className="admin-input"
                  placeholder="Name, email, order ID or dish"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
              <div className="admin-filter">
                <label htmlFor="orderDateFilter">Delivery date</label>
                <select id="orderDateFilter" className="admin-input" value={orderDateFilter} onChange={(e) => setOrderDateFilter(e.target.value)}>
                  <option value="all">All dates</option>
                  {orderDeliveryDates.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>
              <div className="admin-filter">
                <label htmlFor="orderStatusFilter">Status</label>
                <select id="orderStatusFilter" className="admin-input" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="active">Confirmed / pending</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '13px', color: '#666' }}>
              <span>
                Showing {visibleOrders.length} of {groupedOrders.length} orders
                {visibleOrders.some(o => o.status === 'cancelled') && !includeCancelledInExport ? ' · cancelled orders won\'t be exported' : ''}
              </span>
              {filtersActive && (
                <button
                  onClick={() => { setOrderSearch(''); setOrderDateFilter('all'); setOrderStatusFilter('all') }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#1a441f', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : visibleOrders.length === 0 ? (
              <p style={{ color: '#666', background: 'white', border: '1px solid #e0dbd1', padding: '20px' }}>
                {groupedOrders.length === 0 ? 'No orders yet.' : 'No orders match these filters.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-orders-table" style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0dbd1' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1a441f', fontWeight: '600' }}>Order ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1a441f', fontWeight: '600' }}>Customer</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1a441f', fontWeight: '600' }}>Items</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1a441f', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1a441f', fontWeight: '600' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map(order => (
                        <tr key={order.order_id} style={{ borderBottom: '1px solid #e0dbd1' }}>
                          <td data-label="Order ID" style={{ padding: '12px', fontSize: '14px' }}>{order.order_id}</td>
                          <td data-label="Customer" style={{ padding: '12px', fontSize: '14px' }}>
                            {order.customer_name}
                            {formatWindows(order.delivery_time_slot) && (
                              <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>{order.delivery_date} · {formatWindows(order.delivery_time_slot)}</div>
                            )}
                          </td>
                          <td data-label="Items" style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                            {order.rows.map((row, i) => (
                              <div key={i}>{row.quantity}x {row.item_name}</div>
                            ))}
                          </td>
                          <td data-label="Status" style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{ 
                              padding: '4px 8px', 
                              background: order.status === 'delivered' ? '#1a441f' : order.status === 'cancelled' ? '#ffebee' : '#D4A373',
                              color: order.status === 'cancelled' ? '#c62828' : '#faf8f3',
                              fontWeight: '600'
                            }}>
                              {order.status === 'delivered' ? '✓ Delivered' : order.status === 'cancelled' ? 'Cancelled' : order.status === 'pending' ? 'Pending' : order.status}
                            </span>
                          </td>
                          <td className="admin-order-actions" style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            {order.status === 'cancelled' ? (
                              <span style={{ fontSize: '12px', color: '#999' }}>Customer can reorder</span>
                            ) : order.status !== 'delivered' ? (
                              <button
                                onClick={async () => {
                                  await supabase.from('Orders').update({ status: 'delivered' }).eq('order_id', order.order_id)
                                  fetchOrders()
                                  sendReheatEmail(order.order_id)
                                }}
                                style={{ padding: '6px 12px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Mark Delivered
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    supabase.from('Orders').update({ status: 'pending' }).eq('order_id', order.order_id).then(() => {
                                      fetchOrders()
                                    })
                                  }}
                                  style={{ padding: '6px 12px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  Mark as Undelivered
                                </button>
                                <button
                                  onClick={() => {
                                    if (!window.confirm(`Send ${order.customer_name} the reheat guide email again?`)) return
                                    sendReheatEmail(order.order_id, { resend: true })
                                  }}
                                  style={{ padding: '6px 12px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  Resend Reheat Email
                                </button>
                              </>
                            )}
                            {(order.status === 'pending' || order.status === 'confirmed') && (
                              <button
                                onClick={() => {
                                  if (!window.confirm(`Cancel ${order.customer_name}'s order? They'll be able to place a new one for this delivery date.`)) return
                                  supabase.from('Orders').update({ status: 'cancelled' }).eq('order_id', order.order_id).then(() => {
                                    fetchOrders()
                                  })
                                }}
                                style={{ padding: '6px 12px', background: 'white', color: '#c62828', border: '1px solid #c62828', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Cancel Order
                              </button>
                            )}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {screen === 'notifications' && (
          <NotificationsDashboard />
        )}

        {screen === 'documents' && (
          <DocumentGenerationDashboard />
        )}

        {editingCustomer && (
          <CustomerEditModal
            customer={editingCustomer}
            fields={ANSWER_FIELDS}
            onClose={() => setEditingCustomer(null)}
            onSaved={() => { setEditingCustomer(null); fetchPendingCustomers() }}
          />
        )}
      </div>
    </div>
  )
}
