import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

// The answers customers gave to the survey question for one delivery date
export default function SurveyResponses({ deliveryDate: currentDate, refreshKey }) {
  // Starts on the delivery date being set up; change it to read another week's answers
  const [deliveryDate, setDeliveryDate] = useState(currentDate)
  useEffect(() => { setDeliveryDate(currentDate) }, [currentDate])
  const [question, setQuestion] = useState('')
  const [responses, setResponses] = useState([])
  const [status, setStatus] = useState('Loading...')

  const load = useCallback(async () => {
    if (!deliveryDate) { setStatus('Pick a delivery date.'); return }
    setStatus('Loading...')
    const { data: survey, error: surveyError } = await supabase.from('surveys').select('id, question').eq('delivery_date', deliveryDate).maybeSingle()
    if (surveyError) { setStatus('Could not load the survey: ' + surveyError.message); return }
    if (!survey) { setQuestion(''); setResponses([]); setStatus('No survey question has been saved for this date yet.'); return }
    setQuestion(survey.question)

    const { data: rows, error } = await supabase.from('survey_responses').select('*').eq('survey_id', survey.id)
    if (error) { setStatus('Could not load the responses: ' + error.message); return }
    const emails = [...new Set((rows || []).map(r => String(r.user_email || '').toLowerCase()).filter(Boolean))]
    const { data: people } = emails.length ? await supabase.from('users').select('email, name, first_name, last_name').in('email', emails) : { data: [] }
    const nameOf = Object.fromEntries((people || []).map(p => [String(p.email).toLowerCase(), p.name || [p.first_name, p.last_name].filter(Boolean).join(' ')]))
    const sorted = [...(rows || [])]
      .map(r => ({ ...r, who: nameOf[String(r.user_email || '').toLowerCase()] || '' }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    setResponses(sorted)
    setStatus('')
  }, [deliveryDate])

  useEffect(() => { load() }, [load, refreshKey])

  return (
    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e0dbd1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#1a441f', fontSize: '14px' }}>
          Responses{!status && ` (${responses.length})`}
        </h4>
        <button
          onClick={load}
          style={{ padding: '4px 12px', background: 'white', color: '#1a441f', border: '1px solid #1a441f', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
        >
          Refresh
        </button>
      </div>
      <label style={{ display: 'block', margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#1a441f' }}>Delivery date</label>
      <input
        type="date"
        value={deliveryDate}
        onChange={(e) => setDeliveryDate(e.target.value)}
        style={{ padding: '6px 10px', border: '1px solid #e0dbd1', marginBottom: '12px', fontFamily: 'inherit' }}
      />
      {status && <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{status}</p>}
      {!status && question && <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>"{question}"</p>}
      {!status && responses.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>No responses yet.</p>}
      {responses.map(r => (
        <div key={r.id ?? `${r.user_email}-${r.created_at}`} style={{ padding: '10px 0', borderTop: '1px solid #f0ece3' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.response}</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
            {r.who || r.user_email}{r.who && ` · ${r.user_email}`}
            {r.created_at && ` · ${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
        </div>
      ))}
    </div>
  )
}
