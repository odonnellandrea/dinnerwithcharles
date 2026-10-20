import PDFDocument from 'pdfkit'
import { createClient } from '@supabase/supabase-js'
import { fetchSheetReheat } from '../../src/lib/sheetMenu.js'
import { buildReheatGuide, LIBRARY_TABLE } from '../../src/lib/reheatGuide.js'
import { namesFrom, joinName } from '../../src/lib/customerName.js'

// GET /.netlify/functions/reheat-pdf?delivery_date=YYYY-MM-DD, with the customer's Supabase
// token. Returns their reheat guide as a PDF in the same style as the weekly menu PDF.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Palette and metrics, measured from the weekly reheat PDF
const PAGE = '#f6f1e4'
const EDGE = '#d9cdb2'
const GREEN = '#1e2e21'
const INK = '#2b2b2b'
const MUTED = '#6f6c5e'
const TAG = '#8e8a7a'
const RULE = '#cfc9b6'

const shortDate = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return `${m}/${d}/${String(y).slice(2)}`
}

const SECTIONS = [
  { type: 'entree', title: 'Entrées' },
  { type: 'salad', title: 'Salads' },
  { type: 'addon', title: 'Add-Ons' }
]

// Draws the guide; returns the page height needed. Positions and sizes are measured
// from the toolkit's reheat PDF so the two match. Run once on a tall page to measure,
// then again on a page cut to size.
function draw(doc, { dishes, deliveryDate, customerName, badge }) {
  const W = doc.page.width          // 324, like the toolkit PDFs
  const H = doc.page.height
  const SIDE = 12, TOP = 29         // tan frame
  const L = 30, R = W - 31, CW = R - L
  const TX = 62, TW = R - TX        // dish text column
  let y = 0

  // Tan page with a cream panel inset, a green line under the top band (and above the bottom one)
  doc.rect(0, 0, W, H).fill(EDGE)
  doc.rect(SIDE, TOP, W - SIDE * 2, H - TOP * 2).fill(PAGE)
  doc.rect(SIDE, TOP, W - SIDE * 2, 2).fill(GREEN)

  // Header
  doc.font('Courier').fontSize(8).fillColor(GREEN).text('DINNER WITH CHARLES', L, 54, { width: CW, align: 'center' })
  doc.font('Times-Bold').fontSize(26).fillColor(GREEN).text('Weekly Kitchen', L, 65, { width: CW, align: 'center' })
  doc.font('Times-Italic').fontSize(10).fillColor(MUTED).text('cooked by Chef Robert, your private chef', L, 92, { width: CW, align: 'center' })

  const pill = `WEEK OF ${shortDate(deliveryDate)}`
  doc.font('Courier').fontSize(8)
  const pw = doc.widthOfString(pill) + 24
  doc.rect((W - pw) / 2, 118, pw, 19).fill(GREEN)
  doc.fillColor(PAGE).text(pill, (W - pw) / 2, 124, { width: pw, align: 'center' })

  y = 162
  if (customerName) {
    doc.font('Courier').fontSize(7.5).fillColor(TAG).text(`PREPARED FOR ${customerName.toUpperCase()}`, L, 149, { width: CW, align: 'center' })
    y = 171
  }
  const intro = "Here's how to reheat each part of your order, so everything tastes just as good as when it left our kitchen."
  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(intro, L + 8, y, { width: CW - 16, align: 'center', lineGap: 2.6 })
  y += doc.heightOfString(intro, { width: CW - 16, lineGap: 2.6 }) + 18

  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.7).stroke(RULE)
  y += 27

  SECTIONS.forEach(section => {
    const items = dishes.filter(d => d.type === section.type)
    if (!items.length) return

    doc.font('Times-Bold').fontSize(16).fillColor(GREEN).text(section.title, L, y)
    const tag = `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}`
    doc.font('Courier').fontSize(8)
    const tw = doc.widthOfString(tag) + 16
    doc.rect(R - tw, y + 3, tw, 16).fill(GREEN)
    doc.fillColor(PAGE).text(tag, R - tw, y + 8, { width: tw, align: 'center' })
    y += 21
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1.6).stroke(GREEN)
    y += 10

    items.forEach((dish, i) => {
      // Dish name with the number in a circle beside it
      doc.font('Times-BoldItalic').fontSize(13).fillColor(GREEN).text(dish.name, TX, y, { width: TW, lineGap: 1 })
      doc.circle(42.5, y + 14, 11).lineWidth(1).stroke('#a9a697')
      doc.font('Courier').fontSize(9).fillColor('#8c8a7c').text(String(i + 1).padStart(2, '0'), 31, y + 10.5, { width: 23, align: 'center' })
      y += doc.heightOfString(dish.name, { width: TW, lineGap: 1 }) + 9

      const parts = dish.components.map(c => c.name).filter(Boolean)
      if (parts.length) {
        const tagLine = parts.join(' · ').toUpperCase()
        doc.font('Courier').fontSize(8).fillColor(TAG).text(tagLine, TX, y, { width: TW, lineGap: 2.5 })
        y += doc.heightOfString(tagLine, { width: TW, lineGap: 2.5 }) + 5.5
      }
      if (!dish.components.length) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Nothing to reheat. Serve as is.', TX, y, { width: TW })
        y += 13
      }
      dish.components.forEach((comp, ci) => {
        if (comp.name) {
          doc.font('Helvetica-BoldOblique').fontSize(8.5).fillColor(GREEN).text(`${comp.name} —`, TX, y, { width: TW })
          y += doc.heightOfString(`${comp.name} —`, { width: TW }) + 0.5
        }
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(comp.instruction || '', TX, y, { width: TW, lineGap: 2.2 })
        y += doc.heightOfString(comp.instruction || '', { width: TW, lineGap: 2.2 }) + (ci < dish.components.length - 1 ? 6.5 : 0)
      })
      if (i < items.length - 1) {
        y += 12
        doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).dash(1.5, { space: 2.5 }).stroke(RULE).undash()
        y += 17
      }
    })

    y += 17
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.7).stroke(RULE)
    y += 27
  })

  // Footer box: tan, so the green badge stands out instead of sinking into a green box
  y += 7
  const BOX = process.env.REHEAT_PDF_FOOTER || '#e4dbc2'
  const bh = badge ? 136 : 84
  doc.rect(L, y, CW, bh).fill(BOX)
  let fy = y
  if (badge) {
    doc.image(badge, (W - 50) / 2, y + 26, { width: 50 })
    fy = y + 88
  } else {
    fy = y + 22
  }
  doc.font('Times-BoldItalic').fontSize(13).fillColor(GREEN).text('Questions About Your Order?', L, fy, { width: CW, align: 'center' })
  doc.font('Times-Italic').fontSize(9).fillColor('#6f6c5e').text("Reach out anytime — we're happy to help.", L, fy + 18, { width: CW, align: 'center' })
  y += bh + 12
  doc.font('Courier').fontSize(8).fillColor(GREEN).text('@DINNERWITHCHARLES', L, y, { width: CW, align: 'center' })
  y += 29
  // Bottom band: green line above the tan edge
  return y + TOP
}

function render(data) {
  const width = 324
  // Pass 1: measure
  const probe = new PDFDocument({ size: [width, 5000], margin: 0, autoFirstPage: true })
  const height = draw(probe, data)
  probe.end()
  // Pass 2: real document, cut to size
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, Math.ceil(height)], margin: 0, info: { Title: 'Reheat Guide', Author: 'Dinner with Charles' } })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    draw(doc, data)
    doc.rect(12, doc.page.height - 31, doc.page.width - 24, 2).fill(GREEN)
    doc.end()
  })
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
  const url = new URL(req.url)
  const deliveryDate = url.searchParams.get('delivery_date')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate || '')) return json(400, { error: 'delivery_date is required' })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Invalid session' })

  // Their own orders only (RLS enforces it too)
  const { data: orders, error: ordersError } = await supabase.from('Orders').select('*').eq('email', user.email).eq('delivery_date', deliveryDate)
  if (ordersError) return json(500, { error: ordersError.message })
  if (!orders?.length) return json(404, { error: 'No orders for that delivery date' })

  let sheetSteps = {}
  try { sheetSteps = await fetchSheetReheat() } catch (err) { console.error('Menu sheet unavailable for the PDF:', err) }
  const lookupLibrary = async (type, name) => {
    const { data } = await supabase.from(LIBRARY_TABLE[type] || 'add_ons').select('*').eq('name', name).maybeSingle()
    return data
  }
  const dishes = await buildReheatGuide({ orders, sheetSteps, lookupLibrary })

  // The round badge for the footer, fetched from the site so nothing has to be bundled
  let badge = null
  try {
    const siteUrl = process.env.URL || url.origin
    const res = await fetch(`${siteUrl}/Round%20Badge.png`)
    if (res.ok) badge = Buffer.from(await res.arrayBuffer())
  } catch { /* text-only footer */ }

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
  const names = profile ? namesFrom(profile) : { firstName: '', lastName: '', savedAs: '' }
  const customerName = (joinName(names.firstName, names.lastName) || names.savedAs || orders[0].customer_name || '').trim()
  const safeName = customerName.replace(/[^\w .'-]/g, '').trim()

  const pdf = await render({ dishes, deliveryDate, customerName: /@/.test(customerName) ? '' : customerName, badge })
  return new Response(pdf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safeName && !/@/.test(safeName) ? `${safeName} - ` : ''}Reheat Instructions ${deliveryDate}.pdf"`,
      'cache-control': 'private, no-store'
    }
  })
}
