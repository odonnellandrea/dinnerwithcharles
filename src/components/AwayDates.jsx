import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatRange, upcoming, todayIso } from '../lib/awayDates'

const inputStyle = { padding: '10px 12px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px', width: '100%' }
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#1a441f', margin: '0 0 6px 0' }

// "We're away from ... to ...": as many ranges as they like. Nothing is held back because of
// it; it just tells the kitchen not to expect an order those weeks.
export default function AwayDates({ user }) {
  const [ranges, setRanges] = useState([])
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [installed, setInstalled] = useState(true)

  const load = async () => {
    const { data, error: loadError } = await supabase.from('away_dates').select('*').eq('user_id', user.id).order('starts_on')
    if (loadError) { setInstalled(!/away_dates/.test(loadError.message || '')); return }
    setRanges(upcoming(data || []))
  }
  useEffect(() => { load() }, [user.id])

  const add = async (e) => {
    e.preventDefault()
    setError('')
    if (!starts || !ends) { setError('Pick a first and last day.'); return }
    if (ends < starts) { setError('The last day is before the first day.'); return }
    if (ends < todayIso()) { setError('Those dates have already passed.'); return }
    setSaving(true)
    const { error: insertError } = await supabase.from('away_dates').insert({ user_id: user.id, email: user.email, starts_on: starts, ends_on: ends, note: note.trim() })
    setSaving(false)
    if (insertError) { setError("Sorry, we couldn't save that. Please try again."); return }
    setStarts(''); setEnds(''); setNote('')
    load()
  }

  const remove = async (id) => {
    const { error: deleteError } = await supabase.from('away_dates').delete().eq('id', id)
    if (deleteError) setError("Sorry, we couldn't remove that. Please try again.")
    load()
  }

  if (!installed) return null

  return (
    <div style={{ background: 'white', padding: '24px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1a441f', margin: '0 0 6px 0' }}>Away dates</h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666', lineHeight: 1.6 }}>
        Travelling, or taking a few weeks off? Tell us when, and we won't expect an order. You'll still hear about each week's menu, and you can order any week you're home.
      </p>

      {ranges.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 20px 0', padding: 0 }}>
          {ranges.map(r => (
            <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: '1px solid #f0ece3' }}>
              <span style={{ fontSize: '14px', color: '#333' }}>
                <strong style={{ color: '#1a441f' }}>{formatRange(r)}</strong>{r.note && <span style={{ color: '#666' }}> · {r.note}</span>}
              </span>
              <button type="button" onClick={() => remove(r.id)} aria-label={`Remove ${formatRange(r)}`} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px', fontFamily: 'inherit' }}>✕</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="awayStart" style={labelStyle}>First day away</label>
            <input id="awayStart" type="date" value={starts} min={todayIso()} onChange={(e) => { setStarts(e.target.value); if (!ends || ends < e.target.value) setEnds(e.target.value) }} style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="awayEnd" style={labelStyle}>Last day away</label>
            <input id="awayEnd" type="date" value={ends} min={starts || todayIso()} onChange={(e) => setEnds(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <label htmlFor="awayNote" style={labelStyle}>Note (optional)</label>
          <input id="awayNote" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Thanksgiving with family" style={inputStyle} />
        </div>
        {error && <p style={{ color: '#c62828', fontSize: '13px', margin: '12px 0 0 0' }}>{error}</p>}
        <button type="submit" disabled={saving} style={{ marginTop: '14px', padding: '10px 20px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}>
          {saving ? 'Saving...' : ranges.length ? 'Add more dates' : 'Add dates'}
        </button>
      </form>
    </div>
  )
}
