import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeUsPhone, formatUsPhone } from '../lib/notificationConsent'
import { nameColumns, namesFrom, joinName, isMissingNameColumns, withoutNameColumns } from '../lib/customerName'
import { DELIVERY_OPTIONS, parseDeliveryOptions, joinDeliveryOptions } from '../lib/deliveryOptions'

const inputStyle = { width: '100%', padding: '12px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#1a441f', margin: '0 0 6px 0' }

// Name, delivery address, phone and delivery preferences, editable by the customer.
// (The messenger fee itself stays admin-controlled.) onSaved gets the new name
// so the order form can use it right away.
export default function ProfileDetails({ user, onSaved }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [savedAs, setSavedAs] = useState('') // full name from before first/last existed
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [deliveryOption, setDeliveryOption] = useState('')
  const [hasDeliveryColumn, setHasDeliveryColumn] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchDetails()
  }, [])

  const fetchDetails = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    if (data) {
      const names = namesFrom(data)
      setFirstName(names.firstName)
      setLastName(names.lastName)
      setSavedAs(names.savedAs)
      setAddress(data.delivery_address || '')
      setPhone(formatUsPhone(data.delivery_phone))
      setDeliveryOption(data.delivery_option || '')
      setHasDeliveryColumn('delivery_option' in data)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name')
      return
    }
    const normalizedPhone = phone.trim() ? normalizeUsPhone(phone) : null
    if (phone.trim() && !normalizedPhone) {
      setError('Enter a valid 10-digit US phone number, or leave it blank')
      return
    }

    if (hasDeliveryColumn && !deliveryOption) {
      setError('Please tick at least one way to get your order')
      return
    }

    setSaving(true)
    const changes = { ...nameColumns(firstName, lastName), delivery_address: address.trim(), delivery_phone: normalizedPhone, ...(hasDeliveryColumn ? { delivery_option: deliveryOption } : {}) }
    let { error: updateError } = await supabase.from('users').update(changes).eq('id', user.id)
    if (isMissingNameColumns(updateError)) {
      ({ error: updateError } = await supabase.from('users').update(withoutNameColumns(changes)).eq('id', user.id))
    }
    setSaving(false)
    if (updateError) {
      setError('Failed to save: ' + updateError.message)
      return
    }
    setPhone(formatUsPhone(normalizedPhone))
    setSavedAs('')
    setSaved(true)
    onSaved?.(joinName(firstName, lastName))
  }

  const edit = (setter) => (e) => { setter(e.target.value); setSaved(false); setError('') }

  return (
    <form onSubmit={handleSave} style={{ background: 'white', padding: '24px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1a441f', margin: '0 0 6px 0' }}>Your Details</h3>
      <p style={{ fontSize: '13px', color: '#666', margin: '0 0 20px 0' }}>
        We use these for your deliveries.
      </p>

      {savedAs && (
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
          We have your name as <strong style={{ color: '#1a441f' }}>{savedAs}</strong>. Please enter it as first and last name below.
        </p>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>First name</label>
          <input type="text" value={firstName} onChange={edit(setFirstName)} autoComplete="given-name" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Last name</label>
          <input type="text" value={lastName} onChange={edit(setLastName)} autoComplete="family-name" style={inputStyle} />
        </div>
      </div>

      <label style={labelStyle}>Delivery address</label>
      <input type="text" value={address} onChange={edit(setAddress)} autoComplete="street-address" style={{ ...inputStyle, marginBottom: '16px' }} />

      <label style={labelStyle}>Phone for delivery day</label>
      <input type="tel" value={phone} onChange={edit(setPhone)} placeholder="(555) 123-4567" autoComplete="tel" style={{ ...inputStyle, marginBottom: '16px' }} />

      {hasDeliveryColumn && (
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>How would you like to get your order? <span style={{ fontWeight: '400', color: '#999' }}>Tick all that work for you.</span></label>
          {DELIVERY_OPTIONS.map(o => {
            const chosen = parseDeliveryOptions(deliveryOption)
            const checked = chosen.includes(o.value)
            return (
              <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '6px 0', fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => { setDeliveryOption(joinDeliveryOptions(checked ? chosen.filter(v => v !== o.value) : [...chosen, o.value])); setSaved(false); setError('') }}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <span>{o.label}{o.hint ? <span style={{ color: '#999' }}> ({o.hint})</span> : null}</span>
              </label>
            )
          })}
        </div>
      )}

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
