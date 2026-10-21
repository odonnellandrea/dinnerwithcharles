import { createClient } from '@supabase/supabase-js'
import { fetchSheetMenu } from '../../src/lib/sheetMenu.js'
import * as pdf from '../pdf/toolkit.js'

// GET /.netlify/functions/menu-pdf, with a signed-in customer's Supabase token. Returns this
// week's menu (the live delivery date, dishes from the sheet) as a PDF in the style of the
// weekly menu PDF, so a family can pass it around.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const { json, L, R, CW, TX, TW, GREEN, GOLD, INK, MUTED } = pdf

const money = (cents) => `$${Number.isInteger(cents / 100) ? cents / 100 : (cents / 100).toFixed(2)}`

function draw(doc, { menu, deliveryDate, badge }) {
  pdf.frame(doc)
  let y = pdf.header(doc, { weekOf: deliveryDate })
  const introText = (menu.intro || []).join('\n\n')
  if (introText) y = pdf.intro(doc, y, introText) + 18
  else y += 4
  pdf.rule(doc, y)
  y += 27

  menu.sections.filter(s => s.items.length).forEach(section => {
    if (section.type === 'addon') {
      // Add-ons: full-width rows with the price in gold, like the menu PDF
      y = pdf.sectionHeading(doc, y, section.title, { subtitle: section.note || 'Extras to round out your week' })
      section.items.forEach((item, i) => {
        if (i > 0) { pdf.rule(doc, y); y += 13 }
        const price = Number.isFinite(item.price) ? money(item.price) : ''
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(GOLD).text(price, L, y, { width: CW, align: 'right' })
        const nameW = CW - (price ? doc.widthOfString(price) + 12 : 0)
        doc.font('Times-BoldItalic').fontSize(11.5).fillColor(GREEN)
        y = pdf.wrapped(doc, item.name, L, y, nameW, { lineGap: 4 }) + 1.75
        if (item.note) {
          doc.font('Courier').fontSize(7.6).fillColor(MUTED).text(item.note.toUpperCase(), L, y, { width: CW, lineBreak: false })
          y += 9.5
        }
        if (item.description) y = pdf.paragraph(doc, y, item.description, { x: L, width: 230.5, size: 8.7, lineGap: 3.9 })
        y += 9.5
      })
      y += 3
      return
    }

    y = pdf.sectionHeading(doc, y, section.title, { tag: section.note || '' })
    section.items.forEach((item, i) => {
      y = pdf.dishTitle(doc, y, i + 1, item.name, item.sides || '')
      if (item.description) y = pdf.paragraph(doc, y, item.description)
      if (i < section.items.length - 1) {
        y += 6
        pdf.dashedRule(doc, y)
        y += 12.5
      }
    })
    y += 8
    pdf.rule(doc, y)
    y += 27.5
  })

  return pdf.footer(doc, y, badge)
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
  const url = new URL(req.url)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Invalid session' })

  const { data: settings } = await supabase.from('delivery_settings').select('delivery_date').eq('is_live', true).maybeSingle()
  if (!settings) return json(409, { error: 'No menu is live right now' })

  let menu
  try { menu = await fetchSheetMenu() } catch (err) { return json(502, { error: 'Could not read the menu sheet: ' + err.message }) }
  if (!menu.sections?.some(s => s.items.length)) return json(409, { error: 'The menu sheet has nothing visible' })

  const badge = await pdf.fetchBadge(process.env.URL || url.origin)
  const file = await pdf.render('Weekly Kitchen Menu', doc => draw(doc, { menu, deliveryDate: settings.delivery_date, badge }))
  return pdf.pdfResponse(file, `Weekly Kitchen Menu - week of ${settings.delivery_date}.pdf`)
}
