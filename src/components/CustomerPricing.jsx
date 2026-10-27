import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BASE_PRICE } from '../lib/pricing'

// What this customer pays for the base package (friends and family may get a lower price) and
// whether their orders are complimentary. Applies to their next order.
export default function CustomerPricing({ customer, onSaved }) {
  const saved = Number.isFinite(Number(customer.base_price)) && customer.base_price !== null ? Number(customer.base_price) : BASE_PRICE
  const [value, setValue] = useState(String(saved))
  const [complimentary, setComplimentary] = useState(customer.complimentary === true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null)

  useEffect(() => { setValue(String(saved)); setComplimentary(customer.complimentary === true) }, [saved, customer.complimentary])

  const price = value.trim() === '' ? NaN : Number(value)
  const valid = Number.isFinite(price) && price >= 0
  const dirty = valid && (price !== saved || complimentary !== (customer.complimentary === true))

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    setNote(null)
    const { error } = await supabase.from('users').update({ base_price: price, complimentary }).eq('id', customer.id)
    setSaving(false)
    if (error) {
      setNote({ ok: false, text: /base_price|complimentary/.test(error.message || '') ? 'Run supabase/migrations/20261027_admin_tools.sql first.' : 'Failed to save: ' + error.message })
      return
    }
    setNote({ ok: true, text: complimentary ? '✓ Saved. Their orders are complimentary.' : `✓ Saved. Base package $${price.toFixed(2)} on their next order.` })
    onSaved?.({ base_price: price, complimentary })
  }

  return (
    <div style={{ margin: '8px 0 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 12px', fontSize: '12px', color: '#1a441f', flexWrap: 'wrap' }}>
        <label htmlFor={`price-${customer.id}`}>Base package $</label>
        <input
          id={`price-${customer.id}`}
          type="number"
          min="0"
          step="5"
          inputMode="decimal"
          value={value}
          disabled={complimentary}
          onChange={(e) => { setValue(e.target.value); setNote(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          style={{ width: '70px', padding: '4px 6px', border: '1px solid #e0dbd1', fontFamily: 'inherit', fontSize: '12px', opacity: complimentary ? 0.5 : 1 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={complimentary} onChange={(e) => { setComplimentary(e.target.checked); setNote(null) }} />
          Complimentary (no charge)
        </label>
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
