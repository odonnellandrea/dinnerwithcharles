import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

// What each thing Resend can say about an email means, in plain words
const explain = (to, status) => {
  if (status === 'delivered') return { ok: true, text: `Resend delivered it to ${to}. If it isn't in your Gmail, the forwarding from ${to} is the problem: check spam, or set ADMIN_NOTIFY_EMAIL in Netlify to your Gmail address so it skips the forwarding.` }
  if (status === 'sent' || status === 'queued' || status === 'scheduled' || status === 'opened' || status === 'clicked') return { ok: true, text: `Resend accepted it for ${to} and is on its way. Check your inbox and spam in a minute.` }
  if (status === 'suppressed') return { ok: false, text: `Resend refused to deliver it because ${to} is on its suppression list, usually after an earlier bounce. Remove it from the suppressions in your Resend dashboard, or point ADMIN_NOTIFY_EMAIL at a different address.` }
  if (status === 'bounced') return { ok: false, text: `It bounced: ${to} rejected it. Check that the address exists and that its forwarding is set up, or point ADMIN_NOTIFY_EMAIL at a different address.` }
  if (status === 'delivery_delayed') return { ok: false, text: `Delivery to ${to} is delayed. Check again in a few minutes in the Resend Emails tab.` }
  if (status === 'complained') return { ok: false, text: `${to} marked it as spam, so Resend may stop sending to it. Point ADMIN_NOTIFY_EMAIL at a different address.` }
  if (status === 'failed' || status === 'canceled') return { ok: false, text: `Resend couldn't send it (${status}). Open the Emails tab in Resend to see the reason.` }
  return { ok: true, text: `Sent to ${to}, but Resend hasn't said what happened yet. Check the Emails tab in Resend.` }
}

// Admin-only: sends a sample "new order" email and reports what Resend did with it
export default function AdminEmailCheck() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const run = async () => {
    setSending(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'test_notice' })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ ok: false, text: `The test email failed${body.to ? ` (to ${body.to})` : ''}: ${body.error || res.status}` })
      } else {
        setResult(explain(body.to, body.status))
      }
    } catch (err) {
      setResult({ ok: false, text: 'The test email failed: ' + err.message })
    }
    setSending(false)
  }

  return (
    <div style={{ background: 'white', padding: '20px', marginBottom: '20px', border: '1px solid #e0dbd1' }}>
      <h3 style={{ color: '#1a441f', marginTop: 0, marginBottom: '8px' }}>Admin Email Check</h3>
      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
        Sends a sample "New order" email to the address that gets your order and join-request notices, then tells you what Resend did with it.
      </p>
      <button
        onClick={run}
        disabled={sending}
        style={{ padding: '10px 20px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: sending ? 'wait' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}
      >
        {sending ? 'Sending, this takes about 5 seconds...' : 'Send a test order email'}
      </button>
      {result && (
        <p style={{ margin: '14px 0 0 0', fontSize: '14px', lineHeight: 1.6, color: result.ok ? '#1a441f' : '#c62828' }}>
          {result.ok ? '✓ ' : '✗ '}{result.text}
        </p>
      )}
    </div>
  )
}
