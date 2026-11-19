import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '../emails/templates.js'
import { EMAIL_CONSENT_TEXT, EMAIL_MARKETING_CONSENT_TEXT } from '../../src/lib/notificationConsent.js'

// Email preferences and unsubscribe, no sign-in needed. Linked from every marketing email.
//   GET  /.netlify/functions/unsubscribe?t=<token>  shows the customer's two email choices
//        (menu emails, news and offers). It never changes anything, because inbox link
//        scanners open every link in an email.
//   POST /.netlify/functions/unsubscribe?t=<token>  saves. The page's buttons post here, and so
//        do Gmail's and Yahoo's own Unsubscribe buttons (List-Unsubscribe-Post, RFC 8058),
//        which turn off all marketing email.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY

const GREEN = '#083525'
const GOLD = '#D4A373'
const CREAM = '#faf8f3'
const BORDER = '#e0dbd1'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function page({ siteUrl, title, body, status = 200 }) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} · Dinner with Charles</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${CREAM}; font-family: ${FONT}; color: #666666; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 56px 16px; }
    .header { background: ${GREEN}; border-bottom: 3px solid ${GOLD}; padding: 36px 24px; text-align: center; }
    .header img { width: 240px; max-width: 100%; height: auto; display: inline-block; }
    .card { background: #ffffff; border: 1px solid ${BORDER}; border-top: 0; padding: 48px 44px; }
    .eyebrow { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${GOLD}; font-weight: 600; }
    h1 { margin: 0 0 20px; font-size: 26px; line-height: 1.25; font-weight: 600; color: ${GREEN}; }
    p { margin: 0 0 16px; font-size: 16px; line-height: 1.7; }
    .note { font-size: 13px; color: #999999; margin-top: 32px; }
    button, .btn { display: inline-block; margin-top: 16px; padding: 16px 32px; border: 0; border-radius: 0; background: ${GREEN}; color: ${CREAM}; font: 600 14px/1.2 ${FONT}; letter-spacing: 0.06em; text-decoration: none; cursor: pointer; }
    a { color: ${GREEN}; }
    form { margin: 0; }
    .choice { display: flex; gap: 12px; align-items: flex-start; padding: 16px 0; border-bottom: 1px solid ${BORDER}; font-size: 15px; line-height: 1.6; color: #333333; cursor: pointer; }
    .choice:first-of-type { border-top: 1px solid ${BORDER}; margin-top: 8px; }
    .choice input { width: 18px; height: 18px; margin: 2px 0 0; flex-shrink: 0; accent-color: ${GREEN}; cursor: pointer; }
    form button[type=submit] { margin-top: 24px; }
    .all button.link { margin-top: 20px; padding: 0; background: none; color: ${GREEN}; font: 400 14px/1.6 ${FONT}; letter-spacing: 0; text-decoration: underline; }
    @media (max-width: 480px) {
      .wrap { padding: 28px 12px; }
      .header { padding: 28px 22px; }
      .header img { width: 190px; }
      .card { padding: 36px 22px; }
      h1 { font-size: 23px; }
      button, .btn { display: block; width: 100%; text-align: center; }
      .all button.link { display: inline; width: auto; text-align: left; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><a href="${siteUrl}"><img src="${siteUrl}/Gold%20Horizontal%20Logo.png" alt="Dinner with Charles"></a></div>
    <div class="card">${body}</div>
  </div>
</body>
</html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
}

const signInNote = (siteUrl) =>
  `<p class="note">Order confirmations and delivery emails always arrive, whatever you choose here. To change your text messages, <a href="${siteUrl}">sign in</a> and open Settings.</p>`

const replyNote = 'Just reply to any of our emails and we&rsquo;ll update your choices for you, or sign in and change them in Settings.'

const choice = (name, checked, label) => `
  <label class="choice"><input type="checkbox" name="${name}" value="1"${checked ? ' checked' : ''}><span>${label}</span></label>`

export default async (req) => {
  const url = new URL(req.url)
  const siteUrl = process.env.URL || url.origin
  const token = url.searchParams.get('t') || ''

  if (!UUID.test(token)) {
    return page({ siteUrl, status: 400, title: 'Link not recognized', body: `
      <p class="eyebrow">Email preferences</p>
      <h1>This link isn&rsquo;t working.</h1>
      <p>It may have been cut short when it was copied. ${replyNote}</p>
      <a class="btn" href="${siteUrl}">Go to Dinner with Charles</a>` })
  }
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const failed = (error) => {
    console.error('email preferences:', error.message)
    return page({ siteUrl, status: 500, title: 'Something went wrong', body: `
      <p class="eyebrow">Email preferences</p>
      <h1>We couldn&rsquo;t reach your preferences just now.</h1>
      <p>Please try again in a minute. ${replyNote}</p>` })
  }
  const notFound = () => page({ siteUrl, status: 404, title: 'Link not recognized', body: `
    <p class="eyebrow">Email preferences</p>
    <h1>We couldn&rsquo;t find your preferences.</h1>
    <p>${replyNote}</p>` })

  // GET only reads: it shows the current choices and never changes anything
  if (req.method === 'GET') {
    const { data: prefs, error } = await supabase.rpc('email_prefs_for_token', { p_token: token })
    if (error) return failed(error)
    if (!prefs) return notFound()
    const name = String(prefs.first_name || '').trim().split(/\s+/)[0]
    return page({ siteUrl, title: 'Email preferences', body: `
      <p class="eyebrow">Email preferences</p>
      <h1>${name ? `Your emails, ${escapeHtml(name)}.` : 'Your emails.'}</h1>
      <p>Choose which emails you&rsquo;d like from us.</p>
      <form method="post" action="?t=${encodeURIComponent(token)}">
        <input type="hidden" name="action" value="save">
        ${choice('menu', prefs.menu, EMAIL_CONSENT_TEXT)}
        ${choice('marketing', prefs.marketing, EMAIL_MARKETING_CONSENT_TEXT)}
        <button type="submit">Save my choices</button>
      </form>
      <form method="post" action="?t=${encodeURIComponent(token)}" class="all">
        <input type="hidden" name="action" value="all">
        <button type="submit" class="link">Unsubscribe from all marketing emails</button>
      </form>
      ${signInNote(siteUrl)}` })
  }

  // POST saves. The Save button sends the two boxes; "Unsubscribe from all", and the
  // one-click Unsubscribe buttons in Gmail and Yahoo (body "List-Unsubscribe=One-Click"),
  // turn both off.
  const form = new URLSearchParams(await req.text().catch(() => ''))
  const saving = form.get('action') === 'save'
  const menu = saving && form.get('menu') === '1'
  const marketing = saving && form.get('marketing') === '1'
  const { data: found, error } = await supabase.rpc('set_email_prefs_for_token', { p_token: token, p_menu: menu, p_marketing: marketing })
  if (error) return failed(error)
  if (!found) return notFound()

  const back = `<p><a href="?t=${encodeURIComponent(token)}">Change your choices</a></p>`
  if (!menu && !marketing) {
    return page({ siteUrl, title: 'Unsubscribed', body: `
      <p class="eyebrow">Unsubscribed</p>
      <h1>You&rsquo;re unsubscribed from marketing emails.</h1>
      <p>We won&rsquo;t send menu emails or news and offers anymore.</p>
      ${back}
      ${signInNote(siteUrl)}` })
  }
  const getting = [menu && 'an email when the weekly menu goes live', marketing && 'occasional news and offers'].filter(Boolean).join(', and ')
  return page({ siteUrl, title: 'Saved', body: `
    <p class="eyebrow">Saved</p>
    <h1>Your choices are saved.</h1>
    <p>You&rsquo;ll get ${getting}.</p>
    ${back}
    ${signInNote(siteUrl)}` })
}
