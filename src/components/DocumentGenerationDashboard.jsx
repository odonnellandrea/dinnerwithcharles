import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { downloadPdf } from '../lib/downloadPdf'

const DOCUMENTS = [
  { id: 'grid', title: 'Order Grid', icon: '📊', description: '6x4 landscape, black and white. Who ordered what for the week, with totals. Andrea and her parents show as dots.' },
  { id: 'packing', title: 'Packing Lists', icon: '📦', description: '4x6 black and white. One page per family with a checkbox for every container and their special instructions.' },
  { id: 'chef', title: 'Chef Reference', icon: '👨‍🍳', description: '4x6 black and white. How many of each dish to cook, with containers and packaging.' }
]

const ROLES = [
  { value: '', label: 'Customer' },
  { value: 'family', label: 'Andrea / parents' },
  { value: 'rob', label: 'Rob delivers (note)' }
]
const ROLES_KEY = 'dwc-doc-roles'

const nextMonday = () => {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7))
  return monday.toISOString().split('T')[0]
}

const readRoles = () => {
  try { return JSON.parse(localStorage.getItem(ROLES_KEY) || '{}') || {} } catch { return {} }
}

export default function DocumentGenerationDashboard() {
  const [deliveryDate, setDeliveryDate] = useState(nextMonday)
  const [customers, setCustomers] = useState([])
  const [guessed, setGuessed] = useState([])
  const [roles, setRoles] = useState(readRoles)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const query = (doc) => {
    const withRole = (role) => Object.entries(roles).filter(([email, r]) => r === role && customers.some(c => c.email === email)).map(([email]) => email).join(',')
    return `/.netlify/functions/ops-pdf?doc=${doc}&date=${deliveryDate}&family=${encodeURIComponent(withRole('family'))}&rob=${encodeURIComponent(withRole('rob'))}`
  }

  // Who ordered for this date, and which dishes still need their containers confirmed
  useEffect(() => {
    let cancelled = false
    setStatus('Checking orders...')
    setCustomers([])
    setGuessed([])
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/.netlify/functions/ops-pdf?doc=info&date=${deliveryDate}`, { headers: { Authorization: `Bearer ${session?.access_token}` } })
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setStatus(body.error || `Could not check the orders (${res.status})`); return }
        setCustomers(body.customers)
        setGuessed(body.guessed)
        setStatus('')
      } catch (err) {
        if (!cancelled) setStatus('Could not check the orders: ' + err.message)
      }
    })()
    return () => { cancelled = true }
  }, [deliveryDate])

  const setRole = (email, role) => {
    const next = { ...roles, [email]: role }
    if (!role) delete next[email]
    setRoles(next)
    try { localStorage.setItem(ROLES_KEY, JSON.stringify(next)) } catch { /* per-visit only */ }
  }

  const generate = async (doc) => {
    setBusy(doc.id)
    setMessage('')
    try {
      await downloadPdf(query(doc.id), `${doc.title} - ${deliveryDate}.pdf`)
    } catch (err) {
      setMessage(`✗ ${doc.title} failed: ${err.message}`)
    }
    setBusy('')
  }

  const dateLabel = deliveryDate ? new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''
  const hasOrders = customers.length > 0

  return (
    <div>
      <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Documents</h2>

      <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1a441f' }}>Delivery Date</label>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}><strong>{dateLabel}</strong></p>
        {status && <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#666' }}>{status}</p>}
      </div>

      {hasOrders && (
        <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
          <h3 style={{ color: '#1a441f', margin: '0 0 6px 0', fontSize: '15px' }}>Who ordered</h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
            Andrea and her parents get no packing page and are not counted for the chef (a :) shows instead). "Rob delivers" only adds that note to the family's packing page. Everyone else is a normal customer. Remembered on this device.
          </p>
          {customers.map(customer => (
            <div key={customer.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid #f0ece3' }}>
              <span style={{ fontSize: '14px', color: '#333' }}>{customer.name}</span>
              <select
                aria-label={`Role for ${customer.name}`}
                value={roles[customer.email] || ''}
                onChange={(e) => setRole(customer.email, e.target.value)}
                style={{ padding: '6px 8px', border: '1px solid #e0dbd1', fontSize: '13px', background: 'white', fontFamily: 'inherit' }}
              >
                {ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {guessed.length > 0 && (
        <div style={{ background: '#faf8f3', padding: '16px', marginBottom: '20px', border: '1px solid #D4A373' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1a441f', fontSize: '14px' }}>Check the containers for these dishes</h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1a441f', lineHeight: 1.6 }}>
            The menu sheet has no packing info for them yet, so the lists use a guess made from the reheat steps or the sides. To set it, add a <strong>containers</strong> column to the sheet and put one container per line in each dish's cell.
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1a441f', lineHeight: 1.6 }}>
            {guessed.map(name => <li key={name}>{name}</li>)}
          </ul>
        </div>
      )}

      {message && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', fontSize: '13px', background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2' }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {DOCUMENTS.map(doc => (
          <div key={doc.id} style={{ background: 'white', padding: '20px', border: '1px solid #e0dbd1', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{doc.icon}</div>
            <h3 style={{ color: '#1a441f', margin: '0 0 6px 0', fontSize: '15px', fontWeight: '600' }}>{doc.title}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#666', lineHeight: '1.4', flexGrow: 1 }}>{doc.description}</p>
            <button
              onClick={() => generate(doc)}
              disabled={!!busy || !hasOrders}
              style={{ padding: '10px 16px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: busy || !hasOrders ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', opacity: busy || !hasOrders ? 0.6 : 1 }}
            >
              {busy === doc.id ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
        ))}
      </div>

      <p style={{ margin: '20px 0 0 0', fontSize: '12px', color: '#999', lineHeight: 1.6 }}>
        Cancelled orders are left out. Delivery labels and reheat stickers are not built into the admin yet; keep making those with the toolkit.
      </p>
    </div>
  )
}
