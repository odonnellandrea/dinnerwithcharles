import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ReheatInstructions from './ReheatInstructions'
import NotificationSettings from './NotificationSettings'
import PasswordForm from './PasswordForm'
import ProfileDetails from './ProfileDetails'
import GuestHeader from './GuestHeader'
import StayInTouchPrompt from './StayInTouchPrompt'
import { TIME_SLOTS, serializeWindows, formatWindows } from '../lib/deliveryWindows'
import { priceOrder, BASE_PRICE, EXTRA_ENTREE_PRICE, EXTRA_SALAD_PRICE, MESSENGER_FEE } from '../lib/pricing'
import { normalizeCode, formatCents } from '../lib/referral'
import { downloadPdf } from '../lib/downloadPdf'
import { fetchSheetMenu, getCachedSheetMenu } from '../lib/sheetMenu'

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
  const [surveyError, setSurveyError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderHistory, setOrderHistory] = useState([])
  const [reheatDate, setReheatDate] = useState(null)
  // One-time opt-in ask for customers who joined before the choices existed
  const [prefsPrompt, setPrefsPrompt] = useState(null) // null | { phone, smsOptIn }
  // From the users profile; the sign-in account itself carries no name
  const [profileName, setProfileName] = useState('')
  // Outside the walking range: orders come by Uber messenger and the fee is added
  const [messengerFee, setMessengerFee] = useState(0)
  // From the referral_codes migration: { newCents, creditCents } this customer could take off an order
  const [pendingDiscount, setPendingDiscount] = useState({ newCents: 0, creditCents: 0, hasCode: false })
  const [checkoutCode, setCheckoutCode] = useState('')
  const [checkoutCodeNote, setCheckoutCodeNote] = useState(null) // { ok, text }
  const [applyingCode, setApplyingCode] = useState(false)
  const [downloadingMenu, setDownloadingMenu] = useState(false)

  useEffect(() => {
    fetchLiveMenu()
    fetchOrderHistory()
    checkNotificationPrefs()
    fetchPendingDiscount()

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

  // Drop anything in the cart that isn't on the menu any more (the menu changed since the
  // copy we showed first), so the total never counts a dish the customer can't see
  const pruneSelections = (menu) => {
    const keep = (items) => (selected) => {
      const ids = new Set((items || []).map(item => item.id))
      const kept = Object.entries(selected).filter(([id]) => ids.has(id))
      return kept.length === Object.keys(selected).length ? selected : Object.fromEntries(kept)
    }
    setSelectedEntrees(keep(menu.entrees))
    setSelectedSalads(keep(menu.salads))
    setSelectedAddOns(keep(menu.addOns))
  }

  const fetchLiveMenu = async () => {
    setLoading(true)
    setError('')

    // Download the menu sheet now, alongside the live-date lookup, instead of after it.
    // The catch only stops a failure being reported twice when we leave early below.
    const freshMenu = fetchSheetMenu()
    freshMenu.catch(() => {})

    try {
      // Normally exactly one date is live. If more than one ever is, use the latest rather than failing.
      const { data: liveRows, error: liveError } = await supabase
        .from('delivery_settings')
        .select('delivery_date, order_close_datetime')
        .eq('is_live', true)
        .order('delivery_date', { ascending: false })
        .limit(1)
      if (liveError) throw liveError
      const deliverySettings = liveRows?.[0]

      if (!deliverySettings) {
        setNoLiveMenu(true)
        setLoading(false)
        return
      }

      const liveDate = deliverySettings.delivery_date
      setDeliveryDate(liveDate)
      setOrderCloseDatetime(deliverySettings.order_close_datetime)

      // The menu itself comes from the Google Sheet. Show the copy from the last visit straight
      // away if there is one, then swap in the fresh copy when it arrives.
      const cached = getCachedSheetMenu()
      if (cached) {
        setMenuItems(cached)
        setLoading(false)
      }
      try {
        const fresh = await freshMenu
        setMenuItems(fresh)
        if (cached) pruneSelections(fresh)
      } catch (err) {
        if (!cached) throw err
        console.error('Could not refresh the menu, showing the last copy:', err)
      }
    } catch (err) {
      setError("We couldn't load this week's menu. Please refresh the page.")
      console.error('Failed to load menu:', err)
    } finally {
      setLoading(false)
    }
  }

  // What a referral code or earned credit would take off. If the migration isn't run, no discount.
  const fetchPendingDiscount = async () => {
    const { data, error } = await supabase.rpc('my_pending_discount')
    if (error || !data) { setPendingDiscount({ newCents: 0, creditCents: 0, hasCode: true }); return }
    setPendingDiscount({ newCents: Number(data.new_customer_cents) || 0, creditCents: Number(data.credit_cents) || 0, hasCode: data.has_code === true })
  }

  // "Have a code?" at checkout, for someone who joined without one
  const applyCheckoutCode = async () => {
    const code = normalizeCode(checkoutCode)
    if (!code) return
    setApplyingCode(true)
    setCheckoutCodeNote(null)
    const { data, error } = await supabase.rpc('attach_referral_code', { c: code })
    setApplyingCode(false)
    if (error || !data) { setCheckoutCodeNote({ ok: false, text: "Sorry, we couldn't check that code. Please try again." }); return }
    if (data.ok) {
      setCheckoutCode('')
      setCheckoutCodeNote({ ok: true, text: data.discount_cents > 0 ? `✓ Code applied: ${formatCents(data.discount_cents)} off this order.` : '✓ Code applied.' })
      await fetchPendingDiscount()
      return
    }
    const reasons = {
      already_has_code: 'You already have a code on your account.',
      own_code: "That's your own code. Share it with a friend instead.",
      invalid: "We don't recognise that code, or it's no longer available."
    }
    setCheckoutCodeNote({ ok: false, text: reasons[data.reason] || "We couldn't use that code." })
  }

  // Ask once if they've never been asked. If the column doesn't exist yet
  // (migration not run) the query errors and we simply don't ask.
  const checkNotificationPrefs = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data?.name) setProfileName(data.name)
    setMessengerFee(data?.messenger_delivery === true ? (Number(data.messenger_fee) || MESSENGER_FEE) : 0)
    // Ask once about email/text updates. Needs the notification_prefs_set_at column
    // (20261013_notification_prefs_set_at.sql); without it the prompt could never be dismissed.
    if (!error && data && 'notification_prefs_set_at' in data && !data.notification_prefs_set_at) {
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
        // Newest delivery first; YYYY-MM-DD strings sort correctly as text
        setOrderHistory(Object.values(grouped).sort((a, b) => String(b.delivery_date || '').localeCompare(String(a.delivery_date || ''))))
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
            customer_name: profileName || user.email,
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
            customer_name: profileName || user.email,
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
            customer_name: profileName || user.email,
            email: user.email,
            item_type: 'addon',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            delivery_time_slot: serializeWindows(deliveryTimeSlot),
            special_notes: specialNotes,
            // price plus any jar deposit, so the emails and admin totals include it. A number; the old text value ("20.00") is refused by a whole-number column
            total_order_price: (item.price + (item.deposit || 0)) / 100,
            status: 'pending',
            created_at: orderDate
          })
        }
      })

      let { error } = await supabase.from('Orders').insert(orders)
      // While Orders.total_order_price is still a whole-number column, a price with cents
      // (like $12.50) is refused. Nothing was saved, so retry in whole dollars rather than
      // lose the order; 20261021_order_price_numeric.sql makes the column exact.
      if (error && /bigint/i.test(error.message || '')) {
        console.warn('Orders.total_order_price is a whole-number column; saving whole dollars:', error.message)
        ;({ error } = await supabase.from('Orders').insert(orders.map(o => ({ ...o, total_order_price: Math.round(Number(o.total_order_price)) }))))
      }

      if (error) {
        alert('Error confirming order: ' + error.message)
      } else {
        // Take the referral discount and credit off this order. The order stands either way; if
        // this fails (migration not run, or a hiccup) the admin can still adjust it by hand.
        const subtotalCents = Math.round(priceOrder({
          entreeCount: Object.values(selectedEntrees).reduce((sum, q) => sum + q, 0),
          saladCount: Object.values(selectedSalads).reduce((sum, q) => sum + q, 0),
          addOnsCost: menuItems.addOns.filter(a => selectedAddOns[a.id]).reduce((sum, a) => sum + ((a.price + (a.deposit || 0)) / 100) * selectedAddOns[a.id], 0)
        }).subtotal * 100)
        if (pendingDiscount.newCents + pendingDiscount.creditCents > 0) {
          const { error: redeemError } = await supabase.rpc('redeem_discounts', { oid: orderId, subtotal_cents: subtotalCents })
          if (redeemError) console.error('Could not apply the referral discount:', redeemError)
        }
        sendConfirmationEmail(orderId)
        alert('✓ Order confirmed!')
        setSelectedEntrees({})
        setSelectedSalads({})
        setSelectedAddOns({})
        setDeliveryTimeSlot([])
        setSpecialNotes('')
        setSurveyResponse('')
        await fetchOrderHistory()
        fetchPendingDiscount()
        setScreen('history')
      }
    } catch (err) {
      alert('Error confirming order: ' + err.message)
    }
  }

  const handleSurveySubmit = async () => {
    if (!surveyResponse.trim() || !survey) return
    setSurveyError('')
    try {
      // supabase-js returns failures instead of throwing them, so check, or a refused answer looks saved
      const { error } = await supabase.from('survey_responses').insert({
        survey_id: survey.id,
        user_email: user.email,
        response: surveyResponse
      })
      if (error) throw error
      setSurveySubmitted(true)
      setSurveyResponse('')
      setTimeout(() => setSurveySubmitted(false), 3000)
    } catch (err) {
      console.error('Error submitting survey:', err)
      setSurveyError("Sorry, we couldn't save your answer. Please try again.")
    }
  }

  // Once that delivery day has passed, the old menu (and an order for it) is old news:
  // point people at the next one, even if last week's menu was never taken offline
  const deliveryPassed = (() => {
    if (!deliveryDate) return false
    const [y, m, d] = String(deliveryDate).split('-').map(Number)
    return new Date() >= new Date(y, m - 1, d + 1)
  })()
  const betweenMenus = noLiveMenu || deliveryPassed
  const menuClosed = betweenMenus || (orderCloseDatetime && new Date() > new Date(orderCloseDatetime))
  // "You're all set" only for an order on a delivery that hasn't happened yet
  const placedOrder = betweenMenus ? undefined : orderHistory.find(o => o.delivery_date === deliveryDate && o.status !== 'cancelled')
  const menuEmpty = !menuItems.entrees?.length && !menuItems.salads?.length

  // Price lines and the total, shared by the order summary on the menu and the review screen
  const renderOrderTotals = () => {
    const totalEntrees = Object.values(selectedEntrees).reduce((sum, q) => sum + q, 0)
    const totalSalads = Object.values(selectedSalads).reduce((sum, q) => sum + q, 0)
    const chosenAddOns = menuItems.addOns?.filter(item => selectedAddOns[item.id]) || []
    const addOnsBase = chosenAddOns.reduce((sum, item) => sum + (item.price / 100) * selectedAddOns[item.id], 0)
    const depositCost = chosenAddOns.reduce((sum, item) => sum + ((item.deposit || 0) / 100) * selectedAddOns[item.id], 0)
    const foodOnly = priceOrder({ entreeCount: totalEntrees, saladCount: totalSalads, addOnsCost: addOnsBase + depositCost })
    // Code discount first, then credit, neither past what the food costs
    const codeOff = Math.min(pendingDiscount.newCents / 100, foodOnly.subtotal)
    const creditOff = Math.min(pendingDiscount.creditCents / 100, foodOnly.subtotal - codeOff)
    const { extraEntrees, extraSalads, entreeUpcharge, saladUpcharge, total: grandTotal } = priceOrder({ entreeCount: totalEntrees, saladCount: totalSalads, addOnsCost: addOnsBase + depositCost, messengerFee, discount: codeOff + creditOff })

    return (
      <div>
        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#666' }}>Base Package (3 entrées + 2 salads): ${BASE_PRICE.toFixed(2)}</p>
        {entreeUpcharge > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Entrées ({extraEntrees}): ${entreeUpcharge.toFixed(2)} @ ${EXTRA_ENTREE_PRICE} each</p>
        )}
        {saladUpcharge > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Salads ({extraSalads}): ${saladUpcharge.toFixed(2)} @ ${EXTRA_SALAD_PRICE} each</p>
        )}
        {addOnsBase > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Add-ons: ${addOnsBase.toFixed(2)}</p>
        )}
        {depositCost > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Jar deposit: ${depositCost.toFixed(2)}</p>
        )}
        {codeOff > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#1a441f' }}>Referral code: −${codeOff.toFixed(2)}</p>
        )}
        {creditOff > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#1a441f' }}>Credit: −${creditOff.toFixed(2)}</p>
        )}
        {messengerFee > 0 && (
          <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Messenger delivery (estimate, at cost): ${messengerFee.toFixed(2)}</p>
        )}
        <div style={{ paddingTop: '8px', borderTop: '2px solid #D4A373' }}>
          <p style={{ margin: '0', fontSize: '16px', fontWeight: '700', color: '#D4A373' }}>Total: ${grandTotal.toFixed(2)}</p>
        </div>
      </div>
    )
  }

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
    return page(
      <>
        <ProfileDetails user={user} onSaved={setProfileName} />
        <div style={{ marginTop: '20px' }}>
          <NotificationSettings user={user} onClose={() => setScreen('menu')} />
        </div>
        <div style={{ marginTop: '20px' }}>
          <PasswordForm title="Password" intro="Choose a new password for signing in." />
        </div>
      </>
    )
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
                      {qty}x {item.name} — ${(((item.price + (item.deposit || 0)) / 100) * qty).toFixed(2)}{item.deposit > 0 && ` (includes $${((item.deposit / 100) * qty).toFixed(2)} jar deposit)`}
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

          <div style={{ background: '#faf8f3', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
            <h3 style={{ color: '#1a441f', marginTop: '0', marginBottom: '16px' }}>Order Total</h3>
            {(!pendingDiscount.hasCode || checkoutCodeNote) && (
              <div style={{ margin: '0 0 16px' }}>
                {!pendingDiscount.hasCode && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={checkoutCode}
                      onChange={(e) => { setCheckoutCode(e.target.value); setCheckoutCodeNote(null) }}
                      placeholder="Have a code?"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid #e0dbd1', borderRadius: '6px', fontSize: '14px', textTransform: 'uppercase', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={applyCheckoutCode}
                      disabled={applyingCode || !normalizeCode(checkoutCode)}
                      style={{ padding: '10px 18px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: applyingCode ? 'wait' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: applyingCode || !normalizeCode(checkoutCode) ? 0.6 : 1 }}
                    >
                      {applyingCode ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                )}
                {checkoutCodeNote && (
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: checkoutCodeNote.ok ? '#1a441f' : '#c62828' }}>{checkoutCodeNote.text}</p>
                )}
              </div>
            )}
            {renderOrderTotals()}
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
            <p style={{ margin: '0 0 12px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>{betweenMenus ? 'Coming soon' : 'Ordering closed'}</p>
            <h2 style={{ color: '#1a441f', margin: '0 0 16px 0', fontSize: '26px' }}>{betweenMenus ? "Next week's menu is on its way" : "This week's menu is closed"}</h2>
            <p style={{ color: '#666', margin: '0 auto 32px', maxWidth: '460px', lineHeight: '1.7', fontSize: '15px' }}>
              {betweenMenus
                ? "We're putting the finishing touches on it. Stay tuned."
                : `Ordering for ${formatDeliveryDate(deliveryDate)} closed ${formatCloseDatetime(orderCloseDatetime)}. Need to squeeze one in? Message us and we'll see what we can do.`}
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

            <div style={{ textAlign: 'center', margin: '8px 0 28px 0' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#1a441f', fontFamily: "'Courier New', Courier, monospace" }}>Dinner with Charles</p>
              <h1 style={{ margin: 0, fontSize: '34px', fontWeight: '700', color: '#1a441f', fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>Weekly Kitchen</h1>
              <p style={{ margin: '6px 0 0 0', fontSize: '15px', fontStyle: 'italic', color: '#666', fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>cooked by Chef Robert, your private chef</p>
              <button
                onClick={async () => {
                  setDownloadingMenu(true)
                  try {
                    await downloadPdf('/.netlify/functions/menu-pdf', `Weekly Kitchen Menu - week of ${deliveryDate}.pdf`)
                  } catch (err) {
                    alert("Sorry, we couldn't build the menu PDF. Please try again in a moment.\n\n(" + err.message + ")")
                  }
                  setDownloadingMenu(false)
                }}
                disabled={downloadingMenu}
                style={{ marginTop: '14px', padding: '9px 16px', background: 'transparent', color: '#1a441f', border: '1px solid #1a441f', cursor: downloadingMenu ? 'wait' : 'pointer', fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em', fontFamily: 'inherit', opacity: downloadingMenu ? 0.6 : 1 }}
              >
                {downloadingMenu ? 'Preparing PDF…' : 'Download menu PDF'}
              </button>
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
                {surveyError && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#c62828' }}>{surveyError}</p>
                )}
                {surveySubmitted && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#1a441f', fontWeight: '500' }}>✓ Thanks for your feedback!</p>
                )}
              </div>
            )}

            {menuItems.intro?.map((text, idx) => (
              <p key={idx} style={{ color: '#444', fontSize: '15px', lineHeight: '1.7', margin: '0 auto 28px', maxWidth: '560px', textAlign: 'center', whiteSpace: 'pre-line' }}>{text}</p>
            ))}

            {/* Fallback guidance for a sheet without section rows */}
            {!menuItems.sections?.some(s => s.note) && (
              <p style={{ color: '#666', marginBottom: '20px' }}>Pick 3 entrées + 2 salads. Add-ons are optional.</p>
            )}

            {menuItems.sections?.map((section, sectionIdx) => {
              const selected = { entree: selectedEntrees, salad: selectedSalads, addon: selectedAddOns }[section.type] || {}
              return (
                <div key={sectionIdx} style={{ background: 'white', padding: '24px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingBottom: '10px', borderBottom: '2px solid #1a441f' }}>
                    <h2 style={{ color: '#1a441f', margin: 0, fontSize: '24px', fontWeight: '700', fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>{section.title}</h2>
                    {section.note && (
                      section.type === 'addon'
                        ? <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#666', fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>{section.note}</span>
                        : <span style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#faf8f3', background: '#1a441f', padding: '5px 10px', fontFamily: "'Courier New', Courier, monospace" }}>{section.note}</span>
                    )}
                  </div>
                  {section.items.map((item, itemIdx) => (
                    <div key={item.id} style={{ padding: '18px 0', borderTop: itemIdx === 0 ? 'none' : '1px dashed #d9d1bd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', minWidth: 0 }}>
                        {section.type !== 'addon' && (
                          <span style={{ flex: '0 0 auto', width: '30px', height: '30px', border: '1px solid #cfc6ad', color: '#8a8470', fontSize: '11px', fontFamily: "'Courier New', Courier, monospace", display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', marginTop: '1px' }}>
                            {String(itemIdx + 1).padStart(2, '0')}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0', fontSize: '18px', fontWeight: '700', fontStyle: 'italic', color: '#1a441f', lineHeight: 1.3, fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>
                            {item.name}{section.type === 'addon' && <span style={{ color: '#b8923f', fontStyle: 'normal', marginLeft: '10px' }}>${(item.price / 100).toFixed(0)}</span>}
                          </p>
                          {item.sides && <p style={{ margin: '5px 0 0 0', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a8470', fontFamily: "'Courier New', Courier, monospace" }}>{item.sides}</p>}
                          {section.type === 'addon' && item.note && <p style={{ margin: '5px 0 0 0', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b8923f', fontFamily: "'Courier New', Courier, monospace" }}>{item.note}</p>}
                          {item.description && <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.6, color: '#444' }}>{item.description}</p>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {selected[item.id] && (
                          <button
                            onClick={() => handleRemoveFromCart(item.id, section.type)}
                            style={{ width: '32px', height: '32px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
                          >
                            −
                          </button>
                        )}
                        {selected[item.id] && <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{selected[item.id]}</span>}
                        <button
                          onClick={() => handleAddToCart(item.id, section.type)}
                          style={{ width: '32px', height: '32px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
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
              {renderOrderTotals()}
            </div>

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
