import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { messengerFeeFor } from '../lib/pricing'

// The messenger fee on a customer's card, with a Save button so it's clear when it has been
// saved. It applies to that customer's next order; orders already placed keep what they were.
export default function MessengerFeeEditor({ customer, onSaved }) {
  const saved = messengerFeeFor({ messenger_delivery: true, messenger_fee: customer.messenger_fee })
  const [value, setValue] = useState(String(saved))
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null) // { ok, text }

  // Follow the saved value if the card is reloaded
  useEffect(() => { setValue(String(saved)) }, [saved])

  const fee = value.trim() === '' ? NaN : Number(value)
  const valid = Number.isFinite(fee) && fee >= 0
  const dirty = valid && fee !== saved

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    setNote(null)
    const { error } = await supabase.from('users').update({ messenger_fee: fee }).eq('id', customer.id)
    setSaving(false)
    if (error) {
      setNote({ ok: false, text: 'Failed to save: ' + error.message })
      return
    }
    setNote({ ok: true, text: `✓ Saved. ${customer.name || 'This customer'} pays $${fee.toFixed(2)} on their next order.` })
    onSaved?.(fee)
  }

  return (
    <div style={{ margin: '6px 0 0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1a441f', flexWrap: 'wrap' }}>
        <label htmlFor={`fee-${customer.id}`}>Messenger fee $</label>
        <input
          id={`fee-${customer.id}`}
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          value={value}
          onChange={(e) => { setValue(e.target.value); setNote(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          style={{ width: '70px', padding: '4px 6px', border: '1px solid #e0dbd1', fontFamily: 'inherit', fontSize: '12px' }}
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          style={{ padding: '4px 12px', background: dirty ? '#1a441f' : 'white', color: dirty ? '#faf8f3' : '#999', border: '1px solid ' + (dirty ? '#1a441f' : '#e0dbd1'), cursor: dirty && !saving ? 'pointer' : 'default', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {note && <p style={{ margin: '6px 0 0', fontSize: '12px', color: note.ok ? '#1a441f' : '#c62828' }}>{note.text}</p>}
    </div>
  )
}
