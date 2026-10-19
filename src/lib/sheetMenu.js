// The guest menu lives in a public Google Sheet so it can be edited without the admin.
// Columns: week, visible, delivery_date, type (entree|salad|addon), sort_order, name, description,
// price (add-ons only, in dollars)
// headers=1 stops Google from guessing how many rows are headers, which it gets wrong
// when a column is all text (e.g. it can merge the first dish into the "name" header)
export const MENU_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Po7fmDOUBCVRFAQD0Y0zZdiy_6vsgLLavis7LHsnbTU/gviz/tq?tqx=out:csv&headers=1'

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

// Returns { entrees, salads, addOns }, each holding only visible rows sorted by sort_order
export function menuFromCsv(text) {
  const [header = [], ...rows] = parseCsv(text)
  const columns = header.map(h => h.trim().toLowerCase())
  const items = rows.map(cells => {
    const row = {}
    columns.forEach((col, i) => { row[col] = (cells[i] || '').trim() })
    return row
  })

  const visible = items
    .filter(row => (row.visible || '').toUpperCase() === 'TRUE' && row.name)
    .map(row => ({
      // "Entrée" -> entree, "Add-on" -> addon
      type: (row.type || '').toLowerCase().replace('é', 'e').replace(/[^a-z]/g, ''),
      sortOrder: row.sort_order === '' ? Infinity : Number(row.sort_order),
      name: row.name,
      description: row.description || '',
      // Stored in cents to match how the order form already prices add-ons
      price: Math.round(parseFloat((row.price || '').replace(/[$,]/g, '')) * 100)
    }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || 0)

  // The cart keys items by id; the sheet has none, so make a stable one from the row
  const withIds = (type) => visible
    .filter(item => item.type === type)
    .map((item, i) => ({ ...item, id: `${type}-${i}-${item.name}` }))

  return {
    entrees: withIds('entree'),
    salads: withIds('salad'),
    // An add-on without a price can't be charged, so leave it off the menu
    addOns: withIds('addon').filter(item => Number.isFinite(item.price))
  }
}

export async function fetchSheetMenu() {
  const res = await fetch(MENU_SHEET_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Menu sheet returned ${res.status}`)
  return menuFromCsv(await res.text())
}
