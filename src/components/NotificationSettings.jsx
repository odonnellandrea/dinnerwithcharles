import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function NotificationSettings({ user }) {
  const [emailOptIn, setEmailOptIn] = useState(true)
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('users')
      .select('email_opt_in, sms_opt_in, phone_number')
      .eq('id', user.id)
      .single()

    if (data) {
      setEmailOptIn(data.email_opt_in !== false)
      setSmsOptIn(data.sms_opt_in === true)
      setPhoneNumber(data.phone_number || '')
    }
  }

  const handleSave = async () => {
    if (smsOptIn && !phoneNumber.trim()) {
      alert('Please enter a phone number for SMS notifications')
      return
    }

    setSaving(true)

    try {
      await supabase
        .from('users')
        .update({
          email_opt_in: emailOptIn,
          sms_opt_in: smsOptIn,
          phone_number: smsOptIn ? phoneNumber : null
        })
        .eq('id', user.id)

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Notification Preferences</h3>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        Choose how you'd like to receive updates about your weekly menus and orders.
      </p>

      {/* Email opt-in */}
      <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e0dbd1' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(e) => setEmailOptIn(e.target.checked)}
          />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#1B5E4E' }}>Email Notifications</span>
        </label>
        <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: '#999' }}>
          Receive emails when the weekly menu is available for ordering
        </p>
      </div>

      {/* SMS opt-in */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
          />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#1B5E4E' }}>Text Message Notifications</span>
        </label>
        <p style={{ margin: '6px 0 10px 28px', fontSize: '12px', color: '#999' }}>
          Receive text messages when the weekly menu is available for ordering
        </p>

        {smsOptIn && (
          <div style={{ marginLeft: '28px', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#1B5E4E' }}>
              Phone Number *
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              style={{ width: '100%', maxWidth: '300px', padding: '8px', border: '1px solid #e0dbd1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
        )}
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: '#1B5E4E',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && (
          <span style={{ color: '#2e7d32', fontSize: '13px', fontWeight: '500' }}>✓ Saved</span>
        )}
      </div>
    </div>
  )
}
