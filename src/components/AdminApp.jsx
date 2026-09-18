import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ItemFormModal from './ItemFormModal'
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
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Menu states
  const [deliveryDate, setDeliveryDate] = useState('')
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
    setDeliveryDate(getNextDeliveryDate())
    setLoading(false)
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
          order_close_datetime: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
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
      .select('id, email, name, approval_status')
      .order('created_at', { ascending: false })
    setPendingCustomers(data || [])
    setLoading(false)
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

  const exportToCSV = () => {
    const csv = [
      ['Order ID', 'Customer', 'Email', 'Item Type', 'Item Name', 'Quantity', 'Delivery Date', 'Total Price', 'Status']
    ]
    
    orders.forEach(order => {
      csv.push([
        order.order_id,
        order.customer_name,
        order.email,
        order.item_type,
        order.item_name,
        order.quantity,
        order.delivery_date,
        order.total_order_price,
        order.status
      ])
    })

    const csvContent = csv.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

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
                  background: isExpanded ? '#1B5E4E' : '#D4A373',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
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
                <div style={{ padding: '12px', background: '#faf8f3', borderRadius: '0 0 6px 6px', marginBottom: '8px' }}>
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
                        borderRadius: '4px',
                        marginBottom: '8px',
                        border: '1px solid #e0dbd1'
                      }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '14px', color: '#1B5E4E' }}>{item.name}</p>
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
                            background: selectedItems.some(s => s.item_id === item.id) ? '#D4A373' : '#1B5E4E',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
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
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto' }} />
          <button 
            onClick={onLogout} 
            style={{ padding: '8px 16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
          <button 
            onClick={() => setScreen('approvals')} 
            style={{ padding: '12px 24px', background: screen === 'approvals' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Approvals
          </button>
          <button 
            onClick={() => setScreen('menu')} 
            style={{ padding: '12px 24px', background: screen === 'menu' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Menu
          </button>
          <button 
            onClick={() => setScreen('orders')} 
            style={{ padding: '12px 24px', background: screen === 'orders' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Orders
          </button>
          <button 
            onClick={() => setScreen('notifications')} 
            style={{ padding: '12px 24px', background: screen === 'notifications' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Notifications
          </button>
          <button 
            onClick={() => setScreen('documents')} 
            style={{ padding: '12px 24px', background: screen === 'documents' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Documents
          </button>
        </div>

        {screen === 'approvals' && (
          <div>
            <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Pending Approvals</h2>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {pendingCustomers.length === 0 ? (
                  <p style={{ color: '#666' }}>No customers to manage</p>
                ) : (
                  pendingCustomers.map(customer => (
                    <div key={customer.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0dbd1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: '600', margin: '0 0 8px 0', color: '#1B5E4E' }}>{customer.name || 'Name not provided'}</p>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>{customer.email}</p>
                        <p style={{ margin: '0', color: '#999', fontSize: '12px' }}>Status: <strong>{customer.approval_status}</strong></p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {customer.approval_status !== 'approved' && (
                          <button 
                            onClick={() => handleApprove(customer.id)} 
                            style={{ padding: '8px 16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                          >
                            Approve
                          </button>
                        )}
                        {customer.approval_status !== 'rejected' && (
                          <button 
                            onClick={() => handleReject(customer.id)} 
                            style={{ padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {screen === 'menu' && (
          <div>
            <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Weekly Menu Setup</h2>
            
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1B5E4E' }}>Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={handleDeliveryDateChange}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px' }}
              />
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0, marginBottom: '12px' }}>Customer Survey Question</h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1B5E4E' }}>Question</label>
                <textarea
                  value={surveyQuestion}
                  onChange={(e) => setSurveyQuestion(e.target.value)}
                  placeholder="Ask customers something about this week's menu..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', minHeight: '60px', boxSizing: 'border-box', fontFamily: 'inherit' }}
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
                <label htmlFor="surveyActive" style={{ fontSize: '13px', color: '#1B5E4E', fontWeight: '500', cursor: 'pointer' }}>
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
                style={{ width: '100%', padding: '10px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Save Survey Question
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>Entrées</h3>
              {renderItemsByCategory(masterEntrees, 'entree')}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>Salads</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {masterSalads.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: '#faf8f3',
                    borderRadius: '4px',
                    border: '1px solid #e0dbd1'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '14px', color: '#1B5E4E' }}>{item.name}</p>
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
                        background: selectedItems.some(s => s.item_id === item.id) ? '#D4A373' : '#1B5E4E',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
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

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>Add-ons</h3>
              {renderItemsByCategory(masterAddOns, 'addon')}
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>Menu Summary — Review Before Saving</h3>
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
                        <h4 style={{ color: '#1B5E4E', marginTop: 0, marginBottom: '12px' }}>{typeLabel} ({typeItems.length})</h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {typeItems.map((selectedItem, idx) => {
                            const fullItem = masterList.find(m => m.id === selectedItem.item_id)
                            return (
                              <div key={selectedItem.item_id} style={{
                                padding: '12px',
                                background: '#faf8f3',
                                borderRadius: '6px',
                                border: '1px solid #e0dbd1'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                  <p style={{ fontWeight: '600', margin: 0, fontSize: '14px', color: '#1B5E4E' }}>
                                    {idx + 1}. {fullItem?.name}
                                  </p>
                                  <button
                                    onClick={() => handleRemoveItem(selectedItem.item_id)}
                                    style={{ padding: '4px 8px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                                  {fullItem?.description}
                                </p>
                                {fullItem?.price && (
                                  <p style={{ margin: 0, fontSize: '13px', color: '#1B5E4E', fontWeight: '600' }}>
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

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>Export Menus by Date Range</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>From Date</label>
                  <input
                    type="date"
                    id="exportFromDate"
                    style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>To Date</label>
                  <input
                    type="date"
                    id="exportToDate"
                    style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
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
                style={{ width: '100%', padding: '10px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Export Selected Weeks
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: 0 }}>CSV Upload</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Upload a CSV file to replace this week's entire menu.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                style={{ padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={async () => {
                  await saveWeeklyMenu()
                  alert('✓ Menu saved for ' + new Date(deliveryDate).toLocaleDateString())
                }}
                style={{ padding: '12px 24px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Save Menu
              </button>
              <button
                onClick={() => setShowPreview(true)}
                style={{ padding: '12px 24px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Preview & Go Live
              </button>
            </div>
          </div>
        )}

        {screen === 'orders' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: '#1B5E4E' }}>Orders</h2>
              <button 
                onClick={exportToCSV} 
                style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
              >
                Export to CSV
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0dbd1' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Order ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Customer</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Items</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groupedOrders = {}
                      orders.forEach(order => {
                        if (!groupedOrders[order.order_id]) {
                          groupedOrders[order.order_id] = {
                            order_id: order.order_id,
                            customer_name: order.customer_name,
                            email: order.email,
                            items: [],
                            status: order.status
                          }
                        }
                        groupedOrders[order.order_id].items.push(`${order.quantity}x ${order.item_name}`)
                      })
                      
                      return Object.values(groupedOrders).map((order, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e0dbd1' }}>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{order.order_id}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{order.customer_name}</td>
                          <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                            {order.items.map((item, i) => (
                              <div key={i}>{item}</div>
                            ))}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              background: order.status === 'delivered' ? '#c8e6c9' : '#fff3cd',
                              color: order.status === 'delivered' ? '#2e7d32' : '#856404',
                              fontWeight: '600'
                            }}>
                              {order.status === 'delivered' ? '✓ Delivered' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                            {order.status !== 'delivered' ? (
                              <button
                                onClick={() => {
                                  supabase.from('Orders').update({ status: 'delivered' }).eq('order_id', order.order_id).then(() => {
                                    fetchOrders()
                                  })
                                }}
                                style={{ padding: '6px 12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Mark Delivered
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  supabase.from('Orders').update({ status: 'pending' }).eq('order_id', order.order_id).then(() => {
                                    fetchOrders()
                                  })
                                }}
                                style={{ padding: '6px 12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Mark as Undelivered
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
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
            <div style={{ background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 style={{ color: '#1B5E4E' }}>Menu Preview</h2>
              <p>Ready to go live? Click the button below.</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{ flex: 1, padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Close
                </button>
                <button
                  onClick={toggleMenuLive}
                  style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
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
