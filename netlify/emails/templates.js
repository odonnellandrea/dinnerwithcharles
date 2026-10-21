import { priceOrder, BASE_PRICE, MESSENGER_FEE_RANGE } from '../../src/lib/pricing.js'
import { formatWindows } from '../../src/lib/deliveryWindows.js'
import { deliveryOptionLabel } from '../../src/lib/deliveryOptions.js'
import { orderNumber } from '../../src/lib/orderNumber.js'

const GREEN = '#1a441f'
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

const money = (n) => `$${Number(n).toFixed(2)}`

// delivery_date is a plain YYYY-MM-DD; format it without letting a timezone shift the day
export const formatDeliveryDate = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

const eyebrow = (text) =>
  `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};font-weight:600;">${text}</p>`

const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${GREEN};">
      <a href="${href}" style="display:inline-block;padding:16px 32px;font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:0.06em;color:${CREAM};text-decoration:none;">${label}</a>
    </td>
  </tr></table>`

function layout({ siteUrl, preheader, body }) {
  const logo = `${siteUrl}/Green%20Horizontal%20Logo.png`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Dinner with Charles</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
    <tr><td align="center" style="padding:56px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td align="center" style="padding:0 0 40px 0;">
          <a href="${siteUrl}" style="display:inline-block;"><img src="${logo}" alt="Dinner with Charles" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></a>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-top:4px solid ${GREEN};padding:56px 48px;font-family:${FONT};color:${MUTED};">
          ${body}
        </td></tr>
        <tr><td align="center" style="padding:40px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.8;color:#999999;">
          <a href="${siteUrl}" style="color:${GREEN};text-decoration:underline;">Dinner with Charles</a> &middot; Dinner, taken care of<br>
          Questions? Just reply to this email, or message <a href="https://ig.me/m/dinnerwithcharles" style="color:${GREEN};">@dinnerwithcharles</a> on Instagram.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const ITEM_GROUPS = [
  { type: 'entree', label: 'Entrées' },
  { type: 'salad', label: 'Salads' },
  { type: 'addon', label: 'Add-ons' }
]

// rows: the Orders rows for one order_id (one row per item)
export function orderConfirmationEmail({ rows, siteUrl, messengerFee = 0 }) {
  const first = rows[0]
  const name = firstName(first.customer_name)
  const deliveryDate = formatDeliveryDate(first.delivery_date)

  const count = (type) => rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
  // add-on rows store the unit price in dollars
  const addOnsCost = rows.filter(r => r.item_type === 'addon').reduce((n, r) => n + Number(r.total_order_price || 0) * Number(r.quantity || 0), 0)
  const price = priceOrder({ entreeCount: count('entree'), saladCount: count('salad'), addOnsCost, messengerFee: Number(messengerFee) || 0 })

  const groups = ITEM_GROUPS.map(({ type, label }) => {
    const items = rows.filter(r => r.item_type === type)
    if (items.length === 0) return ''
    return `
      <p style="margin:32px 0 12px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">${label}</p>
      ${items.map(r => `
        <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#333333;">
          <span style="display:inline-block;min-width:28px;color:${GOLD};font-weight:600;">${Number(r.quantity)}&times;</span>${escapeHtml(r.item_name)}
        </p>`).join('')}`
  }).join('')

  const priceRow = (label, amount) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${MUTED};">${label}</td>
      <td align="right" style="padding:6px 0;font-size:14px;color:${MUTED};">${money(amount)}</td>
    </tr>`

  const body = `
    ${eyebrow('Order confirmed')}
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Thank you', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">Your order is in. Here's what's coming your way.</p>
    ${orderNumber(first.order_id) ? `<p style="margin:12px 0 0 0;font-size:13px;color:${MUTED};">Order ${orderNumber(first.order_id)}</p>` : ''}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0 0;background:${CREAM};border:1px solid ${BORDER};">
      <tr>
        <td style="padding:24px 28px;vertical-align:top;">
          ${eyebrow('Delivery')}
          <p style="margin:0;font-size:17px;font-weight:600;color:${GREEN};">${escapeHtml(deliveryDate)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 24px 28px;vertical-align:top;">
          ${eyebrow('Your windows')}
          <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">${escapeHtml(formatWindows(first.delivery_time_slot))}</p>
        </td>
      </tr>
    </table>

    ${groups}

    ${first.special_notes ? `
      <p style="margin:32px 0 12px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">Special requests</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">${escapeHtml(first.special_notes)}</p>` : ''}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0 0;border-top:1px solid ${BORDER};">
      <tr><td colspan="2" style="padding-top:20px;"></td></tr>
      ${priceRow('Base package (3 entrées + 2 salads)', BASE_PRICE)}
      ${price.entreeUpcharge > 0 ? priceRow(`Extra entrées (${price.extraEntrees})`, price.entreeUpcharge) : ''}
      ${price.saladUpcharge > 0 ? priceRow(`Extra salads (${price.extraSalads})`, price.saladUpcharge) : ''}
      ${price.addOnsCost > 0 ? priceRow('Add-ons', price.addOnsCost) : ''}
      ${price.messengerFee > 0 ? priceRow('Messenger delivery (estimate, at cost)', price.messengerFee) : ''}
      <tr>
        <td style="padding:20px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">Total</td>
        <td align="right" style="padding:20px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">${money(price.total)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;background:${CREAM};border:1px solid ${BORDER};">
      <tr><td style="padding:24px 28px;">
        ${eyebrow('Payment')}
        <p style="margin:0;font-size:15px;line-height:1.7;color:#333333;">Payment of <strong style="color:${GREEN};">${money(price.total)}</strong> is due upon order, by Venmo, Zelle or cash.</p>
      </td></tr>
    </table>

    <div style="margin:48px 0 0 0;">
      ${button(siteUrl, 'View your order')}
    </div>`

  return {
    subject: `Your Dinner with Charles order for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: `Confirmed for ${deliveryDate}. Here's everything on its way.`, body })
  }
}

// Same four steps as the landing page's "How it works"
const HOW_IT_WORKS = [
  ['A new menu each week', 'Every week we write a fresh menu of entrées, salads and extras, built around what’s in season.'],
  ['Choose what you love', 'Pick 3 entrées and 2 salads for your household. Want more? Add extra dishes or an add-on to round out the week.'],
  ['We cook from scratch', 'Every dish is cooked from scratch, fresh for delivery day, with the care we’d give our own family’s dinner.'],
  ['Delivered to your door', 'Choose the delivery windows that work for you. Every container comes labeled, with simple reheat instructions.']
]

// Sent once the admin approves a request to join
export function approvedEmail({ profile, siteUrl }) {
  const name = firstName(profile.first_name || profile.name)

  const body = `
    ${eyebrow('Approved')}
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Welcome to the table', name)}</h1>
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

  return {
    subject: 'Welcome to Dinner with Charles',
    html: layout({ siteUrl, preheader: 'You\'re in. The weekly menu is waiting.', body })
  }
}

export function reheatGuideEmail({ rows, siteUrl }) {
  const first = rows[0]
  const name = firstName(first.customer_name)
  const deliveryDate = formatDeliveryDate(first.delivery_date)
  const link = `${siteUrl}/?reheat=${encodeURIComponent(first.delivery_date)}`

  const body = `
    ${eyebrow('Delivered')}
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('Dinner has arrived', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">Everything is cooked and ready to reheat. Your guide has simple steps for each dish.</p>
    <div style="margin:40px 0 0 0;">
      ${button(link, 'Open your reheat guide')}
    </div>
    <p style="margin:40px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">Please refrigerate everything as soon as you can. You'll need to sign in to view your guide.</p>`

  return {
    subject: `Your reheat guide for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: 'Simple reheat steps for each dish.', body })
  }
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
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${greet('The menu is live', name)}</h1>
    <p style="margin:0;font-size:16px;line-height:1.7;">This week's menu is up on the site. Take a look and get your order in${closes ? ` by ${closes}` : ''}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;">
      <tr><td style="background:${CREAM};border:1px solid ${BORDER};padding:20px 24px;font-family:${FONT};font-size:15px;line-height:1.7;color:#333333;">
        <strong style="color:${GREEN};">Delivery ${deliveryDate}.</strong>${closes ? ` Orders close ${closes}.` : ''}
      </td></tr>
    </table>
    <div style="margin:32px 0 0 0;">
      ${button(siteUrl, 'See the menu')}
    </div>
    <p style="margin:40px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">You're getting this because you asked for weekly menu announcements. You can change that any time in Settings.</p>`

  return {
    subject: `This week's menu is live`,
    html: layout({ siteUrl, preheader: `Delivery ${deliveryDate}. Order${closes ? ` by ${closes}` : ' now'}.`, body })
  }
}

// To the admin when someone requests to join (or resubmits). request: the users row.
const REQUEST_FIELDS = [
  ['Household', 'household_composition'],
  ['Delivery address', 'delivery_address'],
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
        <td style="padding:10px 16px 10px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:1.6;color:#333333;">${escapeHtml(value)}</td>
      </tr>`).join('')

  const body = `
    ${eyebrow('Waiting for approval')}
    <h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${escapeHtml(name)} wants to join.</h1>
    <p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;">${escapeHtml(request.email)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};">${rows}</table>
    <div style="margin:32px 0 0 0;">
      ${button(`${siteUrl}`, 'Review and approve')}
    </div>
    <p style="margin:32px 0 0 0;font-size:13px;line-height:1.7;color:#999999;">Sign in as admin and open the Approvals tab. Their full answers are on their card.</p>`

  return {
    subject: `New request to join: ${name}`,
    html: layout({ siteUrl, preheader: `${request.email} is waiting for approval.`, body })
  }
}

// To the admin when a customer places an order. rows: the Orders rows for that order_id;
// profile: the customer's users row (for address, phone and how they'd like to receive it).
export function orderNoticeEmail({ rows, profile = {}, messengerFee = 0, siteUrl }) {
  const first = rows[0]
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || (first.customer_name && !first.customer_name.includes('@') ? first.customer_name : '') || first.email
  const deliveryDate = formatDeliveryDate(first.delivery_date)

  const count = (type) => rows.filter(r => r.item_type === type).reduce((n, r) => n + Number(r.quantity || 0), 0)
  const addOnsCost = rows.filter(r => r.item_type === 'addon').reduce((n, r) => n + Number(r.total_order_price || 0) * Number(r.quantity || 0), 0)
  const price = priceOrder({ entreeCount: count('entree'), saladCount: count('salad'), addOnsCost, messengerFee: Number(messengerFee) || 0 })

  const groups = ITEM_GROUPS.map(({ type, label }) => {
    const items = rows.filter(r => r.item_type === type)
    if (items.length === 0) return ''
    return `
      <p style="margin:28px 0 10px 0;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.04em;">${label}</p>
      ${items.map(r => `
        <p style="margin:0 0 6px 0;font-size:15px;line-height:1.6;color:#333333;">
          <span style="display:inline-block;min-width:28px;color:${GOLD};font-weight:600;">${Number(r.quantity)}&times;</span>${escapeHtml(r.item_name)}
        </p>`).join('')}`
  }).join('')

  const detail = (label, value) => value && String(value).trim() ? `
      <tr>
        <td style="padding:9px 16px 9px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-size:14px;line-height:1.6;color:#333333;">${escapeHtml(value)}</td>
      </tr>` : ''

  const body = `
    ${eyebrow('New order')}
    <h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.25;font-weight:600;color:${GREEN};">${escapeHtml(name)} placed an order.</h1>
    <p style="margin:0 0 28px 0;font-size:16px;line-height:1.7;">${money(price.total)} for delivery ${escapeHtml(deliveryDate)}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BORDER};">
      ${detail('Order number', orderNumber(first.order_id))}
      ${detail('Delivery', deliveryDate)}
      ${detail('Windows', formatWindows(first.delivery_time_slot))}
      ${detail('Email', first.email)}
      ${detail('Phone', profile.delivery_phone)}
      ${detail('Address', profile.delivery_address)}
      ${detail('Gets it by', profile.delivery_option ? deliveryOptionLabel(profile.delivery_option) : '')}
      ${detail('Pays by', profile.payment_method)}
      ${detail('Special requests', first.special_notes)}
    </table>

    ${groups}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0 0;border-top:1px solid ${BORDER};">
      <tr><td colspan="2" style="padding-top:12px;"></td></tr>
      <tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Base package</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(BASE_PRICE)}</td></tr>
      ${price.entreeUpcharge > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Extra entrées (${price.extraEntrees})</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.entreeUpcharge)}</td></tr>` : ''}
      ${price.saladUpcharge > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Extra salads (${price.extraSalads})</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.saladUpcharge)}</td></tr>` : ''}
      ${price.addOnsCost > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Add-ons</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.addOnsCost)}</td></tr>` : ''}
      ${price.messengerFee > 0 ? `<tr><td style="padding:5px 0;font-size:14px;color:${MUTED};">Messenger delivery (estimate)</td><td align="right" style="padding:5px 0;font-size:14px;color:${MUTED};">${money(price.messengerFee)}</td></tr>` : ''}
      <tr>
        <td style="padding:14px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">Total</td>
        <td align="right" style="padding:14px 0 0 0;border-top:2px solid ${GOLD};font-size:16px;font-weight:700;color:${GREEN};">${money(price.total)}</td>
      </tr>
    </table>

    <div style="margin:36px 0 0 0;">
      ${button(siteUrl, 'Open orders')}
    </div>`

  return {
    subject: `New order: ${name}, ${money(price.total)} for ${deliveryDate}`,
    html: layout({ siteUrl, preheader: `${orderNumber(first.order_id)} · ${name} · ${count('entree')} entrées, ${count('salad')} salads`, body })
  }
}
