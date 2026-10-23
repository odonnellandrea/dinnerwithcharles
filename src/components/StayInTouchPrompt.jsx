import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import NotificationChoices from './NotificationChoices'
import { normalizeUsPhone, formatUsPhone, PREFS_SET_COLUMN, isMissingPrefsColumn, withoutPrefsColumn } from '../lib/notificationConsent'

// Asked exactly once, for customers who joined before the opt-ins existed. It's marked as
// asked as soon as it appears, so saving, skipping or just leaving all end it for good;
// after that, choices are changed only in Settings.
// Email starts off: their old "yes" came from a column default, not a choice. Text was
// never on by default, so an existing text opt-in was their own choice and is kept.
export default function StayInTouchPrompt({ user, initialPhone, initialSmsOptIn, onDone }) {
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn === true)
  const markedAsked = useRef(null)

  useEffect(() => {
    // .then() sends it now: Supabase queries don't run until something awaits them
    markedAsked.current = supabase
      .from('users')
      .update({ email_opt_in: false, [PREFS_SET_COLUMN]: new Date().toISOString() })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('Could not record opt-in prompt as asked:', error)
      })
  }, [])
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
    await markedAsked.current // so the "asked" write can never land after their choice
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
    setSaving(false)
    if (error) {
      console.error('Could not save notification choices:', error)
      alert("Sorry, we couldn't save your choices. Please try again.\n\n(" + error.message + ")")
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
          onClick={onDone}
          style={{ background: 'none', border: 'none', padding: 0, color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
