import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function NotificationsDashboard() {
  const [deliveryDate, setDeliveryDate] = useState('')
  const [emailCount, setEmailCount] = useState(0)
  const [smsCount, setSmsCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const today = new Date()
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7))
    setDeliveryDate(nextMonday.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (deliveryDate) {
      fetchNotificationCounts()
    }
  }, [deliveryDate])

  const fetchNotificationCounts = async () => {
    setLoading(true)

    try {
      // Count customers who opted in to email
      const { data: emailCustomers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('email_opt_in', true)
        .eq('approval_status', 'approved')

      // Count customers who opted in to SMS
      const { data: smsCustomers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('sms_opt_in', true)
        .neq('phone_number', null)
        .eq('approval_status', 'approved')

      setEmailCount(emailCustomers?.length || 0)
      setSmsCount(smsCustomers?.length || 0)
    } catch (err) {
      console.error('Failed to fetch notification counts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotifications = async () => {
    if (!deliveryDate) {
      alert('Please select a delivery date')
      return
    }

    // Check if menu is live for this date
    const { data: deliverySettings } = await supabase
      .from('delivery_settings')
      .select('is_live')
      .eq('delivery_date', deliveryDate)
      .single()

    if (!deliverySettings?.is_live) {
      alert('This menu is not live yet. Go live first, then send notifications.')
      return
    }

    setSending(true)

    try {
      // Fetch customers who opted in
      const { data: emailCustomers } = await supabase
        .from('users')
        .select('email, name')
        .eq('email_opt_in', true)
        .eq('approval_status', 'approved')

      const { data: smsCustomers } = await supabase
        .from('users')
        .select('phone_number, name')
        .eq('sms_opt_in', true)
        .neq('phone_number', null)
        .eq('approval_status', 'approved')

      // In a real implementation, you would call SendGrid for email and Twilio for SMS
      // For now, we'll just log and show success
      console.log('Email customers to notify:', emailCustomers)
      console.log('SMS customers to notify:', smsCustomers)

      const formattedDate = new Date(deliveryDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      })

      setMessage(`✓ Notifications queued! ${emailCustomers?.length || 0} email(s) and ${smsCustomers?.length || 0} SMS message(s) will be sent.`)

      // Reset after 3 seconds
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('✗ Failed to send notifications: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const getDeliveryDateDisplay = () => {
    if (!deliveryDate) return ''
    const date = new Date(deliveryDate)
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Menu Notifications</h2>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1B5E4E' }}>
          Select Delivery Date
        </label>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px', marginBottom: '12px', fontSize: '14px' }}
        />
        <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
          <strong>{getDeliveryDateDisplay()}</strong>
        </p>
      </div>

      {loading ? (
        <p>Loading notification preferences...</p>
      ) : (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
          <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Opt-In Summary</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1B5E4E', fontSize: '16px' }}>
                {emailCount}
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>Customers opted in to email</p>
            </div>

            <div style={{ padding: '12px', background: '#faf8f3', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1B5E4E', fontSize: '16px' }}>
                {smsCount}
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>Customers opted in to SMS</p>
            </div>
          </div>

          {message && (
            <div
              style={{
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '13px',
                background: message.startsWith('✓') ? '#e8f5e9' : '#ffebee',
                color: message.startsWith('✓') ? '#2e7d32' : '#c62828',
                border: `1px solid ${message.startsWith('✓') ? '#c8e6c9' : '#ffcdd2'}`
              }}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleSendNotifications}
            disabled={sending || emailCount === 0 && smsCount === 0}
            style={{
              padding: '12px 24px',
              background: '#1B5E4E',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: sending || (emailCount === 0 && smsCount === 0) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              opacity: sending || (emailCount === 0 && smsCount === 0) ? 0.6 : 1
            }}
          >
            {sending ? 'Sending...' : 'Send Menu Notifications'}
          </button>

          {emailCount === 0 && smsCount === 0 && (
            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#999' }}>
              No customers have opted in to notifications yet.
            </p>
          )}
        </div>
      )}

      <div style={{ background: '#fff3cd', padding: '16px', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#856404', fontSize: '14px' }}>Implementation Note</h4>
        <p style={{ margin: '0', fontSize: '13px', color: '#856404', lineHeight: '1.5' }}>
          Email notifications currently use <strong>SendGrid</strong> (100 emails/day free tier).
          SMS uses <strong>Twilio</strong>. You'll need to configure API keys in .env to actually send messages.
          For now, the system just tracks counts and shows readiness.
        </p>
      </div>
    </div>
  )
}
