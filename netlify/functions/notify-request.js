import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { joinRequestEmail } from '../emails/templates.js'

// POST { user_id } from the join form right after a request is saved. Emails the admin the
// details of the request. Needs no sign-in (a new applicant may not have a session yet):
// the claim_join_notice database function only releases a request made in the last 15
// minutes, once, so a random id gets nothing.
// Netlify env vars: RESEND_API_KEY, EMAIL_FROM, and ADMIN_NOTIFY_EMAIL (default info@dinnerwithcharles.com).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'Dinner with Charles <onboarding@resend.dev>'
const NOTIFY_TO = process.env.ADMIN_NOTIFY_EMAIL || 'info@dinnerwithcharles.com'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!process.env.RESEND_API_KEY) return json(500, { error: 'RESEND_API_KEY is not set' })
  let payload
  try { payload = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const userId = payload?.user_id
  if (!UUID.test(userId || '')) return json(400, { error: 'user_id is required' })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: request, error } = await supabase.rpc('claim_join_notice', { uid: userId })
  if (error) {
    if (/claim_join_notice|admin_notified_at/.test(error.message || '')) {
      return json(500, { error: 'Run supabase/migrations/20261021_join_notice.sql in the Supabase SQL editor' })
    }
    return json(500, { error: error.message })
  }
  if (!request) return json(200, { skipped: 'nothing to send' })

  const siteUrl = process.env.URL || new URL(req.url).origin
  const message = joinRequestEmail({ request, siteUrl })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error: sendError } = await resend.emails.send({ from: EMAIL_FROM, to: NOTIFY_TO, replyTo: request.email, subject: message.subject, html: message.html })
  if (sendError) {
    console.error('Join request email failed:', sendError)
    return json(502, { error: sendError.message })
  }
  return json(200, { id: data?.id })
}
