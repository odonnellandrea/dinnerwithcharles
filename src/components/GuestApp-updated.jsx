import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const TIME_SLOTS = [
  '9:00 AM - 11:00 AM',
  '11:00 AM - 1:00 PM',
  '1:00 PM - 5:00 PM',
  '5:00 PM - 7:00 PM',
  '7:00 PM - 9:00 PM'
]

export default function GuestApp({ user, onLogout }) {
  const [screen, setScreen] = useState('menu')
  const [menuItems, setMenuItems] = useState([])
  const [selectedEntrees, setSelectedEntrees] = useState({})
  const [selectedSalads, setSelectedSalads] = useState({})
  const [selectedAddOns, setSelectedAddOns] = useState({})
  const [deliveryDate, setDeliveryDate] = useState(null)
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderHistory, setOrderHistory] = useState([])

  useEffect(() => {
    fetchLiveMenu()
    fetchOrderHistory()
  }, [])

  const fetchLiveMenu = async () => {
    setLoading(true)
    setError('')

    try {
      // Get live delivery date
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

      // Fetch weekly menu items
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

      // Fetch actual item details
      const { data: entrees } = await supabase
        .from('entrees')
        .select('*')
        .in('id', entreeIds)

      const { data: salads } = await supabase
        .from('salads')
        .select('*')
        .in('id', saladIds)

      const { data: addOns } = await supabase
        .from('add_ons')
        .select('*')
        .in('id', addOnIds)

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

  const fetchOrderHistory = async () => {
    const { data } = await supabase
      .from('Orders')
      .select('*')
      .eq('email', user.email)
      .order('created_at', { ascending: false })

    setOrderHistory(data || [])
  }

  const handleAddToCart = (id, type) => {
    if (type === 'entree') {
      setSelectedEntrees({
        ...selectedEntrees,
        [id]: (selectedEntrees[id] || 0) + 1
      })
    } else if (type === 'salad') {
      setSelectedSalads({
        ...selectedSalads,
        [id]: (selectedSalads[id] || 0) + 1
      })
    } else if (type === 'addon') {
      setSelectedAddOns({
        ...selectedAddOns,
        [id]: (selectedAddOns[id] || 0) + 1
      })
    }
  }

  const handleRemoveFromCart = (id, type) => {
    if (type === 'entree') {
      const updated = { ...selectedEntrees }
      if (updated[id] > 1) updated[id]--
      else delete updated[id]
      setSelectedEntrees(updated)
    } else if (type === 'salad') {
      const updated = { ...selectedSalads }
      if (updated[id] > 1) updated[id]--
      else delete updated[id]
      setSe lectedSalads(updated)
    } else if (type === 'addon') {
      const updated = { ...selectedAddOns }
      if (updated[id] > 1) updated[id]--
      else delete updated[id]
      setSelectedAddOns(updated)
    }
  }

  const handlePlaceOrder = async () => {
    if (!deliveryTimeSlot) {
      setError('Please select a delivery time slot')
      return
    }

    const allItems = [
      ...Object.entries(selectedEntrees).map(([id, qty]) => ({
        id,
        type: 'entree',
        qty,
        item: menuItems.entrees.find(e => e.id === id)
      })),
      ...Object.entries(selectedSalads).map(([id, qty]) => ({
        id,
        type: 'salad',
        qty,
        item: menuItems.salads.find(s => s.id === id)
      })),
      ...Object.entries(selectedAddOns).map(([id, qty]) => ({
        id,
        type: 'addon',
        qty,
        item: menuItems.addOns.find(a => a.id === id)
      }))
    ]

    if (allItems.length === 0) {
      setError('Please select at least one item')
      return
    }

    try {
      const orderId = `${user.email}-${deliveryDate}-${Date.now()}`

      for (const item of allItems) {
        const totalPrice = item.type === 'addon' ? (item.item.price * item.qty) : 0

        await supabase.from('Orders').insert({
          order_id: orderId,
          customer_name: user.name || user.email,
          email: user.email,
          item_type: item.type,
          item_name: item.item.name,
          quantity: item.qty,
          delivery_date: deliveryDate,
          total_order_price: totalPrice,
          status: 'pending',
          delivery_time_slot: deliveryTimeSlot,
          special_notes: specialNotes
        })
      }

      alert('Order placed successfully!')
      setSelectedEntrees({})
      setSelectedSalads({})
      setSelectedAddOns({})
      setDeliveryTimeSlot('')
      setSpecialNotes('')
      setScreen('menu')
      fetchOrderHistory()
    } catch (err) {
      setError(err.message || 'Failed to place order')
    }
  }

  const getDeliveryDateDisplay = () => {
    if (!deliveryDate) return ''
    const date = new Date(deliveryDate)
    const options = { weekday: 'long', month: 'short', day: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  // ===== MENU SCREEN =====
  if (screen === 'menu') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', paddingBottom: '100px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <img src="/Green Horizontal Logo.png" alt="Weekly Kitchen" style={{ maxWidth: '200px', height: 'auto' }} />
            <button
              onClick={onLogout}
              style={{ padding: '8px 16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
            >
              Logout
            </button>
          </div>

          {/* Delivery Week Banner */}
          {deliveryDate && (
            <div style={{
              background: '#1B5E4E',
              color: 'white',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', opacity: 0.9 }}>ORDERING FOR</p>
              <p style={{ margin: '0', fontSize: '20px', fontWeight: '600' }}>Delivery {getDeliveryDateDisplay()}</p>
            </div>
          )}

          {loading && <p>Loading menu...</p>}
          {error && <p style={{ color: '#c62828', padding: '12px', background: '#ffebee', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

          {!loading && !error && (
            <>
              {/* Entrées */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Entrées — Pick 3</h2>
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

              {/* Salads */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Salads — Pick 2</h2>
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

              {/* Add-ons */}
              {menuItems.addOns && menuItems.addOns.length > 0 && (
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                  <h2 style={{ color: '#1B5E4E', marginTop: '0' }}>Add-ons — Optional</h2>
                  {menuItems.addOns.map(item => (
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
              )}

              {/* Delivery Time Slots */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <h3 style={{ color: '#1B5E4E', marginTop: '0', marginBottom: '12px' }}>Select Delivery Time *</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {TIME_SLOTS.map(slot => (
                    <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#faf8f3', borderRadius: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="delivery-time"
                        value={slot}
                        checked={deliveryTimeSlot === slot}
                        onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                      />
                      <span style={{ fontSize: '14px' }}>{slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Special Notes */}
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
                <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Special Notes (Optional)</h3>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Let Chef Robert know of any special requests or notes..."
                  rows="4"
                  style={{ width: '100%', padding: '10px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }}
                />
              </div>

              {/* Review & Checkout */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setScreen('review')}
                  style={{ flex: 1, padding: '14px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                >
                  Review Order
                </button>
                <button
                  onClick={() => setScreen('history')}
                  style={{ flex: 1, padding: '14px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                >
                  Order History
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ===== REVIEW SCREEN =====
  if (screen === 'review') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('menu')}
            style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginBottom: '20px' }}
          >
            ← Back to Menu
          </button>

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Order Review</h2>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
            <p style={{ margin: '0 0 8px 0', color: '#666' }}><strong>Delivery:</strong> {getDeliveryDateDisplay()}</p>
            <p style={{ margin: '0 0 8px 0', color: '#666' }}><strong>Time:</strong> {deliveryTimeSlot}</p>
            {specialNotes && <p style={{ margin: '0', color: '#666' }}><strong>Notes:</strong> {specialNotes}</p>}
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
            <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Entrées</h3>
            {Object.entries(selectedEntrees).map(([id, qty]) => {
              const item = menuItems.entrees.find(e => e.id === id)
              return (
                <p key={id} style={{ margin: '8px 0', fontSize: '14px' }}>
                  {item?.name} × {qty}
                </p>
              )
            })}
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
            <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Salads</h3>
            {Object.entries(selectedSalads).map(([id, qty]) => {
              const item = menuItems.salads.find(s => s.id === id)
              return (
                <p key={id} style={{ margin: '8px 0', fontSize: '14px' }}>
                  {item?.name} × {qty}
                </p>
              )
            })}
          </div>

          {Object.keys(selectedAddOns).length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Add-ons</h3>
              {Object.entries(selectedAddOns).map(([id, qty]) => {
                const item = menuItems.addOns.find(a => a.id === id)
                return (
                  <p key={id} style={{ margin: '8px 0', fontSize: '14px' }}>
                    {item?.name} × {qty}
                  </p>
                )
              })}
            </div>
          )}

          <button
            onClick={handlePlaceOrder}
            style={{ width: '100%', padding: '16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}
          >
            Confirm & Place Order
          </button>
        </div>
      </div>
    )
  }

  // ===== ORDER HISTORY SCREEN =====
  if (screen === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <button
            onClick={() => setScreen('menu')}
            style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginBottom: '20px' }}
          >
            ← Back to Menu
          </button>

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Order History</h2>

          {orderHistory.length === 0 ? (
            <p style={{ color: '#666' }}>No orders yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {orderHistory.map((order, idx) => (
                <div key={idx} style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e0dbd1' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#1B5E4E' }}>{order.item_name} × {order.quantity}</p>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>
                    {new Date(order.delivery_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  {order.delivery_time_slot && <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>{order.delivery_time_slot}</p>}
                  <p style={{ margin: '0', fontSize: '12px', color: '#999' }}>Status: {order.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
}
