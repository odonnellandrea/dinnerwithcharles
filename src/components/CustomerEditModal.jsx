import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { nameColumns, namesFrom, isMissingNameColumns, withoutNameColumns } from '../lib/customerName'
import { DELIVERY_OPTIONS, parseDeliveryOptions, joinDeliveryOptions, hasDeliveryOption } from '../lib/deliveryOptions'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const PAYMENT_METHODS = ['Venmo', 'Zelle', 'Cash']

const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#1a441f', margin: '0 0 6px 0' }

// Admin editor for everything on a customer's card: name plus every request-to-join answer.
// fields: [[label, column], ...] in the order the form asks them.
export default function CustomerEditModal({ customer, fields, onClose, onSaved }) {
  const names = namesFrom(customer)
  const [firstName, setFirstName] = useState(names.firstName)
  const [lastName, setLastName] = useState(names.lastName)
  const [answers, setAnswers] = useState(() => Object.fromEntries(fields.map(([, column]) => [column, customer[column] == null ? '' : String(customer[column])])))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter a first and last name')
      return
    }
    setSaving(true)
    const changes = { ...nameColumns(firstName, lastName) }
    fields.forEach(([, column]) => { changes[column] = answers[column].trim() || null })
    // What is charged follows what was chosen here: messenger delivery adds the fee, anything else doesn't
    if ('messenger_delivery' in customer && fields.some(([, column]) => column === 'delivery_option')) {
      changes.messenger_delivery = hasDeliveryOption(answers.delivery_option, 'messenger')
    }
    let { error: updateError } = await supabase.from('users').update(changes).eq('id', customer.id)
    if (isMissingNameColumns(updateError)) {
      ({ error: updateError } = await supabase.from('users').update(withoutNameColumns(changes)).eq('id', customer.id))
    }
    setSaving(false)
    if (updateError) {
      setError('Failed to save: ' + updateError.message)
      return
    }
    onSaved()
  }

  const setAnswer = (column) => (e) => setAnswers(prev => ({ ...prev, [column]: e.target.value }))
  const longText = (column) => /instructions|allergies|restrictions|preferences|quirks|anything_else|cuisines|household/.test(column)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <form onSubmit={handleSave} style={{ background: 'white', padding: '28px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 style={{ color: '#1a441f', margin: '0 0 4px 0' }}>Edit Customer</h2>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '13px' }}>{customer.email}</p>

        {names.savedAs && (
          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
            Name on file: <strong style={{ color: '#1a441f' }}>{names.savedAs}</strong>. Enter it as first and last name.
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {fields.map(([label, column]) => (
          <div key={column} style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>{label}</label>
            {column === 'delivery_option' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
                {DELIVERY_OPTIONS.map(o => {
                  const chosen = parseDeliveryOptions(answers[column]); const checked = chosen.includes(o.value)
                  return (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => setAnswers(prev => ({ ...prev, [column]: joinDeliveryOptions(checked ? chosen.filter(v => v !== o.value) : [...chosen, o.value]) }))} />
                      {o.label}
                    </label>
                  )
                })}
              </div>
            ) : column === 'payment_method' ? (
              <select value={answers[column]} onChange={setAnswer(column)} style={inputStyle}>
                <option value="">—</option>
                {[...PAYMENT_METHODS, ...(answers[column] && !PAYMENT_METHODS.includes(answers[column]) ? [answers[column]] : [])].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : longText(column) ? (
              <textarea value={answers[column]} onChange={setAnswer(column)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            ) : (
              <input type="text" value={answers[column]} onChange={setAnswer(column)} style={inputStyle} />
            )}
          </div>
        ))}

        {error && <p style={{ color: '#c62828', fontSize: '13px', margin: '0 0 16px 0' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ flex: 1, padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
