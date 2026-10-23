import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import NotificationChoices from './NotificationChoices'
import { normalizeUsPhone, formatUsPhone, PREFS_SET_COLUMN, isMissingPrefsColumn, withoutPrefsColumn } from '../lib/notificationConsent'

export default function NotificationSettings({ user }) {
  // Show exactly what's saved: anything other than true counts as not opted in
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')
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
      setEmailOptIn(data.email_opt_in === true)
      setSmsOptIn(data.sms_opt_in === true)
      setPhoneNumber(formatUsPhone(data.phone_number))
    }
  }

  const handleChange = (field, value) => {
    if (field === 'emailOptIn') setEmailOptIn(value)
    if (field === 'smsOptIn') setSmsOptIn(value)
    if (field === 'phoneNumber') setPhoneNumber(value)
    setPhoneError('')
    setSaved(false)
  }

  const handleSave = async () => {
    const normalizedPhone = normalizeUsPhone(phoneNumber)
    if (smsOptIn && !normalizedPhone) {
      setPhoneError('Enter a valid 10-digit US mobile number, or uncheck the text message box.')
      return
    }

    setSaving(true)

    try {
      const changes = {
        email_opt_in: emailOptIn === true,
        sms_opt_in: smsOptIn === true,
        phone_number: smsOptIn ? normalizedPhone : null,
        [PREFS_SET_COLUMN]: new Date().toISOString()
      }
      let { error } = await supabase.from('users').update(changes).eq('id', user.id)
      if (isMissingPrefsColumn(error)) {
        ({ error } = await supabase.from('users').update(withoutPrefsColumn(changes)).eq('id', user.id))
      }
      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'white', padding: '24px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1a441f', margin: '0 0 6px 0' }}>Notification Preferences</h3>
      <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
        Choose either, both or neither. You can change these anytime.
      </p>

      <NotificationChoices
        emailOptIn={emailOptIn}
        smsOptIn={smsOptIn}
        phoneNumber={phoneNumber}
        phoneError={phoneError}
        onChange={handleChange}
      />

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            background: '#1a441f',
            color: '#faf8f3',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'inherit',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && (
          <span style={{ color: '#1a441f', fontSize: '13px', fontWeight: '500' }}>✓ Saved</span>
        )}
      </div>
    </div>
  )
}
