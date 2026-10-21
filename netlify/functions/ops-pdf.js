import { createClient } from '@supabase/supabase-js'
import { fetchSheetDishInfo } from '../../src/lib/sheetMenu.js'
import { makePackingList, makeChefReference } from '../pdf/ops.js'
import { json, pdfResponse } from '../pdf/toolkit.js'

// Admin only. GET /.netlify/functions/ops-pdf?date=YYYY-MM-DD&doc=packing|chef|info
//   &family=a@x.com,b@x.com   Andrea and her parents: no packing page, not counted for the chef (shown as :) instead)
//   &rob=c@x.com              families Rob delivers: no packing page, but counted for the chef
// doc=info returns who ordered and which dishes still have a guessed container list, as JSON.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
const ADMIN_EMAIL = 'admin@dinnerwithcharles.com'

const emailList = (value) => new Set((value || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const shortDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const slots = (raw) => {
  try { return [].concat(JSON.parse(raw)).filter(Boolean).join(', ') } catch { return raw || '' }
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
  const url = new URL(req.url)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user } = {}, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json(401, { error: 'Invalid session' })
  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) return json(403, { error: 'Admin only' })

  const date = url.searchParams.get('date') || ''
  const doc = url.searchParams.get('doc')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: 'Pick a delivery date' })
  if (!['packing', 'chef', 'info'].includes(doc)) return json(400, { error: 'Unknown document' })
  const family = emailList(url.searchParams.get('family'))
  const rob = emailList(url.searchParams.get('rob'))

  const { data: orders, error: ordersError } = await supabase.from('Orders').select('*').eq('delivery_date', date).neq('status', 'cancelled')
  if (ordersError) return json(502, { error: 'Could not read the orders: ' + ordersError.message })
  if (!orders?.length) return json(409, { error: `There are no orders for ${shortDate(date)}` })

  let info
  try { info = await fetchSheetDishInfo() } catch (err) { return json(502, { error: 'Could not read the menu sheet: ' + err.message }) }
  const dishInfo = (row) => info[String(row.item_name).toLowerCase()] || {
    type: row.item_type, name: row.item_name, sides: [], description: '', containers: [row.item_name], guessed: true, index: 9999
  }

  const byCustomer = new Map()
  for (const row of orders) {
    const key = String(row.email || row.customer_name).toLowerCase()
    if (!byCustomer.has(key)) byCustomer.set(key, { email: key, name: row.customer_name || row.email, rows: [] })
    byCustomer.get(key).rows.push(row)
  }
  const customers = [...byCustomer.values()].sort((a, b) => a.name.localeCompare(b.name))

  if (doc === 'info') {
    const guessed = [...new Set(orders.map(row => dishInfo(row)).filter(d => d.guessed).map(d => d.name))]
    return json(200, { customers: customers.map(({ email, name }) => ({ email, name })), guessed })
  }

  const weekLabel = `Delivery ${shortDate(date)}`

  if (doc === 'packing') {
    const packed = customers.filter(c => !family.has(c.email) && !rob.has(c.email))
    if (!packed.length) return json(409, { error: 'Everyone who ordered is marked as family or delivered by Rob, so there is nothing to pack' })
    const emails = packed.map(c => c.email)
    const { data: profiles } = await supabase.from('users').select('email, delivery_address').in('email', emails)
    const addressOf = Object.fromEntries((profiles || []).map(p => [String(p.email).toLowerCase(), p.delivery_address]))

    const clients = packed.map(customer => {
      const groups = { entree: [], salad: [], addon: [] }
      for (const row of customer.rows) {
        const dish = dishInfo(row)
        const qty = Math.max(1, Number(row.quantity) || 1)
        for (let n = 1; n <= qty; n++) {
          groups[row.item_type]?.push({ name: qty > 1 ? `${row.item_name} (${n} of ${qty})` : row.item_name, components: dish.containers })
        }
      }
      const first = customer.rows[0]
      const notes = [...new Set(customer.rows.map(r => (r.special_notes || '').trim()).filter(Boolean))]
        .flatMap(note => note.split(/\r?\n/).map(line => line.trim()).filter(Boolean))
      return {
        name: customer.name,
        address: addressOf[customer.email] || '',
        delivery: slots(first.delivery_time_slot),
        entrees: groups.entree,
        salads: groups.salad,
        addons: groups.addon,
        notes
      }
    })
    const file = await makePackingList(clients, weekLabel)
    return pdfResponse(file, `Packing List - ${date}.pdf`)
  }

  // Chef reference: count real customer orders (families Rob delivers included) per dish
  const dishes = new Map()
  for (const customer of customers) {
    for (const row of customer.rows) {
      const dish = dishInfo(row)
      const entry = dishes.get(dish.name) || { dish, type: row.item_type, qty: 0, parentsWant: false }
      const qty = Math.max(1, Number(row.quantity) || 1)
      if (family.has(customer.email)) entry.parentsWant = true
      else entry.qty += qty
      dishes.set(dish.name, entry)
    }
  }
  const ofType = (type) => [...dishes.values()]
    .filter(entry => entry.type === type)
    .sort((a, b) => a.dish.index - b.dish.index)
    .map(({ dish, qty, parentsWant }) => ({
      name: dish.name,
      components: dish.sides,
      description: dish.description,
      packaging: `Per order: ${plural(dish.containers.length, 'container')}. ${dish.containers.join(', ')}.`,
      qty,
      parentsWant
    }))
  const file = await makeChefReference({ weekLabel: `${weekLabel} — Chef Reference`, entrees: ofType('entree'), salads: ofType('salad'), addons: ofType('addon') })
  return pdfResponse(file, `Chef Reference - ${date}.pdf`)
}
