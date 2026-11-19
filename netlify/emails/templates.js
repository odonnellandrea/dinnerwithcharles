import { priceOrder, MESSENGER_FEE_RANGE } from '../../src/lib/pricing.js'
import { formatWindows } from '../../src/lib/deliveryWindows.js'
import { deliveryOptionLabel } from '../../src/lib/deliveryOptions.js'
import { orderNumber } from '../../src/lib/orderNumber.js'

const GREEN = '#083525'
const GOLD = '#D4A373'
const CREAM = '#faf8f3'
const BORDER = '#e0dbd1'
const MUTED = '#666666'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// First name for greetings, or '' when there isn't one (older orders saved the email
// address as the customer name). Headings leave the name out rather than guess.
const firstName = (customerName) => {
  const first = (customerName || '').trim().split(/\s+/)[0]
  return first && !first.includes('@') ? first : ''
}
// "Dinner has arrived, Jiaqi." or just "Dinner has arrived."
const greet = (text, name) => (name ? `${text}, ${escapeHtml(name)}.` : `${text}.`)

const money = (n) => `${Number(n) < 0 ? "−" : ""}$${Math.abs(Number(n)).toFixed(2)}`

// delivery_date is a plain YYYY-MM-DD; format it without letting a timezone shift the day
export const formatDeliveryDate = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

const eyebrow = (text) =>
  `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};font-weight:600;">${text}</p>`

// Padding sits on the cell, not the link, so Outlook (which ignores padding on links) still
// draws a full-size button. On phones the button spans the card for an easy tap.
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="dwc-btn"><tr>
    <td align="center" style="background:${GREEN};mso-padding-alt:16px 32px;">
      <a href="${href}" style="display:inline-block;padding:16px 32px;font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:0.06em;line-height:1.2;color:${CREAM};text-decoration:none;">${label}</a>
    </td>
  </tr></table>`

// One line per dish with a hanging indent, so a long name wraps under itself, not under the count
const itemLine = (quantity, name, gap = 8) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${gap}px 0;"><tr>
    <td valign="top" width="32" style="width:32px;font-size:15px;line-height:1.6;color:${GOLD};font-weight:600;">${Number(quantity)}&times;</td>
    <td valign="top" style="font-size:15px;line-height:1.6;color:#333333;">${escapeHtml(name)}</td>
  </tr></table>`

// Each window stays on one line ("1:00 - 5:00 PM" never breaks in the middle)
const windowsHtml = (value) => escapeHtml(formatWindows(value))
  .split(/(, | or )/)
  .map(part => (part === ', ' || part === ' or ' ? part : part.replace(/ /g, '&nbsp;')))
  .join('')

// Phone sizes, Outlook fixes and link resets. Gmail, Apple Mail and Outlook apps read this
// block; clients that drop it still get the inline styles, which work at any width.
const HEAD_STYLES = `
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }
    u + #body a { color:inherit; text-decoration:none; font-size:inherit; font-family:inherit; font-weight:inherit; line-height:inherit; }
    @media only screen and (max-width:480px) {
      .dwc-outer { padding:28px 12px !important; }
      .dwc-header { padding:28px 22px !important; }
      .dwc-header img { width:190px !important; }
      .dwc-card { padding:36px 22px !important; }
      .dwc-h1 { font-size:24px !important; }
      .dwc-box { padding:20px !important; }
      .dwc-box-top { padding:20px 20px 0 20px !important; }
      .dwc-box-bottom { padding:16px 20px 20px 20px !important; }
      .dwc-btn { width:100% !important; }
      .dwc-btn a { display:block !important; }
      .dwc-label { white-space:normal !important; width:38% !important; }
      .dwc-footer { padding:32px 12px 0 12px !important; }
    }
  </style>
  <!--[if mso]>
  <style>table, td, p, a, h1, span, strong { font-family:Arial, sans-serif !important; }</style>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->`

// Invisible characters after the preview text, so inboxes don't fill the preview line with
// the start of the email ("Dinner with Charles Order confirmed Thank you...")
const PREHEADER_FILL = '&#8199;&#65279;&#847; '.repeat(60)

function layout({ siteUrl, preheader, body }) {
  const logo = `${siteUrl}/Gold%20Horizontal%20Logo.png`
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Dinner with Charles</title>
  ${HEAD_STYLES}
</head>
<body id="body" style="margin:0;padding:0;background:${CREAM};word-spacing:normal;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}${PREHEADER_FILL}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
    <tr><td align="center" class="dwc-outer" style="padding:56px 16px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
        <tr><td align="center" class="dwc-header" bgcolor="${GREEN}" style="background:${GREEN};border-bottom:3px solid ${GOLD};padding:36px 48px;">
          <a href="${siteUrl}" style="display:inline-block;"><img src="${logo}" alt="Dinner with Charles" width="240" height="19" style="display:block;width:240px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:18px;font-weight:600;letter-spacing:0.08em;color:${GOLD};"></a>
        </td></tr>
        <tr><td class="dwc-card" style="background:#ffffff;border:1px solid ${BORDER};border-top:0;padding:56px 48px;font-family:${FONT};font-size:16px;line-height:1.7;color:${MUTED};">
          ${body}
        </td></tr>
        <tr><td align="center" class="dwc-footer" style="padding:40px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.8;color:#999999;">
          <a href="${siteUrl}" style="color:${GREEN};text-decoration:underline;">Dinner with Charles</a> &middot; Dinner, taken care of<br>
          Questions? Just reply to this email, or message <a href="https://ig.me/m/dinnerwithcharles" style="color:${GREEN};">@dinnerwithcharles</a> on Instagram.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`
}

// Plain-text copy of an email, sent alongside the HTML. Spam filters score HTML-only mail
// lower, and watches, screen readers and text-only clients show this version.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', times: '×', middot: '·', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘' }
export function htmlToText(html) {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/>\s+</g, '><')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim()
      return !text || text === href ? href : `${text} (${href})`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|div)>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/table>/gi, '\n')
    .replace(/<\/td>(?=<td)/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code) => code[0] === '#'
      ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
      : (ENTITIES[code] ?? m))
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}

const withText = (message) => ({ ...message, text: htmlToText(message.html) })

const ITEM_GROUPS = [
  { type: 'entree', label: 'Entrées' },
  { type: 'salad', label: 'Sides' },
  { type: 'addon', label: 'Add-ons' }
]

// rows: the Orders rows for one order_id (one row per item)
export function orderConfirmationEmail({ rows, siteUrl, messengerFee = 0, discount = 0, basePrice, complimentary = false }) {
  const first = rows[0]
  const name = firstName(first.customer_name)
  const deliveryDate = formatDeliveryDate(first.delivery_date)

  const count = (type) => rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
  // add-on rows store the unit price in dollars
  const addOnsCost = rows.filter(r => r.item_type === 'addon').reduce((n, r) => n + Number(r.total_order_price || 0) * Number(r.quantity || 0), 0)
  const price = priceOrder({ entreeCount: count('entree'), saladCount: count('salad'), addOnsCost, messengerFee: Number(messengerFee) || 0, discount: Number(discount) || 0, ...(basePrice != null ? { basePrice: Number(basePrice) } : {}), complimentary })

  const groups = ITEM_GROUPS.map(({ type, label }) => {
    const items = rows.filter(r => r.item_type === type)
    if (items.length === 0) return ''
    return `
      <p style="margin:32px 0 12px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">${label}</p>
      ${items.map(r => itemLine(r.quantity, r.item_name, 8)).join('')}`
  }).join('')

  const priceRow = (label, amount) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${MUTED};">${label}</td>
      <td align="right" style="padding:6px 0;font-size:14px;color:${MUTED};">${money(amount)}</td>
    </tr>`

  const body = `
    ${eyebrow('Order confirmed')}
    <h1 class="dwc-h1" style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Thank you', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">Your order is in. Here's what's coming your way.</p>
    ${orderNumber(first.order_id) ? `<p style="margin:12px 0 0 0;font-size:13px;color:${MUTED};">Order ${orderNumber(first.order_id)}</p>` : ''}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0 0;background:${CREAM};border:1px solid ${BORDER};">
      <tr>
        <td class="dwc-box-top" style="padding:24px 28px 0 28px;vertical-align:top;">
          ${eyebrow('Delivery')}
          <p style="margin:0;font-size:17px;font-weight:600;color:${GREEN};">${escapeHtml(deliveryDate)}</p>
        </td>
      </tr>
      <tr>
        <td class="dwc-box-bottom" style="padding:20px 28px 24px 28px;vertical-align:top;">
          ${eyebrow('Your windows')}
          <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">${windowsHtml(first.delivery_time_slot)}</p>
        </td>
      </tr>
    </table>

    ${groups}

    ${first.special_notes ? `
      <p style="margin:32px 0 12px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">For the kitchen</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">${escapeHtml(first.special_notes)}</p>` : ''}
    ${first.delivery_notes ? `
      <p style="margin:24px 0 12px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">Delivery notes</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">${escapeHtml(first.delivery_notes)}</p>` : ''}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0 0;border-top:1px solid ${BORDER};">
      <tr><td colspan="2" style="padding-top:20px;"></td></tr>
      ${priceRow('Base package (3 entrées + 2 sides)', price.basePrice)}
      ${price.entreeUpcharge > 0 ? priceRow(`Extra entrées (${price.extraEntrees})`, price.entreeUpcharge) : ''}
      ${price.saladUpcharge > 0 ? priceRow(`Extra sides (${price.extraSalads})`, price.saladUpcharge) : ''}
      ${price.addOnsCost > 0 ? priceRow('Add-ons', price.addOnsCost) : ''}
      ${price.discount > 0 ? priceRow('Referral discount', -price.discount) : ''}
      ${price.messengerFee > 0 ? priceRow('Messenger delivery (estimate, at cost)', price.messengerFee) : ''}
      ${price.complimentary ? priceRow('Complimentary', -(price.subtotal - price.discount + price.messengerFee)) : ''}
      <tr>
        <td style="padding:20px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">Total</td>
        <td align="right" style="padding:20px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">${money(price.total)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;background:${CREAM};border:1px solid ${BORDER};">
      <tr><td class="dwc-box" style="padding:24px 28px;">
        ${eyebrow('Payment')}
        ${price.complimentary
          ? `<p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">This order is on us. Nothing to pay.</p>`
          : `<p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">Payment of <strong style="color:${GREEN};">${money(price.total)}</strong> is due upon order, by Venmo, Zelle or cash.</p>`}
      </td></tr>
    </table>

    <div style="margin:48px 0 0 0;">
      ${button(siteUrl, 'View your order')}
    </div>`

  return withText({
    subject: `Your Dinner with Charles order for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: `Confirmed for ${deliveryDate}. Here's everything on its way.`, body })
  })
}

// Same four steps as the landing page's "How it works"
const HOW_IT_WORKS = [
  ['A new menu each week', 'Every week we write a fresh menu of entrées, sides and extras, built around what’s in season.'],
  ['Choose what you love', 'Pick 3 entrées and 2 sides for your household. Want more? Add extra dishes or an add-on to round out the week.'],
  ['We cook from scratch', 'Every dish is cooked from scratch, fresh for delivery day, with the care we’d give our own family’s dinner.'],
  ['Delivered to your door', 'Choose the delivery windows that work for you. Every container comes labeled, with simple reheat instructions.']
]

// Sent once the admin approves a request to join
export function approvedEmail({ profile, siteUrl }) {
  const name = firstName(profile.first_name || profile.name)

  const body = `
    ${eyebrow('Approved')}
    <h1 class="dwc-h1" style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Welcome to the table', name)}</h1>
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">You're in. Here's how ordering works:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
      ${HOW_IT_WORKS.map(([title, body], i) => `
      <tr>
        <td valign="top" style="padding:0 14px 14px 0;font-size:15px;font-weight:600;color:${GOLD};">${i + 1}.</td>
        <td valign="top" style="padding:0 0 14px 0;font-size:15px;line-height:1.6;"><strong style="color:${GREEN};">${title}.</strong> ${body}</td>
      </tr>`).join('')}
    </table>
    ${String(profile.delivery_option || '').split(',').includes('pickup') ? `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Picking up in NoMad? We'll let you know when your order is ready and where to find us.</p>` : ''}
    ${profile.messenger_delivery ? `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Since you're outside our walking range, your orders come by Uber messenger. We pass the cost through as charged, usually ${MESSENGER_FEE_RANGE} in Manhattan depending on delivery conditions, so the amount on your order is an estimate and may land a little higher or lower. If you'd rather pick up in NoMad, or have us deliver to an office or a friend's place within our range, just let us know. As more of your neighbors join, we hope to bring our own delivery to your area for a flat fee.</p>` : ''}
    <div style="margin:40px 0 0 0;">
      ${button(siteUrl, 'Sign in and order')}
    </div>
    <p style="margin:40px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">Use the email and password you signed up with.</p>`

  return withText({
    subject: 'Welcome to Dinner with Charles',
    html: layout({ siteUrl, preheader: 'You\'re in. The weekly menu is waiting.', body })
  })
}

export function reheatGuideEmail({ rows, siteUrl }) {
  const first = rows[0]
  const name = firstName(first.customer_name)
  const deliveryDate = formatDeliveryDate(first.delivery_date)
  const link = `${siteUrl}/?reheat=${encodeURIComponent(first.delivery_date)}`

  const body = `
    ${eyebrow('Delivered')}
    <h1 class="dwc-h1" style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Dinner has arrived', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">Everything is cooked and ready to reheat. Your guide has simple steps for each dish.</p>
    <div style="margin:40px 0 0 0;">
      ${button(link, 'Open your reheat guide')}
    </div>
    <p style="margin:40px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">Please refrigerate everything as soon as you can. You'll need to sign in to view your guide.</p>`

  return withText({
    subject: `Your reheat guide for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: 'Simple reheat steps for each dish.', body })
  })
}

// "The menu is live" to one opted-in customer. Short on purpose: the menu itself lives on
// the site, so this just points them there. settings: the live delivery_settings row.
const NY = 'America/New_York'
const formatCloseTime = (iso) => {
  if (!iso) return ''
  const dt = new Date(iso)
  const date = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: NY })
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: NY })
  return `${date} at ${time}`
}

export function menuLiveEmail({ profile, settings, siteUrl }) {
  const name = firstName(profile.first_name || profile.name)
  const deliveryDate = formatDeliveryDate(settings.delivery_date)
  const closes = formatCloseTime(settings.order_close_datetime)

  const body = `
    ${eyebrow("This week's menu")}
    <h1 class="dwc-h1" style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('The menu is live', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">This week's menu is up on the site. Take a look and get your order in${closes ? ` by ${closes}` : ''}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;">
      <tr><td class="dwc-box" style="background:${CREAM};border:1px solid ${BORDER};padding:20px 24px;font-family:${FONT};font-size:15px;line-height:1.7;color:#333333;">
        <strong style="color:${GREEN};">Delivery ${deliveryDate}.</strong>${closes ? ` Orders close ${closes}.` : ''}
      </td></tr>
    </table>
    <div style="margin:32px 0 0 0;">
      ${button(siteUrl, 'See the menu')}
    </div>
    <p style="margin:40px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">You're getting this because you asked for weekly menu announcements. You can change that any time in Settings.</p>`

  return withText({
    subject: `This week's menu is live`,
    html: layout({ siteUrl, preheader: `Delivery ${deliveryDate}. Order${closes ? ` by ${closes}` : ' now'}.`, body })
  })
}

// To the admin when someone requests to join (or resubmits). request: the users row.
const REQUEST_FIELDS = [
  ['Referral code', 'referral_code'],
  ['Heard about us', 'heard_about'],
  ['Heard about us (detail)', 'heard_about_detail'],
  ['Household', 'household_composition'],
  ['Delivery address', 'delivery_address'],
  ['Apartment', 'apartment'],
  ['Delivery options', 'delivery_option'],
  ['Phone', 'delivery_phone'],
  ['Allergies', 'allergies'],
  ['Health restrictions', 'health_restrictions'],
  ['Anything else', 'anything_else']
]

export function joinRequestEmail({ request, siteUrl }) {
  const name = [request.first_name, request.last_name].filter(Boolean).join(' ') || request.name || request.email
  const rows = REQUEST_FIELDS
    .map(([label, column]) => [label, column === 'delivery_option' ? deliveryOptionLabel(request[column]) : request[column]])
    .filter(([, value]) => value && String(value).trim())
    .map(([label, value]) => `
      <tr>
        <td class="dwc-label" style="padding:10px 16px 10px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:10px 0;vertical-align:top;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:1.6;color:#333333;">${escapeHtml(value)}</td>
      </tr>`).join('')

  const body = `
    ${eyebrow('Waiting for approval')}
    <h1 class="dwc-h1" style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${escapeHtml(name)} wants to join.</h1>
    <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;">${escapeHtml(request.email)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};">${rows}</table>
    <div style="margin:32px 0 0 0;">
      ${button(`${siteUrl}`, 'Review and approve')}
    </div>
    <p style="margin:32px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">Sign in as admin and open the Approvals tab. Their full answers are on their card.</p>`

  return withText({
    subject: `New request to join: ${name}`,
    html: layout({ siteUrl, preheader: `${request.email} is waiting for approval.`, body })
  })
}

// To the admin when a customer places an order. rows: the Orders rows for that order_id;
// profile: the customer's users row (for address, phone and how they'd like to receive it).
export function orderNoticeEmail({ rows, profile = {}, messengerFee = 0, discount = 0, discountCodes = [], basePrice, complimentary = false, siteUrl }) {
  const first = rows[0]
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || (first.customer_name && !first.customer_name.includes('@') ? first.customer_name : '') || first.email
  const deliveryDate = formatDeliveryDate(first.delivery_date)

  const count = (type) => rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
  const addOnsCost = rows.filter(r => r.item_type === 'addon').reduce((n, r) => n + Number(r.total_order_price || 0) * Number(r.quantity || 0), 0)
  const price = priceOrder({ entreeCount: count('entree'), saladCount: count('salad'), addOnsCost, messengerFee: Number(messengerFee) || 0, discount: Number(discount) || 0, ...(basePrice != null ? { basePrice: Number(basePrice) } : {}), complimentary })

  const groups = ITEM_GROUPS.map(({ type, label }) => {
    const items = rows.filter(r => r.item_type === type)
    if (items.length === 0) return ''
    return `
      <p style="margin:28px 0 10px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">${label}</p>
      ${items.map(r => itemLine(r.quantity, r.item_name, 6)).join('')}`
  }).join('')

  const detail = (label, value) => value && String(value).trim() ? `
      <tr>
        <td class="dwc-label" style="padding:9px 16px 9px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:9px 0;vertical-align:top;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:1.6;color:#333333;">${escapeHtml(value)}</td>
      </tr>` : ''

  const body = `
    ${eyebrow('New order')}
    <h1 class="dwc-h1" style="margin:0 0 8px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${escapeHtml(name)} placed an order.</h1>
    <p style="margin:0 0 28px 0;font-size:16px;line-height:1.7;">${price.complimentary ? 'Complimentary' : money(price.total)} for delivery ${escapeHtml(deliveryDate)}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};">
      ${detail('Order number', orderNumber(first.order_id))}
      ${detail('Delivery', deliveryDate)}
      ${detail('Windows', formatWindows(first.delivery_time_slot))}
      ${detail('Email', first.email)}
      ${detail('Phone', profile.delivery_phone)}
      ${detail('Address', [profile.delivery_address, profile.apartment && `Apt ${profile.apartment}`].filter(Boolean).join(', '))}
      ${detail('Gets it by', profile.delivery_option ? deliveryOptionLabel(profile.delivery_option) : '')}
      ${detail('Pays by', profile.payment_method)}
      ${detail('For the kitchen', first.special_notes)}
      ${detail('Delivery notes', first.delivery_notes)}
    </table>

    ${groups}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;border-top:1px solid ${BORDER};">
      <tr><td colspan="2" style="padding-top:12px;"></td></tr>
      <tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Base package</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.basePrice)}</td></tr>
      ${price.entreeUpcharge > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Extra entrées (${price.extraEntrees})</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.entreeUpcharge)}</td></tr>` : ''}
      ${price.saladUpcharge > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Extra sides (${price.extraSalads})</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.saladUpcharge)}</td></tr>` : ''}
      ${price.addOnsCost > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Add-ons</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.addOnsCost)}</td></tr>` : ''}
      ${price.discount > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Discount${discountCodes.length ? ` (${escapeHtml(discountCodes.join(', '))})` : ''}</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(-price.discount)}</td></tr>` : ''}
      ${price.messengerFee > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Messenger delivery (estimate)</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.messengerFee)}</td></tr>` : ''}
      <tr>
        <td style="padding:14px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">Total</td>
        <td align="right" style="padding:14px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">${money(price.total)}</td>
      </tr>
    </table>

    <div style="margin:36px 0 0 0;">
      ${button(siteUrl, 'Open orders')}
    </div>`

  return withText({
    subject: `New order: ${name}, ${money(price.total)} for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: `${orderNumber(first.order_id)} · ${name} · ${count('entree')} entrées, ${count('salad')} sides`, body })
  })
}
