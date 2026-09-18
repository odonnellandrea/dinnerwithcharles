import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ItemFormModal from './ItemFormModal'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function AdminApp({ onLogout }) {
  const [screen, setScreen] = useState('approvals')
  const [orders, setOrders] = useState([])
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Menu states
  const [menuScreen, setMenuScreen] = useState('setup')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [selectedEntrees, setSelectedEntrees] = useState([])
  const [selectedSalads, setSelectedSalads] = useState([])
  const [selectedAddOns, setSelectedAddOns] = useState([])
  const [masterEntrees, setMasterEntrees] = useState([])
  const [masterSalads, setMasterSalads] = useState([])
  const [masterAddOns, setMasterAddOns] = useState([])
  const [maxEntrees, setMaxEntrees] = useState(5)
  const [maxSalads, setMaxSalads] = useState(3)
  const [showPreview, setShowPreview] = useState(false)
  const [previewLive, setPreviewLive] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  useEffect(() => {
    if (screen === 'orders') {
      fetchOrders()
    } else if (screen === 'approvals') {
      fetchPendingCustomers()
    } else if (screen === 'menu') {
      initializeMenu()
    }
  }, [screen])

  // ===== MENU FUNCTIONS =====
  const initializeMenu = async () => {
    setLoading(true)
    await fetchSettings()
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

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      const maxE = data.find(s => s.key === 'max_entrees')
      const maxS = data.find(s => s.key === 'max_salads')
      setMaxEntrees(parseInt(maxE?.value || 5))
      setMaxSalads(parseInt(maxS?.value || 3))
    }
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

  const fetchWeeklyMenu = async (date) => {
    const { data } = await supabase
      .from('weekly_menu')
      .select('item_id, item_type')
      .eq('delivery_date', date)
    
    if (data) {
      setSelectedEntrees(data.filter(d => d.item_type === 'entree').map(d => d.item_id))
      setSelectedSalads(data.filter(d => d.item_type === 'salad').map(d => d.item_id))
      setSelectedAddOns(data.filter(d => d.item_type === 'addon').map(d => d.item_id))
    }
  }

  const handleDeliveryDateChange = async (e) => {
    const newDate = e.target.value
    setDeliveryDate(newDate)
    await fetchWeeklyMenu(newDate)
  }

  const saveWeeklyMenu = async () => {
    await supabase
      .from('weekly_menu')
      .delete()
      .eq('delivery_date', deliveryDate)
    
    const itemsToInsert = [
      ...selectedEntrees.map(id => ({ delivery_date: deliveryDate, item_id: id, item_type: 'entree' })),
      ...selectedSalads.map(id => ({ delivery_date: deliveryDate, item_id: id, item_type: 'salad' })),
      ...selectedAddOns.map(id => ({ delivery_date: deliveryDate, item_id: id, item_type: 'addon' }))
    ]
    
    await supabase.from('weekly_menu').insert(itemsToInsert)
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
    
    setPreviewLive(!previewLive)
    setShowPreview(false)
  }

  const handleOpenItemForm = (item = null) => {
    if (item) {
      // Set item_type if missing (for editing existing items)
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

  const handleArchiveItem = async (id, type) => {
    const table = type === 'entree' ? 'entrees' : type === 'salad' ? 'salads' : 'add_ons'
    await supabase
      .from(table)
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    await fetchMasterItems()
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

        // Simple header parse
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

            // Parse components
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
              chef_notes: row.chef_notes?.trim() || null
            }

            const itemType = row.type?.trim() || 'entree'
            const table = itemType === 'entree' ? 'entrees' 
                        : itemType === 'salad' ? 'salads' 
                        : 'add_ons'

            // Check if exists
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

            // Track for adding to weekly_menu
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

        // Delete existing menu for this date
        await supabase
          .from('weekly_menu')
          .delete()
          .eq('delivery_date', deliveryDate)

        // Add items to weekly_menu
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
    reader.onload = async (event) => {
      try {
        const csv = event.target.result
        const lines = csv.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          alert('CSV must have at least 1 data row')
          return
        }

        // Simple header parse
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

            // Parse components
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
              chef_notes: row.chef_notes?.trim() || null
            }

            const itemType = row.type?.trim() || 'entree'
            const table = itemType === 'entree' ? 'entrees' 
                        : itemType === 'salad' ? 'salads' 
                        : 'add_ons'

            // Check if exists
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

            // Track for adding to weekly_menu
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

        // Delete existing menu for this date
        await supabase
          .from('weekly_menu')
          .delete()
          .eq('delivery_date', deliveryDate)

        // Add items to weekly_menu
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

  const parseCSVLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }

  // ===== ORDERS FUNCTIONS =====
  const fetchOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('Orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  // ===== APPROVALS FUNCTIONS =====
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

  // ===== RENDER =====
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
            {menuScreen === 'setup' ? (
              <MenuSetupTab
                deliveryDate={deliveryDate}
                onDeliveryDateChange={handleDeliveryDateChange}
                selectedEntrees={selectedEntrees}
                setSelectedEntrees={setSelectedEntrees}
                selectedSalads={selectedSalads}
                setSelectedSalads={setSelectedSalads}
                selectedAddOns={selectedAddOns}
                setSelectedAddOns={setSelectedAddOns}
                masterEntrees={masterEntrees}
                masterSalads={masterSalads}
                masterAddOns={masterAddOns}
                maxEntrees={maxEntrees}
                maxSalads={maxSalads}
                onShowPreview={() => setShowPreview(true)}
                onShowMaster={() => setMenuScreen('master')}
                onCSVUpload={handleCSVUpload}
                onAddItem={() => handleOpenItemForm()}
                exportMenusByDateRange={exportMenusByDateRange}
              />
            ) : (
              <MasterItemsTab
                masterEntrees={masterEntrees}
                masterSalads={masterSalads}
                masterAddOns={masterAddOns}
                onBack={() => setMenuScreen('setup')}
                onArchive={handleArchiveItem}
                onEdit={handleOpenItemForm}
                onAddItem={() => handleOpenItemForm()}
              />
            )}
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
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Item</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Qty</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Price</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#1B5E4E', fontWeight: '600' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0dbd1' }}>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{order.order_id}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{order.customer_name}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{order.item_name}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{order.quantity}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>${(order.total_order_price / 100).toFixed(2)}</td>
                        <td style={{ padding: '12px', fontSize: '14px' }}>{order.delivery_date}</td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>{order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {showPreview && (
          <MenuPreview
            deliveryDate={deliveryDate}
            selectedEntrees={selectedEntrees}
            selectedSalads={selectedSalads}
            selectedAddOns={selectedAddOns}
            masterEntrees={masterEntrees}
            masterSalads={masterSalads}
            masterAddOns={masterAddOns}
            onClose={() => setShowPreview(false)}
            onGoLive={toggleMenuLive}
            isLive={previewLive}
          />
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

function MenuSetupTab({
  deliveryDate,
  onDeliveryDateChange,
  selectedEntrees,
  setSelectedEntrees,
  selectedSalads,
  setSelectedSalads,
  selectedAddOns,
  setSelectedAddOns,
  masterEntrees,
  masterSalads,
  masterAddOns,
  maxEntrees,
  maxSalads,
  onShowPreview,
  onShowMaster,
  onCSVUpload,
  onAddItem,
  exportMenusByDateRange
}) {
  if (!exportMenusByDateRange) {
    console.warn('exportMenusByDateRange not passed to MenuSetupTab')
  }
  return (
    <div>
      <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Weekly Menu Setup</h2>
      
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1B5E4E' }}>
          Delivery Date
        </label>
        <input
          type="date"
          value={deliveryDate}
          onChange={onDeliveryDateChange}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px' }}
        />
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>
          Entrées — Pick {maxEntrees} (additional entrées $40 each)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
          {masterEntrees.map(item => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#faf8f3', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedEntrees.includes(item.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedEntrees([...selectedEntrees, item.id])
                  } else {
                    setSelectedEntrees(selectedEntrees.filter(id => id !== item.id))
                  }
                }}
              />
              <span style={{ fontSize: '14px' }}>{item.name}</span>
            </label>
          ))}
        </div>
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Entrée
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>
          Salads — Pick {maxSalads} (additional salads $15 each)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
          {masterSalads.map(item => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#faf8f3', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedSalads.includes(item.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSalads([...selectedSalads, item.id])
                  } else {
                    setSelectedSalads(selectedSalads.filter(id => id !== item.id))
                  }
                }}
              />
              <span style={{ fontSize: '14px' }}>{item.name}</span>
            </label>
          ))}
        </div>
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Salad
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>
          Add-ons — Optional (à la carte pricing)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
          {masterAddOns.map(item => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#faf8f3', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedAddOns.includes(item.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAddOns([...selectedAddOns, item.id])
                  } else {
                    setSelectedAddOns(selectedAddOns.filter(id => id !== item.id))
                  }
                }}
              />
              <span style={{ fontSize: '14px' }}>{item.name} — ${(item.price / 100).toFixed(2)}</span>
            </label>
          ))}
        </div>
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Add-on
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>Export Menus by Date Range</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>From Date</label>
            <input
              type="date"
              id="exportFromDate"
              style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>To Date</label>
            <input
              type="date"
              id="exportToDate"
              style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px' }}
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
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>Export Menus by Date Range</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>From Date</label>
            <input
              type="date"
              id="exportFromDate"
              style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>To Date</label>
            <input
              type="date"
              id="exportToDate"
              style={{ width: '100%', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px' }}
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
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>CSV Upload</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
          Upload a CSV file to replace this week's entire menu. Format: name, description, price, components, chef_notes, type
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={onCSVUpload}
          style={{ padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px', cursor: 'pointer' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onShowPreview}
          style={{ padding: '12px 24px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
        >
          Preview & Go Live
        </button>
        <button
          onClick={onShowMaster}
          style={{ padding: '12px 24px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
        >
          Manage Master Items
        </button>
      </div>
    </div>
  )
}

function MasterItemsTab({ masterEntrees, masterSalads, masterAddOns, onBack, onArchive, onEdit, onAddItem }) {
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Back to Setup
        </button>
      </div>

      <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Master Items</h2>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>Entrées</h3>
        {masterEntrees.map(item => (
          <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{item.description}</p>
              {item.components && (
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>
                  {item.components.length} components
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => onEdit(item)}
                style={{ padding: '6px 12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Edit
              </button>
              <button
                onClick={() => onArchive(item.id, 'entree')}
                style={{ padding: '6px 12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Archive
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Entrée
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>Salads</h3>
        {masterSalads.map(item => (
          <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{item.description}</p>
              {item.components && (
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>
                  {item.components.length} components
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => onEdit(item)}
                style={{ padding: '6px 12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Edit
              </button>
              <button
                onClick={() => onArchive(item.id, 'salad')}
                style={{ padding: '6px 12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Archive
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Salad
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0dbd1' }}>
        <h3 style={{ color: '#1B5E4E', marginBottom: '10px' }}>Add-ons</h3>
        {masterAddOns.map(item => (
          <div key={item.id} style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0', fontWeight: '600', color: '#1B5E4E' }}>{item.name} — ${(item.price / 100).toFixed(2)}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{item.description}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => onEdit(item)}
                style={{ padding: '6px 12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Edit
              </button>
              <button
                onClick={() => onArchive(item.id, 'addon')}
                style={{ padding: '6px 12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Archive
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={onAddItem}
          style={{ marginTop: '10px', padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          + Add New Add-on
        </button>
      </div>
    </div>
  )
}

function MenuPreview({
  deliveryDate,
  selectedEntrees,
  selectedSalads,
  selectedAddOns,
  masterEntrees,
  masterSalads,
  masterAddOns,
  onClose,
  onGoLive,
  isLive
}) {
  const entreesList = masterEntrees.filter(e => selectedEntrees.includes(e.id))
  const saladsList = masterSalads.filter(s => selectedSalads.includes(s.id))
  const addOnsList = masterAddOns.filter(a => selectedAddOns.includes(a.id))

  return (
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
        <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Menu Preview — {deliveryDate}</h2>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#1B5E4E' }}>Entrées</h3>
          {entreesList.map(item => (
            <div key={item.id} style={{ padding: '10px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px' }}>
              <p style={{ margin: '0', fontWeight: '600' }}>{item.name}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#1B5E4E' }}>Salads</h3>
          {saladsList.map(item => (
            <div key={item.id} style={{ padding: '10px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px' }}>
              <p style={{ margin: '0', fontWeight: '600' }}>{item.name}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#1B5E4E' }}>Add-ons</h3>
          {addOnsList.map(item => (
            <div key={item.id} style={{ padding: '10px', background: '#faf8f3', borderRadius: '6px', marginBottom: '8px' }}>
              <p style={{ margin: '0', fontWeight: '600' }}>{item.name} — ${(item.price / 100).toFixed(2)}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid #e0dbd1', paddingTop: '20px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
          >
            Close
          </button>
          <button
            onClick={onGoLive}
            style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
          >
            {isLive ? 'Take Offline' : 'Go Live'}
          </button>
        </div>
      </div>
    </div>
  )
}
