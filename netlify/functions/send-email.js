import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { orderConfirmationEmail, reheatGuideEmail, approvedEmail } from '../emails/templates.js'

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
  // resend: admin asked to send the reheat email again, even if it already went out
  const { type, order_id: orderId, user_id: userId, resend: isResend = false } = payload || {}
  const siteUrl = process.env.URL || new URL(req.url).origin
  const resend = new Resend(process.env.RESEND_API_KEY)
  const deliver = async (to, message) => {
    const { data, error } = await resend.emails.send({ from: EMAIL_FROM, replyTo: EMAIL_REPLY_TO, to, subject: message.subject, html: message.html })
    return { id: data?.id, error }
  }

  // Welcome email when the admin approves a request to join
  if (type === 'approved') {
    if (user.email.toLowerCase() !== ADMIN_EMAIL) return json(403, { error: 'Admin only' })
    if (!userId) return json(400, { error: 'user_id is required' })
    const { data: profile, error: profileError } = await supabase.from('users').select('email, name, first_name, approval_status').eq('id', userId).single()
    if (profileError || !profile) return json(404, { error: 'Customer not found' })
    if (profile.approval_status !== 'approved') return json(409, { error: 'Customer is not approved' })
    const { id, error } = await deliver(profile.email, approvedEmail({ profile, siteUrl }))
    if (error) return json(502, { error: error.message })
    return json(200, { id })
  }

  if (!orderId) return json(400, { error: 'order_id is required' })

  const { data: rows, error: ordersError } = await supabase.from('Orders').select('*').eq('order_id', orderId)
  if (ordersError) return json(500, { error: ordersError.message })
  if (!rows?.length) return json(404, { error: 'Order not found' })

  const customerEmail = rows[0].email

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
    // Claim the send atomically so a double-click can't email twice (unless resending on purpose)
    let claim = supabase
      .from('Orders')
      .update({ reheat_email_sent_at: new Date().toISOString() })
      .eq('order_id', orderId)
    if (!isResend) claim = claim.is('reheat_email_sent_at', null)
    const { data: claimed, error: claimError } = await claim.select('order_id')
    if (claimError) return json(500, { error: claimError.message })
    if (!claimed?.length) return json(200, { skipped: 'already sent' })
    message = reheatGuideEmail({ rows, siteUrl })
  } else {
    return json(400, { error: `Unknown email type: ${type}` })
  }

  const { id, error } = await deliver(customerEmail, message)
  if (error) {
    // Undo the claim: empty again for a first send so marking delivered can retry, or the earlier send's time for a resend
    if (type === 'reheat_link') await supabase.from('Orders').update({ reheat_email_sent_at: rows[0].reheat_email_sent_at ?? null }).eq('order_id', orderId)
    return json(502, { error: error.message })
  }
  return json(200, { id })
}
