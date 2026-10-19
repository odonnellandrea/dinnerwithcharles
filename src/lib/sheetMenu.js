// The guest menu lives in a public Google Sheet so it can be edited without the admin.
// Columns: week, visible, week_of, type, sort_order, name, sides, description, price, note
// Types: intro (welcome text), section (a heading; note is its label, like "Pick 3"),
// entree, salad, addon (price in dollars, note shown beside it)
// headers=1 stops Google from guessing how many rows are headers, which it gets wrong
// when a column is all text (e.g. it can merge the first dish into the "name" header)
export const MENU_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1IHDh1o4HhIzHpUAW4MG1qlkQZWt9REv8okGEcOIsiiA/gviz/tq?tqx=out:csv&headers=1'

const DISH_TYPES = ['entree', 'salad', 'addon']
const DEFAULT_TITLES = { entree: 'Entrées', salad: 'Salads', addon: 'Add-ons' }

// Handles quoted fields with commas, doubled quotes and line breaks (descriptions can have all three)
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

// "Entrées" -> entree, "Add-Ons" -> addon, "Salads" -> salad
const toKey = (s) => (s || '').toLowerCase().replace(/é/g, 'e').replace(/[^a-z]/g, '').replace(/s$/, '')

// Returns { intro: [text], sections: [{ title, note, type, items }] }, visible rows only,
// each list sorted by sort_order. A section heading named after a dish type (e.g. "Entrées")
// holds those dishes; dish types without a heading get a default one at the end.
export function menuFromCsv(text) {
  const [header = [], ...rows] = parseCsv(text)
  const columns = header.map(h => h.trim().toLowerCase())

  const visible = rows
    .map(cells => {
      const row = {}
      columns.forEach((col, i) => { row[col] = (cells[i] || '').trim() })
      return row
    })
    .filter(row => (row.visible || '').toUpperCase() === 'TRUE')
    .map(row => ({
      type: toKey(row.type),
      sortOrder: row.sort_order === '' ? Infinity : Number(row.sort_order),
      name: row.name || '',
      sides: row.sides || '',
      description: row.description || '',
      note: row.note || '',
      // Stored in cents to match how the order form already prices add-ons
      price: Math.round(parseFloat((row.price || '').replace(/[$,]/g, '')) * 100)
    }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || 0)

  const ofType = (type) => visible.filter(row => row.type === type)

  // The cart keys items by id; the sheet has none, so make a stable one from the row
  const dishes = {}
  DISH_TYPES.forEach(type => {
    dishes[type] = ofType(type)
      .filter(item => item.name)
      // An add-on without a price can't be charged, so leave it off the menu
      .filter(item => type !== 'addon' || Number.isFinite(item.price))
      .map((item, i) => ({ ...item, id: `${type}-${i}-${item.name}` }))
  })

  const sections = ofType('section').map(row => {
    const type = DISH_TYPES.includes(toKey(row.name)) ? toKey(row.name) : null
    return { title: row.name, note: row.note, type, items: type ? dishes[type] : [] }
  })
  DISH_TYPES.forEach(type => {
    if (dishes[type].length > 0 && !sections.some(s => s.type === type)) {
      sections.push({ title: DEFAULT_TITLES[type], note: '', type, items: dishes[type] })
    }
  })

  return {
    intro: ofType('intro').map(row => row.description || row.name).filter(Boolean),
    // Same ids as in sections, flat by type, for the cart, review screen and order rows
    entrees: dishes.entree,
    salads: dishes.salad,
    addOns: dishes.addon,
    sections: sections.filter(s => s.type ? s.items.length > 0 : s.title)
  }
}

export async function fetchSheetMenu() {
  const res = await fetch(MENU_SHEET_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Menu sheet returned ${res.status}`)
  return menuFromCsv(await res.text())
}
