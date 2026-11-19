import { createClient } from '@supabase/supabase-js'
import { escapeHtml } from '../emails/templates.js'

// Unsubscribe from menu announcement emails, no sign-in needed.
//   GET  /.netlify/functions/unsubscribe?t=<token>  shows a page with a confirm button. It never
//        unsubscribes by itself, because inbox link scanners open every link in an email.
//   POST /.netlify/functions/unsubscribe?t=<token>  unsubscribes. The confirm button posts here,
//        and so do Gmail's and Yahoo's own Unsubscribe buttons (List-Unsubscribe-Post, RFC 8058).
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
    @media (max-width: 480px) {
      .wrap { padding: 28px 12px; }
      .header { padding: 28px 22px; }
      .header img { width: 190px; }
      .card { padding: 36px 22px; }
      h1 { font-size: 23px; }
      button, .btn { display: block; width: 100%; text-align: center; }
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
  `<p class="note">Order confirmations and delivery emails still arrive as usual. Changed your mind? <a href="${siteUrl}">Sign in</a> and turn menu emails back on in Settings.</p>`

export default async (req) => {
  const url = new URL(req.url)
  const siteUrl = process.env.URL || url.origin
  const token = url.searchParams.get('t') || ''

  if (!UUID.test(token)) {
    return page({ siteUrl, status: 400, title: 'Link not recognized', body: `
      <p class="eyebrow">Unsubscribe</p>
      <h1>This link isn't working.</h1>
      <p>It may have been cut short when it was copied. Just reply to any of our emails and we'll take you off the list, or sign in and change your choices in Settings.</p>
      <a class="btn" href="${siteUrl}">Go to Dinner with Charles</a>` })
  }

  if (req.method === 'GET') {
    return page({ siteUrl, title: 'Unsubscribe', body: `
      <p class="eyebrow">Unsubscribe</p>
      <h1>Stop the weekly menu emails?</h1>
      <p>You'll no longer get an email when the new menu goes live.</p>
      <form method="post" action="?t=${encodeURIComponent(token)}">
        <button type="submit">Unsubscribe</button>
      </form>
      ${signInNote(siteUrl)}` })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: found, error } = await supabase.rpc('unsubscribe_menu_emails', { p_token: token })
  if (error) {
    console.error('unsubscribe:', error.message)
    return page({ siteUrl, status: 500, title: 'Something went wrong', body: `
      <p class="eyebrow">Unsubscribe</p>
      <h1>We couldn't save that just now.</h1>
      <p>Please try again in a minute, or simply reply to any of our emails and we'll take you off the list.</p>` })
  }
  if (!found) {
    return page({ siteUrl, status: 404, title: 'Link not recognized', body: `
      <p class="eyebrow">Unsubscribe</p>
      <h1>We couldn't find that subscription.</h1>
      <p>Reply to any of our emails and we'll take you off the list, or sign in and change your choices in Settings.</p>` })
  }
  return page({ siteUrl, title: 'Unsubscribed', body: `
    <p class="eyebrow">Unsubscribed</p>
    <h1>You're off the menu list.</h1>
    <p>We won't send weekly menu emails anymore.</p>
    ${signInNote(siteUrl)}` })
}
