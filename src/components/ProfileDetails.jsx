import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { normalizeUsPhone, formatUsPhone } from '../lib/notificationConsent'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const inputStyle = { width: '100%', padding: '12px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#1a441f', margin: '0 0 6px 0' }

// Name, delivery address and phone, editable by the customer. onSaved gets the new name
// so the order form can use it right away.
export default function ProfileDetails({ user, onSaved }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchDetails()
  }, [])

  const fetchDetails = async () => {
    const { data } = await supabase
      .from('users')
      .select('name, delivery_address, delivery_phone')
      .eq('id', user.id)
      .single()
    if (data) {
      setName(data.name || '')
      setAddress(data.delivery_address || '')
      setPhone(formatUsPhone(data.delivery_phone))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    const normalizedPhone = phone.trim() ? normalizeUsPhone(phone) : null
    if (phone.trim() && !normalizedPhone) {
      setError('Enter a valid 10-digit US phone number, or leave it blank')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase
      .from('users')
      .update({ name: name.trim(), delivery_address: address.trim(), delivery_phone: normalizedPhone })
      .eq('id', user.id)
    setSaving(false)
    if (updateError) {
      setError('Failed to save: ' + updateError.message)
      return
    }
    setPhone(formatUsPhone(normalizedPhone))
    setSaved(true)
    onSaved?.(name.trim())
  }

  const edit = (setter) => (e) => { setter(e.target.value); setSaved(false); setError('') }

  return (
    <form onSubmit={handleSave} style={{ background: 'white', padding: '24px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1a441f', margin: '0 0 6px 0' }}>Your Details</h3>
      <p style={{ fontSize: '13px', color: '#666', margin: '0 0 20px 0' }}>
        We use these for your deliveries.
      </p>

      <label style={labelStyle}>Name</label>
      <input type="text" value={name} onChange={edit(setName)} autoComplete="name" style={{ ...inputStyle, marginBottom: '16px' }} />

      <label style={labelStyle}>Delivery address</label>
      <input type="text" value={address} onChange={edit(setAddress)} autoComplete="street-address" style={{ ...inputStyle, marginBottom: '16px' }} />

      <label style={labelStyle}>Phone for delivery day</label>
      <input type="tel" value={phone} onChange={edit(setPhone)} placeholder="(555) 123-4567" autoComplete="tel" style={{ ...inputStyle, marginBottom: '16px' }} />

      {error && <p style={{ color: '#c62828', fontSize: '13px', margin: '0 0 16px 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '12px 24px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : 'Save Details'}
        </button>
        {saved && <span style={{ color: '#1a441f', fontSize: '13px', fontWeight: '500' }}>✓ Saved</span>}
      </div>
    </form>
  )
}
