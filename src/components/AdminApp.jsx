import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const ADMIN_PASSWORD = 'admin123'

export default function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAdminLogin = (e) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setPassword('')
      fetchOrders()
    } else {
      setError('Invalid password')
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, delivery_address, delivery_day, delivery_time')

      if (usersError) throw usersError

      const usersMap = {}
      usersData.forEach(u => {
        usersMap[u.id] = u
      })

      setUsers(usersMap)
      setOrders(ordersData)
    } catch (err) {
      setError('Failed to fetch orders')
    }
    setLoading(false)
  }

  const exportToCSV = () => {
    if (orders.length === 0) {
      setError('No orders to export')
      return
    }

    const rows = []
    const header = ['Customer', 'Email', 'Delivery Address', 'Delivery Day', 'Delivery Time', 'Entrée 1', 'Qty', 'Entrée 2', 'Qty', 'Entrée 3', 'Qty', 'Salad 1', 'Qty', 'Salad 2', 'Qty', 'Add-Ons', 'Special Requests']
    rows.push(header.join(','))

    orders.forEach(order => {
      const user = users[order.user_id]
      const addOnsStr = order.add_ons ? Object.keys(order.add_ons).join('; ') : ''
      const row = [
        user?.name || 'Unknown',
        user?.email || '',
        user?.delivery_address || '',
        user?.delivery_day || '',
        user?.delivery_time || '',
        order.entree_1 || '',
        order.entree_1_qty || '',
        order.entree_2 || '',
        order.entree_2_qty || '',
        order.entree_3 || '',
        order.entree_3_qty || '',
        order.salad_1 || '',
        order.salad_1_qty || '',
        order.salad_2 || '',
        order.salad_2_qty || '',
        addOnsStr,
        order.special_requests || ''
      ]
      rows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    })

    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isAuthenticated) {
    return (
      <div className="container admin-login-container">
        <div className="admin-logo">
          <h1>Admin Dashboard</h1>
          <p>Dinner with Charles</p>
        </div>

        <form onSubmit={handleAdminLogin} className="admin-login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>

          <button type="submit" className="btn btn-primary btn-large">
            Enter Dashboard
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="container admin-container">
      <div className="admin-header">
        <h1>Orders Dashboard</h1>
        <div className="admin-actions">
          <button onClick={fetchOrders} disabled={loading} className="btn btn-secondary">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={exportToCSV} className="btn btn-primary">
            Export to CSV
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Delivery</th>
                <th>Entrée 1</th>
                <th>Qty</th>
                <th>Entrée 2</th>
                <th>Qty</th>
                <th>Entrée 3</th>
                <th>Qty</th>
                <th>Salad 1</th>
                <th>Qty</th>
                <th>Salad 2</th>
                <th>Qty</th>
                <th>Add-Ons</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const user = users[order.user_id]
                const addOnsStr = order.add_ons ? Object.keys(order.add_ons).join(', ') : '—'
                return (
                  <tr key={order.id}>
                    <td>
                      <strong>{user?.name || 'Unknown'}</strong>
                      <div className="table-sub">{user?.email || ''}</div>
                      <div className="table-sub">{user?.delivery_address || ''}</div>
                    </td>
                    <td>
                      <div>{user?.delivery_day || '—'}</div>
                      <div className="table-sub">{user?.delivery_time || '—'}</div>
                    </td>
                    <td>{order.entree_1 || '—'}</td>
                    <td>{order.entree_1_qty || '—'}</td>
                    <td>{order.entree_2 || '—'}</td>
                    <td>{order.entree_2_qty || '—'}</td>
                    <td>{order.entree_3 || '—'}</td>
                    <td>{order.entree_3_qty || '—'}</td>
                    <td>{order.salad_1 || '—'}</td>
                    <td>{order.salad_1_qty || '—'}</td>
                    <td>{order.salad_2 || '—'}</td>
                    <td>{order.salad_2_qty || '—'}</td>
                    <td className="table-addons">{addOnsStr}</td>
                    <td className="table-notes">{order.special_requests || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
