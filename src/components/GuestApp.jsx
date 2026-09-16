import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function GuestApp({ onLogout }) {
  const [screen, setScreen] = useState('menu')
  const [user, setUser] = useState(null)
  const [selections, setSelections] = useState({
    entrees: {},
    salads: {},
    addOns: {}
  })
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const [orderHistory, setOrderHistory] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [menu, setMenu] = useState({
    entrees: [],
    salads: [],
    otherAddOns: []
  })

  const BASE_PLAN_PRICE = 160

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchOrderHistory(user.email)
      }
    }
    getUser()
    fetchMenu()
  }, [])

  const fetchMenu = async () => {
    const [entreesData, saladsData, addOnsData] = await Promise.all([
      supabase.from('entrees').select('*'),
      supabase.from('salads').select('*'),
      supabase.from('add_ons').select('*')
    ])

    setMenu({
      entrees: entreesData.data || [],
      salads: saladsData.data || [],
      otherAddOns: addOnsData.data || []
    })
  }

  const fetchOrderHistory = async (email) => {
    const { data } = await supabase
      .from('Orders')
      .select('*')
      .eq('email', email)
      .order('delivery_date', { ascending: false })
    
    if (data) {
      const grouped = data.reduce((acc, item) => {
        const existing = acc.find(o => o.order_id === item.order_id)
        if (existing) {
          existing.items.push(item)
        } else {
          acc.push({ order_id: item.order_id, delivery_date: item.delivery_date, total_order_price: item.total_order_price, items: [item] })
        }
        return acc
      }, [])
      setOrderHistory(grouped)
    }
  }

  const updateQty = (type, id, qty) => {
    const newQty = Math.max(0, qty)
    setSelections(prev => ({
      ...prev,
      [type]: { ...prev[type], [id]: newQty }
    }))
  }

  const entreeCount = Object.values(selections.entrees).reduce((sum, q) => sum + q, 0)
  const saladCount = Object.values(selections.salads).reduce((sum, q) => sum + q, 0)

  const canReview = entreeCount >= 3 && saladCount >= 2

  const calculateExtras = () => {
    let total = 0
    const extraEntrees = Math.max(0, entreeCount - 3)
    const extraSalads = Math.max(0, saladCount - 2)
    total += extraEntrees * 40
    total += extraSalads * 15
    Object.entries(selections.addOns).forEach(([id, qty]) => {
      const item = menu.otherAddOns.find(a => a.id === id)
      if (item) total += item.price * qty
    })
    return parseFloat(total.toFixed(2))
  }

  const calculateTotal = () => {
    return (BASE_PLAN_PRICE + calculateExtras()).toFixed(2)
  }

  const generateOrderId = async () => {
    const today = new Date()
    const week = Math.ceil((today.getDate() - today.getDay() + 1) / 7)
    const weekNum = `WK${week}`
    
    const { data } = await supabase
      .from('Orders')
      .select('order_id')
      .like('order_id', `${weekNum}%`)
      .order('order_id', { ascending: false })
      .limit(1)
    
    let nextNum = 1
    if (data && data.length > 0) {
      const lastId = data[0].order_id
      const num = parseInt(lastId.split('-')[1])
      nextNum = num + 1
    }
    
    return `${weekNum}-${String(nextNum).padStart(3, '0')}`
  }

  const handleReview = () => {
    setScreen('review')
  }

  const handleSubmit = async () => {
    try {
      const orderId = await generateOrderId()
      const today = new Date()
      const deliveryDate = today.toISOString().split('T')[0]

      const orderItems = []

      Object.entries(selections.entrees).forEach(([id, qty]) => {
        if (qty > 0) {
          const item = menu.entrees.find(e => e.id === id)
          orderItems.push({
            order_id: orderId,
            customer_name: user?.email || 'Unknown',
            email: user?.email || '',
            item_type: 'entree',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            total_order_price: parseFloat(calculateTotal()),
            status: 'pending'
          })
        }
      })

      Object.entries(selections.salads).forEach(([id, qty]) => {
        if (qty > 0) {
          const item = menu.salads.find(s => s.id === id)
          orderItems.push({
            order_id: orderId,
            customer_name: user?.email || 'Unknown',
            email: user?.email || '',
            item_type: 'salad',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            total_order_price: parseFloat(calculateTotal()),
            status: 'pending'
          })
        }
      })

      Object.entries(selections.addOns).forEach(([id, qty]) => {
        if (qty > 0) {
          const item = menu.otherAddOns.find(a => a.id === id)
          orderItems.push({
            order_id: orderId,
            customer_name: user?.email || 'Unknown',
            email: user?.email || '',
            item_type: 'addon',
            item_name: item.name,
            quantity: qty,
            delivery_date: deliveryDate,
            total_order_price: parseFloat(calculateTotal()),
            status: 'pending'
          })
        }
      })

      const { error } = await supabase
        .from('Orders')
        .insert(orderItems)

      if (error) throw error

      setSubmittedOrder({
        orderId,
        items: orderItems,
        total: calculateTotal(),
        deliveryDate
      })
      setScreen('confirmation')
      fetchOrderHistory(user.email)
    } catch (err) {
      alert('Error submitting order: ' + err.message)
    }
  }

  const Header = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', position: 'relative' }}>
      <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto' }} />
      <div style={{ position: 'relative' }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '8px 12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ width: '24px', height: '2px', background: '#D4A373' }}></span>
          <span style={{ width: '24px', height: '2px', background: '#D4A373' }}></span>
          <span style={{ width: '24px', height: '2px', background: '#D4A373' }}></span>
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #e0dbd1', borderRadius: '6px', marginTop: '5px', zIndex: 1000, minWidth: '150px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            {screen !== 'menu' && (
              <button onClick={() => { setScreen('menu'); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #e0dbd1', color: '#1B5E4E', fontWeight: '500' }}>Back to Orders</button>
            )}
            {screen !== 'history' && (
              <button onClick={() => { setScreen('history'); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #e0dbd1', color: '#1B5E4E', fontWeight: '500' }}>Order History</button>
            )}
            <button onClick={() => { onLogout(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#1B5E4E', fontWeight: '500' }}>Logout</button>
          </div>
        )}
      </div>
    </div>
  )

  if (screen === 'menu') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Header />

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Entrees (Select 3 or more)</h2>
          <div style={{ marginBottom: '40px' }}>
            {menu.entrees.map(item => (
              <div key={item.id} style={{ marginBottom: '15px', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e0dbd1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{item.name}</p>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => updateQty('entrees', item.id, (selections.entrees[item.id] || 0) - 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>−</button>
                    <input type="number" min="0" value={selections.entrees[item.id] || 0} onChange={(e) => updateQty('entrees', item.id, parseInt(e.target.value) || 0)} style={{ width: '40px', textAlign: 'center', padding: '4px', border: '1px solid #e0dbd1', borderRadius: '4px' }} />
                    <button onClick={() => updateQty('entrees', item.id, (selections.entrees[item.id] || 0) + 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Salads (Select 2 or more)</h2>
          <div style={{ marginBottom: '40px' }}>
            {menu.salads.map(item => (
              <div key={item.id} style={{ marginBottom: '15px', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e0dbd1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{item.name}</p>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => updateQty('salads', item.id, (selections.salads[item.id] || 0) - 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>−</button>
                    <input type="number" min="0" value={selections.salads[item.id] || 0} onChange={(e) => updateQty('salads', item.id, parseInt(e.target.value) || 0)} style={{ width: '40px', textAlign: 'center', padding: '4px', border: '1px solid #e0dbd1', borderRadius: '4px' }} />
                    <button onClick={() => updateQty('salads', item.id, (selections.salads[item.id] || 0) + 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Other Add-Ons</h2>
          <div style={{ marginBottom: '40px' }}>
            {menu.otherAddOns.map(item => (
              <div key={item.id} style={{ marginBottom: '15px', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e0dbd1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{item.name} - ${item.price}</p>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>{item.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => updateQty('addOns', item.id, (selections.addOns[item.id] || 0) - 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>−</button>
                    <input type="number" min="0" value={selections.addOns[item.id] || 0} onChange={(e) => updateQty('addOns', item.id, parseInt(e.target.value) || 0)} style={{ width: '40px', textAlign: 'center', padding: '4px', border: '1px solid #e0dbd1', borderRadius: '4px' }} />
                    <button onClick={() => updateQty('addOns', item.id, (selections.addOns[item.id] || 0) + 1)} style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: '6px', border: '1px solid #e0dbd1', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Entrees: {entreeCount}/3 | Salads: {saladCount}/2</p>
            {entreeCount > 3 && <p style={{ fontSize: '12px', color: '#D4A373' }}>Plus ${(entreeCount - 3) * 40} for {entreeCount - 3} additional entree(s)</p>}
            {saladCount > 2 && <p style={{ fontSize: '12px', color: '#D4A373' }}>Plus ${(saladCount - 2) * 15} for {saladCount - 2} additional salad(s)</p>}
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#1B5E4E', margin: '10px 0 0 0' }}>Total: ${calculateTotal()}</p>
          </div>

          <button onClick={handleReview} disabled={!canReview} style={{ width: '100%', padding: '12px 32px', background: canReview ? '#1B5E4E' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: canReview ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}>Review Order</button>
        </div>
      </div>
    )
  }

  if (screen === 'review') {
    let extrasRemaining = Math.max(0, entreeCount - 3)
    const entreesWithCosts = Object.entries(selections.entrees)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => {
        let cost = 0
        if (extrasRemaining > 0) {
          const extrasThisItem = Math.min(qty, extrasRemaining)
          cost = extrasThisItem * 40
          extrasRemaining -= extrasThisItem
        }
        return { id, qty, cost }
      })

    let saladExtrasRemaining = Math.max(0, saladCount - 2)
    const saladsWithCosts = Object.entries(selections.salads)
      .filter(([id, qty]) => qty > 0)
      .map(([id, qty]) => {
        let cost = 0
        if (saladExtrasRemaining > 0) {
          const extrasThisItem = Math.min(qty, saladExtrasRemaining)
          cost = extrasThisItem * 15
          saladExtrasRemaining -= extrasThisItem
        }
        return { id, qty, cost }
      })

    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Header />
          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Review Your Order</h2>
          <div style={{ background: 'white', padding: '20px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Entrees</h3>
            {entreesWithCosts.map(({ id, qty, cost }) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>{menu.entrees.find(e => e.id === id).name} x {qty}</span>
                <span>{cost > 0 ? '+$' + cost : ''}</span>
              </div>
            ))}
            
            <h3>Salads</h3>
            {saladsWithCosts.map(({ id, qty, cost }) => (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>{menu.salads.find(s => s.id === id).name} x {qty}</span>
                <span>{cost > 0 ? '+$' + cost : ''}</span>
              </div>
            ))}
            
            <h3>Add-Ons</h3>
            {Object.entries(selections.addOns).map(([id, qty]) => qty > 0 && (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>{menu.otherAddOns.find(a => a.id === id).name} x {qty}</span>
                <span>+${(menu.otherAddOns.find(a => a.id === id).price * qty).toFixed(2)}</span>
              </div>
            ))}
            
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '16px', fontWeight: '600' }}>
              <span>Base Plan</span>
              <span>${BASE_PLAN_PRICE}.00</span>
            </div>
            
            {calculateExtras() > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '14px', color: '#D4A373' }}>
                <span>Additional Items</span>
                <span>+${calculateExtras().toFixed(2)}</span>
              </div>
            )}
            
            <hr />
            <h3 style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <span>Total:</span>
              <span>${calculateTotal()}</span>
            </h3>
          </div>
          <button onClick={handleSubmit} style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Submit Order</button>
        </div>
      </div>
    )
  }

  if (screen === 'confirmation') {
    let extrasRemaining = Math.max(0, entreeCount - 3)
    const entreesWithCosts = submittedOrder?.items
      .filter(item => item.item_type === 'entree')
      .map(item => {
        let cost = 0
        if (extrasRemaining > 0) {
          const extrasThisItem = Math.min(item.quantity, extrasRemaining)
          cost = extrasThisItem * 40
          extrasRemaining -= extrasThisItem
        }
        return { ...item, cost }
      })

    let saladExtrasRemaining = Math.max(0, saladCount - 2)
    const saladsWithCosts = submittedOrder?.items
      .filter(item => item.item_type === 'salad')
      .map(item => {
        let cost = 0
        if (saladExtrasRemaining > 0) {
          const extrasThisItem = Math.min(item.quantity, saladExtrasRemaining)
          cost = extrasThisItem * 15
          saladExtrasRemaining -= extrasThisItem
        }
        return { ...item, cost }
      })

    const addOns = submittedOrder?.items.filter(item => item.item_type === 'addon')

    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Header />
          
          <div style={{ background: 'white', padding: '30px', borderRadius: '6px', marginBottom: '20px' }}>
            <h2 style={{ color: '#1B5E4E', margin: '0 0 20px 0', textAlign: 'center' }}>Order Confirmed!</h2>
            
            <div style={{ background: '#faf8f3', padding: '15px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 5px 0' }}>Order Number</p>
              <p style={{ fontSize: '28px', fontWeight: '600', color: '#1B5E4E', margin: 0 }}>{submittedOrder?.orderId}</p>
            </div>

            <h3 style={{ color: '#1B5E4E', marginBottom: '15px' }}>Your Order</h3>
            
            <h4 style={{ marginBottom: '10px' }}>Entrees</h4>
            {entreesWithCosts?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: '14px' }}>
                <span>{item.item_name} x {item.quantity}</span>
                <span>{item.cost > 0 ? '+$' + item.cost : ''}</span>
              </div>
            ))}

            <h4 style={{ marginBottom: '10px', marginTop: '15px' }}>Salads</h4>
            {saladsWithCosts?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: '14px' }}>
                <span>{item.item_name} x {item.quantity}</span>
                <span>{item.cost > 0 ? '+$' + item.cost : ''}</span>
              </div>
            ))}

            {addOns && addOns.length > 0 && (
              <>
                <h4 style={{ marginBottom: '10px', marginTop: '15px' }}>Add-Ons</h4>
                {addOns.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', fontSize: '14px' }}>
                    <span>{item.item_name} x {item.quantity}</span>
                    <span>+${(menu.otherAddOns.find(a => a.id === item.id)?.price || 40) * item.quantity}</span>
                  </div>
                ))}
              </>
            )}

            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '16px', fontWeight: '600' }}>
              <span>Base Plan</span>
              <span>${BASE_PLAN_PRICE}.00</span>
            </div>

            {calculateExtras() > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '14px', color: '#D4A373' }}>
                <span>Add-Ons</span>
                <span>+${calculateExtras().toFixed(2)}</span>
              </div>
            )}

            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '16px', fontWeight: '600' }}>
              <span>Total:</span>
              <span>${submittedOrder?.total}</span>
            </div>
            
            <p style={{ fontSize: '12px', color: '#666', margin: '15px 0 0 0', textAlign: 'center' }}>Delivery: {submittedOrder?.deliveryDate}</p>
          </div>

          <button onClick={() => { setSelections({ entrees: {}, salads: {}, addOns: {} }); setScreen('menu'); }} style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Place Another Order</button>
        </div>
      </div>
    )
  }

  if (screen === 'history') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Header />

          <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Order History</h2>
          
          {orderHistory.length === 0 ? (
            <p style={{ fontSize: '16px', color: '#666' }}>No orders yet.</p>
          ) : (
            orderHistory.map(order => {
              const entrees = order.items.filter(i => i.item_type === 'entree')
              const salads = order.items.filter(i => i.item_type === 'salad')
              const addOns = order.items.filter(i => i.item_type === 'addon')
              
              let entreeExtras = Math.max(0, entrees.reduce((sum, e) => sum + e.quantity, 0) - 3)
              const entreesWithCosts = entrees.map(item => {
                let cost = 0
                if (entreeExtras > 0) {
                  const extrasThisItem = Math.min(item.quantity, entreeExtras)
                  cost = extrasThisItem * 40
                  entreeExtras -= extrasThisItem
                }
                return { ...item, cost }
              })

              let saladExtras = Math.max(0, salads.reduce((sum, s) => sum + s.quantity, 0) - 2)
              const saladsWithCosts = salads.map(item => {
                let cost = 0
                if (saladExtras > 0) {
                  const extrasThisItem = Math.min(item.quantity, saladExtras)
                  cost = extrasThisItem * 15
                  saladExtras -= extrasThisItem
                }
                return { ...item, cost }
              })

              return (
                <div key={order.order_id} style={{ background: 'white', padding: '20px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #e0dbd1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ color: '#1B5E4E', margin: '0 0 5px 0' }}>Order {order.order_id}</h3>
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Delivery: {order.delivery_date}</p>
                    </div>
                    <p style={{ fontSize: '18px', fontWeight: '600', color: '#1B5E4E', margin: 0 }}>${order.total_order_price}</p>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600', margin: '12px 0' }}>
                    <span>Base Plan</span>
                    <span>$160</span>
                  </div>

                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Entrees</h4>
                  {entreesWithCosts.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '3px 0' }}>
                      <span>{item.item_name} x {item.quantity}</span>
                      <span>{item.cost > 0 ? '+$' + item.cost : ''}</span>
                    </div>
                  ))}

                  <h4 style={{ fontSize: '14px', marginBottom: '8px', marginTop: '10px' }}>Salads</h4>
                  {saladsWithCosts.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '3px 0' }}>
                      <span>{item.item_name} x {item.quantity}</span>
                      <span>{item.cost > 0 ? '+$' + item.cost : ''}</span>
                    </div>
                  ))}

                  {addOns.length > 0 && (
                    <>
                      <h4 style={{ fontSize: '14px', marginBottom: '8px', marginTop: '10px' }}>Add-Ons</h4>
                      {addOns.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '3px 0' }}>
                          <span>{item.item_name} x {item.quantity}</span>
                          <span>+${item.quantity * 40}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }
}
