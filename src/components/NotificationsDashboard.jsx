import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PREFS_SET_COLUMN, isMissingPrefsColumn } from '../lib/notificationConsent'
import AdminEmailCheck from './AdminEmailCheck'
import { nextMonday } from '../lib/deliveryDate'

export default function NotificationsDashboard() {
  const [deliveryDate, setDeliveryDate] = useState('')
  const [emailCount, setEmailCount] = useState(0)
  const [smsCount, setSmsCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const today = new Date()
    setDeliveryDate(nextMonday(today))
  }, [])

  useEffect(() => {
    if (deliveryDate) {
      fetchNotificationCounts()
    }
  }, [deliveryDate])

  // Approved customers who chose this channel. Only explicit choices count: rows where
  // notification_prefs_set_at is empty hold the old default, not consent. Falls back to the
  // plain opt-in flag until that column's migration has been run.
  const optedInCustomers = async (channel, columns, options) => {
    const build = (confirmedOnly) => {
      let query = supabase
        .from('users')
        .select(columns, options)
        .eq(channel === 'email' ? 'email_opt_in' : 'sms_opt_in', true)
        .eq('approval_status', 'approved')
      if (channel === 'sms') query = query.not('phone_number', 'is', null)
      if (confirmedOnly) query = query.not(PREFS_SET_COLUMN, 'is', null)
      return query
    }
    const result = await build(true)
    return isMissingPrefsColumn(result.error) ? build(false) : result
  }

  const fetchNotificationCounts = async () => {
    setLoading(true)

    try {
      // head: true returns only the count, so read count rather than data
      const { count: emailTotal } = await optedInCustomers('email', 'id', { count: 'exact', head: true })
      const { count: smsTotal } = await optedInCustomers('sms', 'id', { count: 'exact', head: true })

      setEmailCount(emailTotal || 0)
      setSmsCount(smsTotal || 0)
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
      const { data: emailCustomers } = await optedInCustomers('email', 'email, name')
      const { data: smsCustomers } = await optedInCustomers('sms', 'phone_number, name')

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
      <h2 style={{ color: '#1a441f', marginBottom: '20px' }}>Menu Notifications</h2>

      <AdminEmailCheck />

      <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#1a441f' }}>
          Select Delivery Date
        </label>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e0dbd1', width: '100%', maxWidth: '300px', marginBottom: '12px', fontSize: '14px' }}
        />
        <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>
          <strong>{getDeliveryDateDisplay()}</strong>
        </p>
      </div>

      {loading ? (
        <p>Loading notification preferences...</p>
      ) : (
        <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
          <h3 style={{ color: '#1a441f', marginTop: '0' }}>Opt-In Summary</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: '#faf8f3' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1a441f', fontSize: '16px' }}>
                {emailCount}
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>Customers opted in to email</p>
            </div>

            <div style={{ padding: '12px', background: '#faf8f3' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1a441f', fontSize: '16px' }}>
                {smsCount}
              </p>
              <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>Customers opted in to SMS</p>
            </div>
          </div>

          {message && (
            <div
              style={{
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px',
                background: message.startsWith('✓') ? '#faf8f3' : '#ffebee',
                color: message.startsWith('✓') ? '#1a441f' : '#c62828',
                border: `1px solid ${message.startsWith('✓') ? '#e0dbd1' : '#ffcdd2'}`
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
              background: '#1a441f',
              color: '#faf8f3',
              border: 'none',
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

      <div style={{ background: '#faf8f3', padding: '16px', border: '1px solid #D4A373' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#1a441f', fontSize: '14px' }}>Implementation Note</h4>
        <p style={{ margin: '0', fontSize: '13px', color: '#1a441f', lineHeight: '1.5' }}>
          Email notifications currently use <strong>SendGrid</strong> (100 emails/day free tier).
          SMS uses <strong>Twilio</strong>. You'll need to configure API keys in .env to actually send messages.
          For now, the system just tracks counts and shows readiness.
        </p>
      </div>
    </div>
  )
}
