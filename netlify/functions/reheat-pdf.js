import { createClient } from '@supabase/supabase-js'
import { fetchSheetReheat } from '../../src/lib/sheetMenu.js'
import { buildReheatGuide, LIBRARY_TABLE } from '../../src/lib/reheatGuide.js'
import { namesFrom, joinName } from '../../src/lib/customerName.js'
import * as pdf from '../pdf/toolkit.js'

// GET /.netlify/functions/reheat-pdf?delivery_date=YYYY-MM-DD, with the customer's Supabase
// token. Returns their reheat guide as a PDF in the style of the weekly reheat sheets.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const { json, L, R, TX, TW, GREEN, INK, MUTED } = pdf

const SECTIONS = [
  { type: 'entree', title: 'Entrées' },
  { type: 'salad', title: 'Salads' },
  { type: 'addon', title: 'Add-Ons' }
]

function draw(doc, { dishes, deliveryDate, customerName, badge }) {
  pdf.frame(doc)
  let y = pdf.header(doc, { weekOf: deliveryDate, subline: customerName ? `Prepared for ${customerName}` : '' })
  y = pdf.intro(doc, y, "Here's how to reheat each part of your order, so everything tastes just as good as when it left our kitchen.") + 18
  pdf.rule(doc, y)
  y += 27

  SECTIONS.forEach(section => {
    const items = dishes.filter(d => d.type === section.type)
    if (!items.length) return
    y = pdf.sectionHeading(doc, y, section.title)

    items.forEach((dish, i) => {
      const parts = dish.components.map(c => c.name).filter(Boolean)
      y = pdf.dishTitle(doc, y, i + 1, dish.name, parts.join(' · '))
      if (!dish.components.length) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Nothing to reheat. Serve as is.', TX, y, { width: TW })
        y += 13
      }
      dish.components.forEach((comp, ci) => {
        if (comp.name) {
          doc.font('Helvetica-BoldOblique').fontSize(8.5).fillColor(GREEN).text(`${comp.name} —`, TX, y, { width: TW })
          y += doc.currentLineHeight() + 3.5
        }
        y = pdf.paragraph(doc, y, comp.instruction || '') + (ci < dish.components.length - 1 ? 6.5 : 0)
      })
      if (i < items.length - 1) {
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

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
  const names = profile ? namesFrom(profile) : { firstName: '', lastName: '', savedAs: '' }
  const rawName = (joinName(names.firstName, names.lastName) || names.savedAs || orders[0].customer_name || '').trim()
  const customerName = /@/.test(rawName) ? '' : rawName
  const safeName = customerName.replace(/[^\w .'-]/g, '').trim()

  const badge = await pdf.fetchBadge(process.env.URL || url.origin)
  const file = await pdf.render('Reheat Instructions', doc => draw(doc, { dishes, deliveryDate, customerName, badge }))
  return pdf.pdfResponse(file, `${safeName ? `${safeName} - ` : ''}Reheat Instructions ${deliveryDate}.pdf`)
}
