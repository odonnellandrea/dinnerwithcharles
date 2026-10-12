import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { orderConfirmationEmail } from '../emails/templates.js'

// Netlify env vars: RESEND_API_KEY (required), EMAIL_FROM (optional).
// Supabase URL/key reuse the VITE_ vars the site is built with.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'Dinner with Charles <onboarding@resend.dev>'

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
  } else {
    return json(400, { error: `Unknown email type: ${type}` })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to: customerEmail, subject: message.subject, html: message.html })
  if (error) return json(502, { error: error.message })
  return json(200, { id: data?.id })
}
