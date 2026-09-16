import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function AdminApp({ onLogout }) {
  const [screen, setScreen] = useState('orders')
  const [orders, setOrders] = useState([])
  const [pendingCustomers, setPendingCustomers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (screen === 'orders') {
      fetchOrders()
    } else if (screen === 'approvals') {
      fetchPendingCustomers()
    }
  }, [screen])

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
    a.download = 'orders.csv'
    a.click()
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
            onClick={() => setScreen('orders')} 
            style={{ padding: '12px 24px', background: screen === 'orders' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Orders
          </button>
          <button 
            onClick={() => setScreen('approvals')} 
            style={{ padding: '12px 24px', background: screen === 'approvals' ? '#1B5E4E' : '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Approvals
          </button>
        </div>

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
      </div>
    </div>
  )
}
