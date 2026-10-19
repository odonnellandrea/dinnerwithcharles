import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ReheatInstructions from './ReheatInstructions'
import NotificationSettings from './NotificationSettings'
import GuestHeader from './GuestHeader'
import StayInTouchPrompt from './StayInTouchPrompt'
import { TIME_SLOTS, serializeWindows, formatWindows } from '../lib/deliveryWindows'
import { priceOrder, BASE_PRICE, EXTRA_ENTREE_PRICE, EXTRA_SALAD_PRICE } from '../lib/pricing'
import { fetchSheetMenu } from '../lib/sheetMenu'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const INSTAGRAM_DM_URL = 'https://ig.me/m/dinnerwithcharles'

// delivery_date is a plain YYYY-MM-DD; parse as local so it doesn't shift a day in US timezones
const formatDeliveryDate = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// Customer-facing wording. Orders are stored as 'pending' (the RLS insert policy
// requires it), but to a customer a placed order is confirmed. Admin shows raw values.
const CUSTOMER_STATUS_LABELS = {
  pending: 'Confirmed',
  confirmed: 'Confirmed',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}
const customerStatusLabel = (status) => CUSTOMER_STATUS_LABELS[String(status || '').toLowerCase()] || 'Confirmed'

const formatCloseDatetime = (iso) => {
  if (!iso) return ''
  const dt = new Date(iso)
  const date = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date} at ${time}`
}

export default function GuestApp({ user, onLogout }) {
  const [screen, setScreen] = useState('menu')
  const [menuItems, setMenuItems] = useState([])
  const [selectedEntrees, setSelectedEntrees] = useState({})
  const [selectedSalads, setSelectedSalads] = useState({})
  const [selectedAddOns, setSelectedAddOns] = useState({})
  const [deliveryDate, setDeliveryDate] = useState(null)
  const [orderCloseDatetime, setOrderCloseDatetime] = useState(null)
  const [noLiveMenu, setNoLiveMenu] = useState(false)
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState([])
  const [specialNotes, setSpecialNotes] = useState('')
  const [survey, setSurvey] = useState(null)
  const [surveyResponse, setSurveyResponse] = useState('')
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderHistory, setOrderHistory] = useState([])
  const [reheatDate, setReheatDate] = useState(null)
  // One-time opt-in ask for customers who joined before the choices existed
  const [prefsPrompt, setPrefsPrompt] = useState(null) // null | { phone, smsOptIn }

  useEffect(() => {
    fetchLiveMenu()
    fetchOrderHistory()
    checkNotificationPrefs()

    // Deep link from the delivered email: /?reheat=YYYY-MM-DD
    const reheat = new URLSearchParams(window.location.search).get('reheat')
    if (/^\d{4}-\d{2}-\d{2}$/.test(reheat || '')) {
      setReheatDate(reheat)
      setScreen('reheat')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (deliveryDate) {
      fetchSurvey(deliveryDate)
    }
  }, [deliveryDate])

  const fetchLiveMenu = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: deliverySettings } = await supabase
        .from('delivery_settings')
        .select('delivery_date, order_close_datetime')
        .eq('is_live', true)
        .single()

      if (!deliverySettings) {
        setNoLiveMenu(true)
        setLoading(false)
        return
      }

      const liveDate = deliverySettings.delivery_date
      setDeliveryDate(liveDate)
      setOrderCloseDatetime(deliverySettings.order_close_datetime)

      // The menu itself comes from the Google Sheet
      setMenuItems(await fetchSheetMenu())
    } catch (err) {
      setError("We couldn't load this week's menu. Please refresh the page.")
      console.error('Failed to load menu:', err)
    } finally {
      setLoading(false)
    }
  }

  // Ask once if they've never been asked. If the column doesn't exist yet
  // (migration not run) the query errors and we simply don't ask.
  const checkNotificationPrefs = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('notification_prefs_set_at, sms_opt_in, phone_number, delivery_phone')
      .eq('id', user.id)
      .single()
    if (!error && data && !data.notification_prefs_set_at) {
      setPrefsPrompt({ phone: data.phone_number || data.delivery_phone || '', smsOptIn: data.sms_opt_in === true })
    }
  }

  const fetchSurvey = async (date) => {
    try {
      const { data } = await supabase
        .from('surveys')
        .select('*')
        .eq('delivery_date', date)
        .eq('is_active', true)
        .single()
      if (data) setSurvey(data)
    } catch (err) {
      setSurvey(null)
    }
  }

  const fetchOrderHistory = async () => {
    if (!user?.id) return
    
    try {
      const { data } = await supabase
        .from('Orders')
        .select('*')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
      
      if (data) {
        const grouped = {}
        data.forEach(row => {
          if (!grouped[row.order_id]) {
            grouped[row.order_id] = { order_id: row.order_id, delivery_date: row.delivery_date, delivery_time_slot: row.delivery_time_slot, status: row.status, items: [] }
          }
          grouped[row.order_id].items.push(row)
        })
        setOrderHistory(Object.values(grouped))
      }
    } catch (err) {
      console.error('Failed to load order history:', err)
    }
  }

  const handleAddToCart = (itemId, itemType) => {
    if (itemType === 'entree') {
      const count = selectedEntrees[itemId] || 0
      setSelectedEntrees({ ...selectedEntrees, [itemId]: count + 1 })
    } else if (itemType === 'salad') {
      const count = selectedSalads[itemId] || 0
      setSelectedSalads({ ...selectedSalads, [itemId]: count + 1 })
    } else {
      const count = selectedAddOns[itemId] || 0
      setSelectedAddOns({ ...selectedAddOns, [itemId]: count + 1 })
    }
  }

  const handleRemoveFromCart = (itemId, itemType) => {
    if (itemType === 'entree') {
      const updated = { ...selectedEntrees }
      if (updated[itemId] > 1) {
        updated[itemId]--
      } else {
        delete updated[itemId]
      }
      setSelectedEntrees(updated)
    } else if (itemType === 'salad') {
      const updated = { ...selectedSalads }
      if (updated[itemId] > 1) {
        updated[itemId]--
      } else {
        delete updated[itemId]
      }
      setSelectedSalads(updated)
    } else {
      const updated = { ...selectedAddOns }
      if (updated[itemId] > 1) {
        updated[itemId]--
      } else {
        delete updated[itemId]
      }
      setSelectedAddOns(updated)
    }
  }

  const handleCheckout = () => {
    if (Object.keys(selectedEntrees).length === 0 || Object.keys(selectedSalads).length === 0) {
      alert('Please select items before reviewing')
      return
    }
    if (deliveryTimeSlot.length === 0) {
      alert('Please select at least one delivery window')
      return
    }
    setScreen('review')
  }

  // Best effort: a failed email shouldn't stop the order from going through
  const sendConfirmationEmail = async (orderId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'order_confirmation', order_id: orderId })
      })
      if (!res.ok) console.error('Confirmation email failed:', await res.text())
    } catch (err) {
      console.error('Confirmation email failed:', err)
    }
  }

  const handleConfirmOrder = async () => {
    try {
      const { data: existing } = await supabase
        .from('Orders')
        .select('order_id')
        .eq('email', user.email)
        .eq('delivery_date', deliveryDate)
        .neq('status', 'cancelled')
        .limit(1)
      if (orderCloseDatetime && new Date() > new Date(orderCloseDatetime)) {
        alert('Sorry, ordering closed for this delivery date.')
        setScreen('menu')
        return
      }
      if (existing?.length > 0) {
        alert("You've already placed your order for this delivery date.")
        await fetchOrderHistory()
        setScreen('menu')
        return
      }

      const orderDate = new Date().toISOString()
      const orderId = `${user.email}-${Date.now()}`
      const orders = []

      Object.entries(selectedEntrees).forEach(([itemId, qty]) => {
        const item = menuItems.entrees.find(e => e.id === itemId)
        if (item) {
          orders.push({
            order_id: orderId,
            customer_name: user.name || user.email,
            email: user.email,
            item_type: 'entree',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            delivery_time_slot: serializeWindows(deliveryTimeSlot),
            special_notes: specialNotes,
            total_order_price: 0,
            status: 'pending',
            created_at: orderDate
          })
        }
      })

      Object.entries(selectedSalads).forEach(([itemId, qty]) => {
        const item = menuItems.salads.find(s => s.id === itemId)
        if (item) {
          orders.push({
            order_id: orderId,
            customer_name: user.name || user.email,
            email: user.email,
            item_type: 'salad',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            delivery_time_slot: serializeWindows(deliveryTimeSlot),
            special_notes: specialNotes,
            total_order_price: 0,
            status: 'pending',
            created_at: orderDate
          })
        }
      })

      Object.entries(selectedAddOns).forEach(([itemId, qty]) => {
        const item = menuItems.addOns.find(a => a.id === itemId)
        if (item) {
          orders.push({
            order_id: orderId,
            customer_name: user.name || user.email,
            email: user.email,
            item_type: 'addon',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            delivery_time_slot: serializeWindows(deliveryTimeSlot),
            special_notes: specialNotes,
            total_order_price: (item.price / 100).toFixed(2),
            status: 'pending',
            created_at: orderDate
          })
        }
      })

      const { error } = await supabase.from('Orders').insert(orders)

      if (error) {
        alert('Error confirming order: ' + error.message)
      } else {
        sendConfirmationEmail(orderId)
        alert('✓ Order confirmed!')
        setSelectedEntrees({})
        setSelectedSalads({})
        setSelectedAddOns({})
        setDeliveryTimeSlot([])
        setSpecialNotes('')
        setSurveyResponse('')
        await fetchOrderHistory()
        setScreen('history')
      }
    } catch (err) {
      alert('Error confirming order: ' + err.message)
    }
  }

  const handleSurveySubmit = async () => {
    if (!surveyResponse.trim() || !survey) return
    try {
      await supabase.from('survey_responses').insert({
        survey_id: survey.id,
        user_email: user.email,
        response: surveyResponse
      })
      setSurveySubmitted(true)
      setSurveyResponse('')
      setTimeout(() => setSurveySubmitted(false), 3000)
    } catch (err) {
      console.error('Error submitting survey:', err)
    }
  }

  const placedOrder = orderHistory.find(o => o.delivery_date === deliveryDate && o.status !== 'cancelled')

  const menuClosed = noLiveMenu || (orderCloseDatetime && new Date() > new Date(orderCloseDatetime))
  const menuEmpty = !menuItems.entrees?.length && !menuItems.salads?.length

  const deliveryBanner = (
    <div style={{ background: '#1a441f', color: '#faf8f3', padding: '24px 28px', marginBottom: '28px', display: 'flex', flexWrap: 'wrap', gap: '20px 48px' }}>
      <div>
        <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373' }}>Delivery</p>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{formatDeliveryDate(deliveryDate)}</p>
      </div>
      {orderCloseDatetime && (
        <div>
          <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373' }}>Orders close</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{formatCloseDatetime(orderCloseDatetime)}</p>
        </div>
      )}
    </div>
  )

  const page = (children, maxWidth = '900px') => (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
      <div style={{ maxWidth, margin: '0 auto' }}>
        <GuestHeader screen={screen} onNavigate={setScreen} onLogout={onLogout} />
        {children}
      </div>
    </div>
  )

  // Shown once, before the menu; it records itself as asked when it appears
  if (prefsPrompt && screen === 'menu') {
    return page(
      <StayInTouchPrompt
        user={user}
        initialPhone={prefsPrompt.phone}
        initialSmsOptIn={prefsPrompt.smsOptIn}
        onDone={() => setPrefsPrompt(null)}
      />
    )
  }

  if (screen === 'settings') {
    return page(<NotificationSettings user={user} onClose={() => setScreen('menu')} />)
  }

  if (screen === 'history') {
    return page(
        <>
          <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Order History</h2>
          {orderHistory.length === 0 ? (
            <p style={{ color: '#666' }}>No orders yet</p>
          ) : (
            orderHistory.map(order => (
              <div key={order.order_id} style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1', opacity: order.status === 'cancelled' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                  <h3 style={{ color: '#1a441f', margin: 0 }}>{formatDeliveryDate(order.delivery_date)}</h3>
                  <span style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: order.status === 'cancelled' ? '#c62828' : '#D4A373', fontWeight: '600' }}>{customerStatusLabel(order.status)}</span>
                </div>
                {order.items.map((item, idx) => (
                  <p key={idx} style={{ margin: '6px 0', color: '#666', fontSize: '14px' }}>
                    {item.quantity}x {item.item_name}
                  </p>
                ))}
                {formatWindows(order.delivery_time_slot) && (
                  <p style={{ margin: '12px 0 0 0', color: '#666', fontSize: '14px' }}><strong>Delivery windows:</strong> {formatWindows(order.delivery_time_slot)}</p>
                )}
                {order.status === 'delivered' && (
                  <button
                    onClick={() => { setReheatDate(order.delivery_date); setScreen('reheat') }}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    View Reheat Guide
                  </button>
                )}
              </div>
            ))
          )}
        </>
    )
  }

  if (screen === 'reheat') {
    return page(<ReheatInstructions user={user} deliveryDate={reheatDate} onClose={() => setScreen('history')} embedded />, '700px')
  }

  if (screen === 'review') {
    return page(
        <>
          <h1 style={{ color: '#1a441f', marginTop: '0' }}>Review Your Order</h1>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0dbd1', marginBottom: '20px' }}>
            <h3 style={{ color: '#1a441f', marginTop: '0' }}>Entrées</h3>
            {Object.entries(selectedEntrees).map(([itemId, qty]) => {
              const item = menuItems.entrees.find(e => e.id === itemId)
              return item ? (
                <p key={itemId} style={{ margin: '8px 0', color: '#666' }}>
                  {qty}x {item.name}
                </p>
              ) : null
            })}

            <h3 style={{ color: '#1a441f', marginTop: '16px' }}>Salads</h3>
            {Object.entries(selectedSalads).map(([itemId, qty]) => {
              const item = menuItems.salads.find(s => s.id === itemId)
              return item ? (
                <p key={itemId} style={{ margin: '8px 0', color: '#666' }}>
                  {qty}x {item.name}
                </p>
              ) : null
            })}

            {Object.keys(selectedAddOns).length > 0 && (
              <>
                <h3 style={{ color: '#1a441f', marginTop: '16px' }}>Add-ons</h3>
                {Object.entries(selectedAddOns).map(([itemId, qty]) => {
                  const item = menuItems.addOns.find(a => a.id === itemId)
                  return item ? (
                    <p key={itemId} style={{ margin: '8px 0', color: '#666' }}>
                      {qty}x {item.name} — ${((item.price / 100) * qty).toFixed(2)}
                    </p>
                  ) : null
                })}
              </>
            )}

            <p style={{ color: '#666', margin: '16px 0 8px 0' }}>
              <strong>Preferred Delivery Windows:</strong> {formatWindows(deliveryTimeSlot)}
            </p>
            {specialNotes && (
              <p style={{ color: '#666', margin: '8px 0' }}>
                <strong>Special Requests:</strong> {specialNotes}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setScreen('menu')}
              style={{ flex: 1, padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              Back
            </button>
            <button
              onClick={handleConfirmOrder}
              style={{ flex: 1, padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              Confirm Order
            </button>
          </div>
        </>,
      '700px'
    )
  }

  return page(
      <>
        {loading && <p>Loading menu...</p>}
        {error && <p style={{ color: '#c62828', padding: '12px', background: '#ffebee', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

        {!loading && !error && placedOrder && (
          <>
            {deliveryBanner}
            <div style={{ background: 'white', padding: '32px', border: '1px solid #e0dbd1', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Order placed</p>
              <h2 style={{ color: '#1a441f', margin: '0 0 16px 0' }}>You're all set for this week</h2>
              {placedOrder.items.map((item, idx) => (
                <p key={idx} style={{ margin: '6px 0', color: '#666', fontSize: '14px' }}>{item.quantity}x {item.item_name}</p>
              ))}
              <p style={{ margin: '16px 0 0 0', color: '#666', fontSize: '14px' }}><strong>Delivery windows:</strong> {formatWindows(placedOrder.delivery_time_slot)}</p>
              <p style={{ margin: '24px 0 0 0', color: '#999', fontSize: '13px', lineHeight: '1.6' }}>Orders are locked once placed. Need to make a change? Send us a message and we'll cancel it so you can reorder.</p>
            </div>
          </>
        )}

        {!loading && !error && !placedOrder && menuClosed && (
          <div style={{ background: 'white', padding: '56px 40px', border: '1px solid #e0dbd1', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Ordering closed</p>
            <h2 style={{ color: '#1a441f', margin: '0 0 16px 0', fontSize: '26px' }}>This week's menu is closed</h2>
            <p style={{ color: '#666', margin: '0 auto 32px', maxWidth: '460px', lineHeight: '1.7', fontSize: '15px' }}>
              {noLiveMenu
                ? "The next menu isn't up yet. Check back soon."
                : `Orders for ${formatDeliveryDate(deliveryDate)} closed ${formatCloseDatetime(orderCloseDatetime)}.`}
              {' '}Hoping to squeeze in an order for next week? Send us a message and we'll see what we can do.
            </p>
            <a
              href={INSTAGRAM_DM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '14px 28px', background: '#1a441f', color: '#faf8f3', textDecoration: 'none', fontSize: '14px', fontWeight: '600', letterSpacing: '0.04em' }}
            >
              Message @dinnerwithcharles on Instagram
            </a>
          </div>
        )}

        {!loading && !error && !placedOrder && !menuClosed && menuEmpty && (
          <div style={{ background: 'white', padding: '56px 40px', border: '1px solid #e0dbd1', textAlign: 'center' }}>
            <h2 style={{ color: '#1a441f', margin: 0, fontSize: '26px' }}>Menu coming soon.</h2>
          </div>
        )}

        {!loading && !error && !placedOrder && !menuClosed && !menuEmpty && (
          <>
            {deliveryBanner}

            {menuItems.intro?.map((text, idx) => (
              <p key={idx} style={{ color: '#444', fontSize: '15px', lineHeight: '1.7', margin: '0 0 20px 0', whiteSpace: 'pre-line' }}>{text}</p>
            ))}

            {/* Fallback guidance for a sheet without section rows */}
            {!menuItems.sections?.some(s => s.note) && (
              <p style={{ color: '#666', marginBottom: '20px' }}>Pick 3 entrées + 2 salads. Add-ons are optional.</p>
            )}

            {menuItems.sections?.map((section, sectionIdx) => {
              const selected = { entree: selectedEntrees, salad: selectedSalads, addon: selectedAddOns }[section.type] || {}
              return (
                <div key={sectionIdx} style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 16px', marginBottom: section.items.length > 0 ? '16px' : 0 }}>
                    <h2 style={{ color: '#1a441f', margin: 0 }}>{section.title}</h2>
                    {section.note && (
                      <span style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>{section.note}</span>
                    )}
                  </div>
                  {section.items.map(item => (
                    <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <p style={{ margin: '0', fontWeight: '600', color: '#1a441f' }}>
                          {item.name}{section.type === 'addon' && ` — $${(item.price / 100).toFixed(2)}`}
                        </p>
                        {item.sides && <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1a441f' }}>{item.sides}</p>}
                        {section.type === 'addon' && item.note && <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#D4A373', fontWeight: '600' }}>{item.note}</p>}
                        {item.description && <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selected[item.id] && (
                          <button
                            onClick={() => handleRemoveFromCart(item.id, section.type)}
                            style={{ padding: '4px 8px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            −
                          </button>
                        )}
                        {selected[item.id] && <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{selected[item.id]}</span>}
                        <button
                          onClick={() => handleAddToCart(item.id, section.type)}
                          style={{ padding: '4px 8px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: '0', marginBottom: '12px' }}>Select all delivery windows that work for your family *</h3>
              {TIME_SLOTS.map(slot => (
                <label key={slot} style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={deliveryTimeSlot.includes(slot)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDeliveryTimeSlot([...deliveryTimeSlot, slot])
                      } else {
                        setDeliveryTimeSlot(deliveryTimeSlot.filter(t => t !== slot))
                      }
                    }}
                    style={{ marginRight: '10px', cursor: 'pointer' }}
                  />
                  {slot}
                </label>
              ))}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: '0', marginBottom: '12px' }}>Special Requests</h3>
              <textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any special requests for the week?"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', minHeight: '80px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: '#faf8f3', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: '0', marginBottom: '16px' }}>Order Summary</h3>
              {(() => {
                const totalEntrees = Object.values(selectedEntrees).reduce((sum, q) => sum + q, 0)
                const totalSalads = Object.values(selectedSalads).reduce((sum, q) => sum + q, 0)
                const addOnsCost = menuItems.addOns?.filter(item => selectedAddOns[item.id]).reduce((sum, item) => sum + (item.price / 100) * selectedAddOns[item.id], 0) || 0
                const { extraEntrees, extraSalads, entreeUpcharge, saladUpcharge, total: grandTotal } = priceOrder({ entreeCount: totalEntrees, saladCount: totalSalads, addOnsCost })

                return (
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#666' }}>Base Package (3 entrées + 2 salads): ${BASE_PRICE.toFixed(2)}</p>
                    {entreeUpcharge > 0 && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Entrées ({extraEntrees}): ${entreeUpcharge.toFixed(2)} @ ${EXTRA_ENTREE_PRICE} each</p>
                    )}
                    {saladUpcharge > 0 && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Salads ({extraSalads}): ${saladUpcharge.toFixed(2)} @ ${EXTRA_SALAD_PRICE} each</p>
                    )}
                    {addOnsCost > 0 && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Add-ons: ${addOnsCost.toFixed(2)}</p>
                    )}
                    <div style={{ paddingTop: '8px', borderTop: '2px solid #D4A373' }}>
                      <p style={{ margin: '0', fontSize: '16px', fontWeight: '700', color: '#D4A373' }}>Total: ${grandTotal.toFixed(2)}</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            {survey?.question && (
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1a441f' }}>Quick Feedback</p>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>{survey.question}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={surveyResponse}
                    onChange={(e) => setSurveyResponse(e.target.value)}
                    placeholder="Your response..."
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0dbd1', fontSize: '13px' }}
                  />
                  <button
                    onClick={handleSurveySubmit}
                    disabled={!surveyResponse.trim()}
                    style={{ padding: '8px 16px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                  >
                    Send
                  </button>
                </div>
                {surveySubmitted && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#1a441f', fontWeight: '500' }}>✓ Thanks for your feedback!</p>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              style={{ width: '100%', padding: '16px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}
            >
              Review & Checkout
            </button>
          </>
        )}
      </>
  )
}
