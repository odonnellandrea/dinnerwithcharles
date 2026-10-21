import { BASE_ENTREES, BASE_SALADS } from './pricing.js'

// The guest menu lives in a public Google Sheet so it can be edited without the admin.
// Columns: week, visible, week_of, type, sort_order, name, sides, description, price, note, reheat
// Types: intro (welcome text), section (a heading; note is its label, like "Pick 3"),
// entree, salad, addon (price in dollars, note shown beside it)
// reheat: one step per line in the cell, optionally labeled, e.g. "Cod: Bake at 350°F for 10 min".
// The reheat guide reads it live, so edits show up on every guide that includes the dish.
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

// One step per line. "Cod: Bake 10 min" becomes { name: 'Cod', instruction: 'Bake 10 min' }; a line
// whose text before the colon has digits (e.g. "Bake at 350°F: 10 min") is left as one instruction.
export function parseReheat(text) {
  return (text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const colon = line.indexOf(':')
      const label = colon > 0 ? line.slice(0, colon).trim() : ''
      if (label && label.length <= 40 && !/\d/.test(label)) {
        return { name: label, instruction: line.slice(colon + 1).trim() }
      }
      return { name: '', instruction: line }
    })
}

// "Entrées" -> entree, "Add-Ons" -> addon, "Salads" -> salad
const toKey = (s) => (s || '').toLowerCase().replace(/é/g, 'e').replace(/[^a-z]/g, '').replace(/s$/, '')

// Returns { weeks, weekOf, intro: [text], sections: [{ title, note, type, items }] }, visible rows only,
// each list sorted by sort_order. A section heading named after a dish type (e.g. "Entrées")
// holds those dishes; dish types without a heading get a default one at the end.
// A cell Sheets couldn't calculate comes through as text like "#ERROR!" (typing a note that
// starts with "+" or "=" does it). Treat those as empty so customers never see them.
const SHEET_ERROR = /^#(ERROR!|REF!|N\/A|VALUE!|NAME\?|DIV\/0!|NUM!|NULL!)/

// Every sheet row as { column: trimmed value }
function rowsFromCsv(text) {
  const [header = [], ...rows] = parseCsv(text)
  const columns = header.map(h => h.trim().toLowerCase())
  return rows.map(cells => {
    const row = {}
    columns.forEach((col, i) => {
      const value = (cells[i] || '').trim()
      row[col] = SHEET_ERROR.test(value) ? '' : value
    })
    return row
  })
}

// How many to pick, when the sheet's heading row has no note: the base package is fixed
const defaultNote = (type) => type === 'entree' ? `Pick ${BASE_ENTREES}` : type === 'salad' ? `Pick ${BASE_SALADS}` : ''

// "+ $5 jar deposit" -> 500; 0 when the note doesn't promise a deposit
export function depositFromNote(note) {
  const match = /\+\s*\$\s*(\d+(?:\.\d{1,2})?)[^,;]*deposit/i.exec(note || '')
  return match ? Math.round(parseFloat(match[1]) * 100) : 0
}

export function menuFromCsv(text) {
  const visible = rowsFromCsv(text)
    .filter(row => (row.visible || '').toUpperCase() === 'TRUE')
    .map(row => ({
      type: toKey(row.type),
      sortOrder: row.sort_order === '' ? Infinity : Number(row.sort_order),
      name: row.name || '',
      sides: row.sides || '',
      description: row.description || '',
      note: row.note || '',
      // Stored in cents to match how the order form already prices add-ons
      price: Math.round(parseFloat((row.price || '').replace(/[$,]/g, '')) * 100),
      // A note like "+ $5 jar deposit" is charged automatically, once per add-on ordered, in cents
      deposit: depositFromNote(row.note)
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
    return { title: row.name, note: row.note || defaultNote(type), type, items: type ? dishes[type] : [] }
  })
  DISH_TYPES.forEach(type => {
    if (dishes[type].length > 0 && !sections.some(s => s.type === type)) {
      sections.push({ title: DEFAULT_TITLES[type], note: defaultNote(type), type, items: dishes[type] })
    }
  })

  // Which sheet weeks the visible dishes come from (more than one means last week wasn't hidden)
  const weekRows = rowsFromCsv(text).filter(row => (row.visible || '').toUpperCase() === 'TRUE' && DISH_TYPES.includes(toKey(row.type)))
  const weeks = [...new Set(weekRows.map(row => Number(row.week)).filter(Number.isFinite))].sort((a, b) => a - b)
  const weekOf = weekRows.map(row => row.week_of).find(Boolean) || ''

  return {
    weeks,
    weekOf,
    intro: ofType('intro').map(row => row.description || row.name).filter(Boolean),
    // Same ids as in sections, flat by type, for the cart, review screen and order rows
    entrees: dishes.entree,
    salads: dishes.salad,
    addOns: dishes.addon,
    sections: sections.filter(s => s.type ? s.items.length > 0 : s.title)
  }
}

// Dish name (lowercased) -> reheat steps, from every dish row whether visible or not, so past
// weeks' guides keep working after their rows are hidden. A name used in more than one week
// takes its steps from the highest week number.
export function reheatFromCsv(text) {
  const best = {}
  rowsFromCsv(text)
    .filter(row => DISH_TYPES.includes(toKey(row.type)) && row.name && row.reheat)
    .forEach(row => {
      const key = row.name.toLowerCase()
      const week = Number(row.week) || 0
      if (!best[key] || week >= best[key].week) best[key] = { week, steps: parseReheat(row.reheat) }
    })
  const steps = {}
  Object.entries(best).forEach(([key, { steps: s }]) => { steps[key] = s })
  return steps
}

// What the kitchen documents (packing lists, chef reference) need to know about each dish, by
// name (lowercased), from every dish row whether visible or not. A name used in more than one
// week takes the highest week. `containers` is the optional sheet column of that name: one
// container per line, e.g. "Chicken\nFarro with roasted root vegetables\nLemon-rosemary sauce".
// `guessed` is true when the sheet has none yet, so the list is made up from the reheat step
// names, or else the sides, and needs a check.
export function dishInfoFromCsv(text) {
  const lines = (value) => (value || '').split('\n').map(line => line.trim()).filter(Boolean)
  const best = {}
  rowsFromCsv(text)
    .filter(row => DISH_TYPES.includes(toKey(row.type)) && row.name)
    .forEach((row, index) => {
      const key = row.name.toLowerCase()
      const week = Number(row.week) || 0
      if (best[key] && week < best[key].week) return
      const type = toKey(row.type)
      const sides = (row.sides || '').split('·').map(part => part.trim()).filter(Boolean)
      const fromSheet = lines(row.containers)
      const reheatNames = type === 'addon' ? [] : parseReheat(row.reheat).map(step => step.name).filter(Boolean)
      const guess = reheatNames.length ? reheatNames : type === 'entree' ? [row.name, ...sides] : [row.name]
      best[key] = {
        week,
        index,
        type,
        name: row.name,
        sides,
        description: row.description || '',
        containers: fromSheet.length ? fromSheet : guess,
        guessed: fromSheet.length === 0
      }
    })
  return best
}

// The last copy of the sheet is kept in the browser, so a repeat visit can show the menu
// at once while the fresh copy downloads. Server code has no localStorage; this just no-ops there.
const CACHE_KEY = 'dwc-menu-sheet'
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000
const SHARE_WINDOW_MS = 15 * 1000

function readCachedCsv() {
  try {
    const { at, csv } = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') || {}
    return typeof csv === 'string' && Date.now() - at < CACHE_MAX_AGE_MS ? csv : null
  } catch { return null }
}

function writeCachedCsv(csv) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), csv })) } catch { /* private mode or full: skip */ }
}

// One download shared by everything that asks within a few seconds (the early prefetch,
// the menu page, the reheat guide). force: true always downloads again.
let inflight = null
function fetchSheetCsv({ force = false } = {}) {
  if (!force && inflight && Date.now() - inflight.at < SHARE_WINDOW_MS) return inflight.promise
  const promise = (async () => {
    const res = await fetch(MENU_SHEET_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Menu sheet returned ${res.status}`)
    const csv = await res.text()
    writeCachedCsv(csv)
    return csv
  })()
  inflight = { at: Date.now(), promise }
  promise.catch(() => { if (inflight?.promise === promise) inflight = null })
  return promise
}

export async function fetchSheetMenu(options) {
  return menuFromCsv(await fetchSheetCsv(options))
}

// The menu from the last visit, or null if there isn't a recent one
export function getCachedSheetMenu() {
  const csv = readCachedCsv()
  if (!csv) return null
  try { return menuFromCsv(csv) } catch { return null }
}

// Start the download without waiting for it, so it runs while the page loads
export function prefetchSheetMenu() {
  fetchSheetCsv().catch(() => {})
}

export async function fetchSheetReheat() {
  return reheatFromCsv(await fetchSheetCsv())
}

export async function fetchSheetDishInfo() {
  return dishInfoFromCsv(await fetchSheetCsv())
}
