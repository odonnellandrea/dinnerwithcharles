import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ReheatInstructions from './ReheatInstructions'
import NotificationSettings from './NotificationSettings'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const TIME_SLOTS = ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '1:00 PM - 5:00 PM', '5:00 PM - 7:00 PM', '7:00 PM - 9:00 PM']

export default function GuestApp({ user, onLogout }) {
  const [screen, setScreen] = useState('menu')
  const [menuItems, setMenuItems] = useState([])
  const [selectedEntrees, setSelectedEntrees] = useState({})
  const [selectedSalads, setSelectedSalads] = useState({})
  const [selectedAddOns, setSelectedAddOns] = useState({})
  const [deliveryDate, setDeliveryDate] = useState(null)
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState([])
  const [specialNotes, setSpecialNotes] = useState('')
  const [survey, setSurvey] = useState(null)
  const [surveyResponse, setSurveyResponse] = useState('')
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderHistory, setOrderHistory] = useState({})

  useEffect(() => {
    fetchLiveMenu()
    fetchOrderHistory()
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
        .select('delivery_date')
        .eq('is_live', true)
        .single()

      if (!deliverySettings) {
        setError('No menu currently available. Check back soon!')
        setLoading(false)
        return
      }

      const liveDate = deliverySettings.delivery_date
      setDeliveryDate(liveDate)

      const { data: weeklyMenu } = await supabase
        .from('weekly_menu')
        .select('item_id, item_type')
        .eq('delivery_date', liveDate)

      if (!weeklyMenu || weeklyMenu.length === 0) {
        setError('Menu not found for this week')
        setLoading(false)
        return
      }

      const entreeIds = weeklyMenu.filter(m => m.item_type === 'entree').map(m => m.item_id)
      const saladIds = weeklyMenu.filter(m => m.item_type === 'salad').map(m => m.item_id)
      const addOnIds = weeklyMenu.filter(m => m.item_type === 'addon').map(m => m.item_id)

      const { data: entrees } = await supabase.from('entrees').select('*').in('id', entreeIds)
      const { data: salads } = await supabase.from('salads').select('*').in('id', saladIds)
      const { data: addOns } = await supabase.from('add_ons').select('*').in('id', addOnIds)

      setMenuItems({
        entrees: entrees || [],
        salads: salads || [],
        addOns: addOns || []
      })
    } catch (err) {
      setError(err.message || 'Failed to load menu')
    } finally {
      setLoading(false)
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
        const groupedByDate = {}
        data.forEach(order => {
          if (!groupedByDate[order.delivery_date]) {
            groupedByDate[order.delivery_date] = []
          }
          groupedByDate[order.delivery_date].push(order)
        })
        setOrderHistory(groupedByDate)
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

  const handleConfirmOrder = async () => {
    try {
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
            delivery_time_slot: deliveryTimeSlot.join(', '),
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
            delivery_time_slot: deliveryTimeSlot.join(', '),
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
            delivery_time_slot: deliveryTimeSlot.join(', '),
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

  if (screen === 'settings') {
    return <NotificationSettings user={user} onClose={() => setScreen('menu')} />
  }

  if (screen === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setScreen('menu')} style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Order This Week
              </button>
              <button onClick={() => setScreen('settings')} style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Settings
              </button>
              <button onClick={onLogout} style={{ padding: '10px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                Logout
              </button>
            </div>
          </div>

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Order History</h2>
          {Object.keys(orderHistory).length === 0 ? (
            <p style={{ color: '#666' }}>No orders yet</p>
          ) : (
            Object.entries(orderHistory).map(([date, orders]) => (
              <div key={date} style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <h3 style={{ color: '#1B5E4E', margin: '0 0 12px 0' }}>{date}</h3>
                {orders.map((order, idx) => (
                  <p key={idx} style={{ margin: '6px 0', color: '#666', fontSize: '14px' }}>
                    {order.quantity}x {order.item_name}
                  </p>
                ))}
                {orders[0]?.status === 'delivered' && (
                  <button
                    onClick={() => setScreen('reheat')}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    View Reheat Guide
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  if (screen === 'reheat') {
    return <ReheatInstructions user={user} deliveryDate={Object.keys(orderHistory)[0]} onClose={() => setScreen('history')} />
  }

  if (screen === 'review') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{ color: '#1B5E4E', marginTop: '0' }}>Review Your Order</h1>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0dbd1', marginBottom: '20px' }}>
            <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Entrées</h3>
            {Object.entries(selectedEntrees).map(([itemId, qty]) => {
              const item = menuItems.entrees.find(e => e.id === itemId)
              return item ? (
                <p key={itemId} style={{ margin: '8px 0', color: '#666' }}>
                  {qty}x {item.name}
                </p>
              ) : null
            })}

            <h3 style={{ color: '#1B5E4E', marginTop: '16px' }}>Salads</h3>
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
                <h3 style={{ color: '#1B5E4E', marginTop: '16px' }}>Add-ons</h3>
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
              <strong>Preferred Delivery Windows:</strong> {Array.isArray(deliveryTimeSlot) ? deliveryTimeSlot.join(', ') : deliveryTimeSlot}
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
              style={{ flex: 1, padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              Back
            </button>
            <button
              onClick={handleConfirmOrder}
              style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              Confirm Order
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto' }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setScreen('history')} style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              Order History
            </button>
            <button onClick={() => setScreen('settings')} style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              Settings
            </button>
            <button onClick={onLogout} style={{ padding: '10px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
              Logout
            </button>
          </div>
        </div>

        {loading && <p>Loading menu...</p>}
        {error && <p style={{ color: '#c62828', padding: '12px', background: '#ffebee', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

        {!loading && !error && (
          <>
            <p style={{ color: '#666', marginBottom: '20px' }}>Pick 3 entrées + 2 salads. Add-ons are optional.</p>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Entrées</h2>
              {menuItems.entrees?.map(item => (
                <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedEntrees[item.id] && (
                      <button
                        onClick={() => handleRemoveFromCart(item.id, 'entree')}
                        style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        −
                      </button>
                    )}
                    {selectedEntrees[item.id] && <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{selectedEntrees[item.id]}</span>}
                    <button
                      onClick={() => handleAddToCart(item.id, 'entree')}
                      style={{ padding: '4px 8px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Salads</h2>
              {menuItems.salads?.map(item => (
                <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedSalads[item.id] && (
                      <button
                        onClick={() => handleRemoveFromCart(item.id, 'salad')}
                        style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        −
                      </button>
                    )}
                    {selectedSalads[item.id] && <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{selectedSalads[item.id]}</span>}
                    <button
                      onClick={() => handleAddToCart(item.id, 'salad')}
                      style={{ padding: '4px 8px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Add-ons</h2>
              {menuItems.addOns?.map(item => (
                <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name} — ${(item.price / 100).toFixed(2)}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedAddOns[item.id] && (
                      <button
                        onClick={() => handleRemoveFromCart(item.id, 'addon')}
                        style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        −
                      </button>
                    )}
                    {selectedAddOns[item.id] && <span style={{ fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{selectedAddOns[item.id]}</span>}
                    <button
                      onClick={() => handleAddToCart(item.id, 'addon')}
                      style={{ padding: '4px 8px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: '0', marginBottom: '12px' }}>Select all delivery windows that work for your family *</h3>
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
              <h3 style={{ color: '#1B5E4E', marginTop: '0', marginBottom: '12px' }}>Special Requests</h3>
              <textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any special requests for the week?"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', minHeight: '80px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: '#f5f0e6', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: '0', marginBottom: '16px' }}>Order Summary</h3>
              {(() => {
                const totalEntrees = Object.values(selectedEntrees).reduce((sum, q) => sum + q, 0)
                const totalSalads = Object.values(selectedSalads).reduce((sum, q) => sum + q, 0)
                const addOnsCost = menuItems.addOns?.filter(item => selectedAddOns[item.id]).reduce((sum, item) => sum + (item.price / 100) * selectedAddOns[item.id], 0) || 0
                const entreeUpcharge = Math.max(0, totalEntrees - 3) * 40
                const saladUpcharge = Math.max(0, totalSalads - 2) * 15
                const grandTotal = 160 + entreeUpcharge + saladUpcharge + addOnsCost

                return (
                  <div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#666' }}>Base Package (3 entrées + 2 salads): $160.00</p>
                    {entreeUpcharge > 0 && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Entrées ({totalEntrees - 3}): ${entreeUpcharge.toFixed(2)} @ $40 each</p>
                    )}
                    {saladUpcharge > 0 && (
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>Extra Salads ({totalSalads - 2}): ${saladUpcharge.toFixed(2)} @ $15 each</p>
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
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1B5E4E' }}>Quick Feedback</p>
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
                    style={{ padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                  >
                    Send
                  </button>
                </div>
                {surveySubmitted && (
                  <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#2e7d32', fontWeight: '500' }}>✓ Thanks for your feedback!</p>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              style={{ width: '100%', padding: '16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}
            >
              Review & Checkout
            </button>
          </>
        )}
      </div>
    </div>
  )
}
