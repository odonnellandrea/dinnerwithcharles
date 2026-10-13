import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import NotificationChoices from './NotificationChoices'
import { normalizeUsPhone, formatUsPhone, PREFS_SET_COLUMN } from '../lib/notificationConsent'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

// One-time ask for customers who joined before the opt-ins existed. Both boxes start
// unchecked; saving with neither checked is a valid answer and is never asked again.
export default function StayInTouchPrompt({ user, initialPhone, onDone, onSkip }) {
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState(formatUsPhone(initialPhone))
  const [phoneError, setPhoneError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    if (field === 'emailOptIn') setEmailOptIn(value)
    if (field === 'smsOptIn') setSmsOptIn(value)
    if (field === 'phoneNumber') setPhoneNumber(value)
    setPhoneError('')
  }

  const handleSave = async () => {
    const normalizedPhone = normalizeUsPhone(phoneNumber)
    if (smsOptIn && !normalizedPhone) {
      setPhoneError('Enter a valid 10-digit US mobile number, or uncheck the text message box.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        email_opt_in: emailOptIn === true,
        sms_opt_in: smsOptIn === true,
        phone_number: smsOptIn ? normalizedPhone : null,
        [PREFS_SET_COLUMN]: new Date().toISOString()
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      alert("Sorry, we couldn't save your choices. Please try again.")
      return
    }
    onDone()
  }

  return (
    <div style={{ background: 'white', padding: '32px', border: '1px solid #e0dbd1', maxWidth: '640px', margin: '0 auto' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>One quick question</p>
      <h2 style={{ color: '#1a441f', margin: '0 0 12px 0', fontSize: '24px' }}>How should we stay in touch?</h2>
      <p style={{ margin: 0, fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
        We've added email and text updates. Choose either, both or neither. You can change this anytime in Settings.
      </p>

      <NotificationChoices
        emailOptIn={emailOptIn}
        smsOptIn={smsOptIn}
        phoneNumber={phoneNumber}
        phoneError={phoneError}
        onChange={handleChange}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginTop: '24px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '14px 28px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '600', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save my choices'}
        </button>
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', padding: 0, color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
