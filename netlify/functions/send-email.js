import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { orderConfirmationEmail, reheatGuideEmail } from '../emails/templates.js'

// Netlify env vars: RESEND_API_KEY (required), EMAIL_FROM and EMAIL_REPLY_TO (optional).
// Supabase URL/key reuse the VITE_ vars the site is built with.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const ADMIN_EMAIL = 'admin@dinnerwithcharles.com'
const EMAIL_FROM = process.env.EMAIL_FROM || 'Dinner with Charles <onboarding@resend.dev>'
// Customer replies go here; info@ forwards to the Dinner with Charles Gmail
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'info@dinnerwithcharles.com'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!process.env.RESEND_API_KEY) return json(500, { error: 'RESEND_API_KEY is not set' })

  // Only signed-in users can trigger email, and only about orders they can see.
  // Queries run with the caller's token so Supabase RLS applies.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  })
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Invalid session' })

  let payload
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const { type, order_id: orderId } = payload || {}
  if (!orderId) return json(400, { error: 'order_id is required' })

  const { data: rows, error: ordersError } = await supabase.from('Orders').select('*').eq('order_id', orderId)
  if (ordersError) return json(500, { error: ordersError.message })
  if (!rows?.length) return json(404, { error: 'Order not found' })

  const customerEmail = rows[0].email
  const siteUrl = process.env.URL || new URL(req.url).origin

  let message
  if (type === 'order_confirmation') {
    if (customerEmail.toLowerCase() !== user.email.toLowerCase()) return json(403, { error: 'Not your order' })
    message = orderConfirmationEmail({ rows, siteUrl })
  } else if (type === 'reheat_link') {
    if (user.email.toLowerCase() !== ADMIN_EMAIL) return json(403, { error: 'Admin only' })
    if (!('reheat_email_sent_at' in rows[0])) {
      return json(500, { error: 'Orders.reheat_email_sent_at is missing; run supabase/migrations/20261012_reheat_email_sent_at.sql' })
    }
    // Only the first time an order is marked delivered
    if (rows.some(r => r.status !== 'delivered')) return json(409, { error: 'Order is not marked delivered' })
    // Claim the send atomically so a double-click can't email twice
    const { data: claimed, error: claimError } = await supabase
      .from('Orders')
      .update({ reheat_email_sent_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('reheat_email_sent_at', null)
      .select('order_id')
    if (claimError) return json(500, { error: claimError.message })
    if (!claimed?.length) return json(200, { skipped: 'already sent' })
    message = reheatGuideEmail({ rows, siteUrl })
  } else {
    return json(400, { error: `Unknown email type: ${type}` })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, replyTo: EMAIL_REPLY_TO, to: customerEmail, subject: message.subject, html: message.html })
  if (error) {
    // Release the claim so marking delivered again can retry
    if (type === 'reheat_link') await supabase.from('Orders').update({ reheat_email_sent_at: null }).eq('order_id', orderId)
    return json(502, { error: error.message })
  }
  return json(200, { id: data?.id })
}
