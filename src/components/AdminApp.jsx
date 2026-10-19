import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ItemFormModal from './ItemFormModal'
import { formatWindows } from '../lib/deliveryWindows'
import { formatUsPhone } from '../lib/notificationConsent'
import '../styles/admin.css'
import NotificationsDashboard from './NotificationsDashboard'
import DocumentGenerationDashboard from './DocumentGenerationDashboard'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const CATEGORIES = ['Chicken', 'Beef', 'Fish', 'Lamb', 'Pasta', 'Pork', 'Vegetarian', 'Frozen']

export default function AdminApp({ onLogout }) {
  const [screen, setScreen] = useState('approvals')
  const [orders, setOrders] = useState([])
  const [includeCancelledInExport, setIncludeCancelledInExport] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderDateFilter, setOrderDateFilter] = useState('all')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all') // all | active | delivered | cancelled
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [expandedAnswers, setExpandedAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  
  // Menu states
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderCloseLocal, setOrderCloseLocal] = useState('') // value for <input type="datetime-local">
  const [selectedItems, setSelectedItems] = useState([]) // [{id, name, item_type}]
  const [masterEntrees, setMasterEntrees] = useState([])
  const [masterSalads, setMasterSalads] = useState([])
  const [masterAddOns, setMasterAddOns] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [surveyQuestion, setSurveyQuestion] = useState('')
  const [isSurveyActive, setIsSurveyActive] = useState(false)

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
    await fetchMasterItems()
    const nextDate = getNextDeliveryDate()
    setDeliveryDate(nextDate)
    await fetchOrderClose(nextDate)
    setLoading(false)
  }

  // datetime-local inputs want local "YYYY-MM-DDTHH:mm"; the DB stores a UTC timestamp
  const toLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const fetchOrderClose = async (date) => {
    const { data } = await supabase
      .from('delivery_settings')
      .select('order_close_datetime')
      .eq('delivery_date', date)
    setOrderCloseLocal(toLocalInput(data?.[0]?.order_close_datetime))
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

  const fetchMasterItems = async () => {
    const { data: entrees } = await supabase
      .from('entrees')
      .select('*')
      .is('archived_at', null)
      .order('created_at')
    const { data: salads } = await supabase
      .from('salads')
      .select('*')
      .is('archived_at', null)
      .order('created_at')
    const { data: addOns } = await supabase
      .from('add_ons')
      .select('*')
      .is('archived_at', null)
      .order('created_at')
    
    setMasterEntrees(entrees || [])
    setMasterSalads(salads || [])
    setMasterAddOns(addOns || [])
  }

  const handleDeliveryDateChange = async (e) => {
    const newDate = e.target.value
    setDeliveryDate(newDate)
    await fetchWeeklyMenu(newDate)
    await fetchOrderClose(newDate)
  }

  const fetchWeeklyMenu = async (date) => {
    const { data } = await supabase
      .from('weekly_menu')
      .select('id, item_id, item_type')
      .eq('delivery_date', date)
    
    if (data) {
      setSelectedItems(data)
    }
  }

  const handleAddItem = (item, itemType) => {
    if (!selectedItems.find(s => s.item_id === item.id)) {
      setSelectedItems([...selectedItems, { item_id: item.id, item_type: itemType, name: item.name }])
    }
  }

  const handleRemoveItem = (itemId) => {
    setSelectedItems(selectedItems.filter(s => s.item_id !== itemId))
  }

  const saveWeeklyMenu = async () => {
    await supabase
      .from('weekly_menu')
      .delete()
      .eq('delivery_date', deliveryDate)
    
    const itemsToInsert = selectedItems.map((item, idx) => ({
      delivery_date: deliveryDate,
      item_id: item.item_id,
      item_type: item.item_type,
      sort_order: idx + 1
    }))
    
    if (itemsToInsert.length > 0) {
      await supabase.from('weekly_menu').insert(itemsToInsert)
    }
  }

  const toggleMenuLive = async () => {
    if (!orderCloseLocal) {
      alert('Set when orders close before going live')
      return
    }
    await saveWeeklyMenu()
    
    const { data } = await supabase
      .from('delivery_settings')
      .select('*')
      .eq('delivery_date', deliveryDate)
    
    if (data?.length > 0) {
      await supabase
        .from('delivery_settings')
        .update({ is_live: !data[0].is_live })
        .eq('delivery_date', deliveryDate)
    } else {
      await supabase
        .from('delivery_settings')
        .insert({
          delivery_date: deliveryDate,
          order_open_datetime: new Date().toISOString(),
          order_close_datetime: new Date(orderCloseLocal).toISOString(),
          is_live: true
        })
    }
    
    setShowPreview(false)
  }

  const handleOpenItemForm = (item = null) => {
    if (item) {
      const itemWithType = { ...item, item_type: item.item_type || 'entree' }
      setEditingItem(itemWithType)
    } else {
      setEditingItem(null)
    }
    setShowItemForm(true)
  }

  const handleSaveItem = async () => {
    await fetchMasterItems()
    setEditingItem(null)
    setShowItemForm(false)
  }

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const csv = event.target.result
        const lines = csv.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          alert('CSV must have at least 1 data row')
          return
        }

        const headerLine = lines[0]
        const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))
        
        let successCount = 0
        let failCount = 0
        const itemsToAddToMenu = []

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          try {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const row = {}
            
            headers.forEach((h, idx) => {
              row[h] = values[idx] || ''
            })

            if (!row.name || !row.description) {
              console.warn(`Row ${i} skipped - missing name or description`)
              continue
            }

            const components = []
            if (row.components && row.components.trim()) {
              const componentPairs = row.components.split(';')
              componentPairs.forEach(pair => {
                const parts = pair.split('|')
                if (parts[0]?.trim() && parts[1]?.trim()) {
                  components.push({
                    name: parts[0].trim(),
                    instruction: parts[1].trim(),
                    quantity: parts[2] ? parseInt(parts[2]) || 1 : 1
                  })
                }
              })
            }

            if (components.length === 0) {
              console.warn(`Row ${i} skipped - no valid components`)
              continue
            }

            const itemData = {
              name: row.name.trim(),
              description: row.description.trim(),
              price: row.price ? Math.round(parseFloat(row.price) * 100) : null,
              components: components,
              chef_notes: row.chef_notes?.trim() || null,
              category: row.category ? row.category.split(';').map(c => c.trim()).filter(c => c) : null
            }

            const itemType = row.type?.trim() || 'entree'
            const table = itemType === 'entree' ? 'entrees' 
                        : itemType === 'salad' ? 'salads' 
                        : 'add_ons'

            const { data: existing } = await supabase
              .from(table)
              .select('id')
              .eq('name', row.name.trim())

            let itemId = null
            
            if (existing?.length > 0) {
              const { error } = await supabase
                .from(table)
                .update(itemData)
                .eq('id', existing[0].id)
              
              if (error) throw error
              itemId = existing[0].id
              successCount++
            } else {
              const { data: inserted, error } = await supabase
                .from(table)
                .insert([itemData])
                .select()
              
              if (error) throw error
              itemId = inserted?.[0]?.id
              successCount++
            }

            if (itemId) {
              itemsToAddToMenu.push({
                item_id: itemId,
                item_type: itemType
              })
            }
          } catch (rowErr) {
            console.error(`Row ${i} failed:`, rowErr)
            failCount++
          }
        }

        await supabase
          .from('weekly_menu')
          .delete()
          .eq('delivery_date', deliveryDate)

        if (itemsToAddToMenu.length > 0) {
          const menuRows = itemsToAddToMenu.map((item, idx) => ({
            delivery_date: deliveryDate,
            item_id: item.item_id,
            item_type: item.item_type,
            sort_order: idx + 1
          }))

          const { error: menuError } = await supabase
            .from('weekly_menu')
            .insert(menuRows)
          
          if (menuError) throw menuError
        }

        await fetchMasterItems()
        alert(`✓ Imported ${successCount} items for ${new Date(deliveryDate).toLocaleDateString()}${failCount > 0 ? ` (${failCount} failed)` : ''}`)
        
        if (failCount > 0) {
          console.log('Check browser console for failed row details')
        }
      } catch (err) {
        console.error('CSV import error:', err)
        alert('CSV import failed: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const exportMenusByDateRange = async (fromDate, toDate) => {
    const { data } = await supabase
      .from('weekly_menu')
      .select('*')
      .gte('delivery_date', fromDate)
      .lte('delivery_date', toDate)
      .order('delivery_date')
    
    if (!data || data.length === 0) {
      alert('No menus found for this date range')
      return
    }

    const csv = [['Delivery Date', 'Item Type', 'Item Name', 'Description', 'Price', 'Components', 'Chef Notes']]
    
    for (const row of data) {
      let itemName = ''
      let description = ''
      let price = ''
      let components = ''
      let chefNotes = ''
      
      const table = row.item_type === 'entree' ? 'entrees' : row.item_type === 'salad' ? 'salads' : 'add_ons'
      const { data: item } = await supabase
        .from(table)
        .select('*')
        .eq('id', row.item_id)
        .single()
      
      if (item) {
        itemName = item.name
        description = item.description
        price = item.price ? (item.price / 100).toFixed(2) : ''
        components = item.components ? item.components.map(c => `${c.name}|${c.instruction}|${c.quantity || 1}`).join(';') : ''
        chefNotes = item.chef_notes || ''
      }
      
      csv.push([
        row.delivery_date,
        row.item_type,
        itemName,
        description,
        price,
        components,
        chefNotes
      ])
    }

    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `menus-${fromDate}-to-${toDate}.csv`
    a.click()
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
    setPendingCustomers(data || [])
    setLoading(false)
  }

  // Request-to-join answers, in the order the form asks them
  const ANSWER_FIELDS = [
    ['Household', 'household_composition'],
    ['Delivery address', 'delivery_address'],
    ['Phone', 'delivery_phone'],
    ['Delivery time preferences', 'delivery_time_slots'],
    ['Special instructions', 'delivery_instructions'],
    ['Payment method', 'payment_method'],
    ['Allergies', 'allergies'],
    ['Health restrictions', 'health_restrictions'],
    ['Preference restrictions', 'preference_restrictions'],
    ['Protein preferences', 'protein_preferences'],
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
    await supabase
      .from('users')
      .update({ approval_status: 'approved' })
      .eq('id', userId)
    fetchPendingCustomers()
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

  const renderItemsByCategory = (items, itemType) => {
    const grouped = {}
    CATEGORIES.forEach(cat => {
      grouped[cat] = items.filter(item => item.category && item.category.includes(cat))
    })

    return (
      <div>
        {CATEGORIES.map(cat => {
          const catItems = grouped[cat]
          const isExpanded = expandedCategories[cat]
          
          return (
            <div key={cat} style={{ marginBottom: '12px' }}>
              <button
                onClick={() => setExpandedCategories({ ...expandedCategories, [cat]: !isExpanded })}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: isExpanded ? '#1a441f' : '#D4A373',
                  color: '#faf8f3',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{cat}</span>
                <span>{isExpanded ? '▼' : '▶'} ({catItems.length})</span>
              </button>

              {isExpanded && (
                <div style={{ padding: '12px', background: '#faf8f3', marginBottom: '8px' }}>
                  {catItems.length === 0 ? (
                    <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>No items in this category</p>
                  ) : (
                    catItems.map(item => (
                      <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        background: 'white',
                        marginBottom: '8px',
                        border: '1px solid #e0dbd1'
                      }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '14px', color: '#1a441f' }}>{item.name}</p>
                          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                          {item.price && (
                            <p style={{ margin: 0, fontSize: '13px', color: '#D4A373', fontWeight: '600' }}>
                              ${(item.price / 100).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (selectedItems.some(s => s.item_id === item.id)) {
                              handleRemoveItem(item.id)
                            } else {
                              handleAddItem(item, itemType)
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: selectedItems.some(s => s.item_id === item.id) ? '#D4A373' : '#1a441f',
                            color: '#faf8f3',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginLeft: '12px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {selectedItems.some(s => s.item_id === item.id) ? 'Remove' : 'Add'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

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
                          <p style={{ fontWeight: '600', margin: '0 0 8px 0', color: '#1a441f' }}>{customer.name || 'Name not provided'}</p>
                          <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>{customer.email}</p>
                          <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>Status: <strong>{customer.approval_status}</strong></p>
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
            <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Weekly Menu Setup</h2>
            
            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
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
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>Customers can't order after this time, even while the menu is live.</p>
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
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
              <h3 style={{ color: '#1a441f', marginTop: 0 }}>Entrées</h3>
              {renderItemsByCategory(masterEntrees, 'entree')}
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: 0 }}>Salads</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {masterSalads.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: '#faf8f3',
                    border: '1px solid #e0dbd1'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '14px', color: '#1a441f' }}>{item.name}</p>
                      <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedItems.some(s => s.item_id === item.id)) {
                          handleRemoveItem(item.id)
                        } else {
                          handleAddItem(item, 'salad')
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: selectedItems.some(s => s.item_id === item.id) ? '#D4A373' : '#1a441f',
                        color: '#faf8f3',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginLeft: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {selectedItems.some(s => s.item_id === item.id) ? 'Remove' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: 0 }}>Add-ons</h3>
              {renderItemsByCategory(masterAddOns, 'addon')}
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: 0 }}>Menu Summary — Review Before Saving</h3>
              {selectedItems.length === 0 ? (
                <p style={{ color: '#999' }}>No items selected yet. Click "Add" on items above.</p>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {['entree', 'salad', 'addon'].map(type => {
                    const typeItems = selectedItems.filter(s => s.item_type === type)
                    if (typeItems.length === 0) return null
                    
                    const typeLabel = type === 'entree' ? 'ENTRÉES' : type === 'salad' ? 'SALADS' : 'ADD-ONS'
                    const masterList = type === 'entree' ? masterEntrees : type === 'salad' ? masterSalads : masterAddOns
                    
                    return (
                      <div key={type} style={{ borderBottom: '2px solid #e0dbd1', paddingBottom: '16px' }}>
                        <h4 style={{ color: '#1a441f', marginTop: 0, marginBottom: '12px' }}>{typeLabel} ({typeItems.length})</h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {typeItems.map((selectedItem, idx) => {
                            const fullItem = masterList.find(m => m.id === selectedItem.item_id)
                            return (
                              <div key={selectedItem.item_id} style={{
                                padding: '12px',
                                background: '#faf8f3',
                                border: '1px solid #e0dbd1'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                  <p style={{ fontWeight: '600', margin: 0, fontSize: '14px', color: '#1a441f' }}>
                                    {idx + 1}. {fullItem?.name}
                                  </p>
                                  <button
                                    onClick={() => handleRemoveItem(selectedItem.item_id)}
                                    style={{ padding: '4px 8px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                                  {fullItem?.description}
                                </p>
                                {fullItem?.price && (
                                  <p style={{ margin: 0, fontSize: '13px', color: '#1a441f', fontWeight: '600' }}>
                                    ${(fullItem.price / 100).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '16px' }}>Export Menus by Date Range</h3>
              <div className="admin-date-range">
                <div>
                  <label htmlFor="exportFromDate" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1a441f' }}>From Date</label>
                  <input type="date" id="exportFromDate" className="admin-input" />
                </div>
                <div>
                  <label htmlFor="exportToDate" style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1a441f' }}>To Date</label>
                  <input type="date" id="exportToDate" className="admin-input" />
                </div>
              </div>
              <button
                onClick={() => {
                  const fromDate = document.getElementById('exportFromDate').value
                  const toDate = document.getElementById('exportToDate').value
                  if (!fromDate || !toDate) {
                    alert('Please select both dates')
                    return
                  }
                  exportMenusByDateRange(fromDate, toDate)
                }}
                style={{ width: '100%', padding: '10px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Export Selected Weeks
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '16px' }}>CSV Upload</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Upload a CSV file to replace this week's entire menu.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="admin-input admin-file-input"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={async () => {
                  await saveWeeklyMenu()
                  alert('✓ Menu saved for ' + new Date(deliveryDate).toLocaleDateString())
                }}
                style={{ padding: '12px 24px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Save Menu
              </button>
              <button
                onClick={() => setShowPreview(true)}
                style={{ padding: '12px 24px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Preview & Go Live
              </button>
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

        {showPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ background: 'white', padding: '30px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 style={{ color: '#1a441f' }}>Menu Preview</h2>
              <p>Ready to go live? Click the button below.</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{ flex: 1, padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  Close
                </button>
                <button
                  onClick={toggleMenuLive}
                  style={{ flex: 1, padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  Go Live
                </button>
              </div>
            </div>
          </div>
        )}

        {showItemForm && (
          <ItemFormModal
            item={editingItem}
            onClose={() => {
              setEditingItem(null)
              setShowItemForm(false)
            }}
            onSave={handleSaveItem}
          />
        )}
      </div>
    </div>
  )
}
