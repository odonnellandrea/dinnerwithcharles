// Delivery windows are stored in Orders.delivery_time_slot as a JSON array string,
// e.g. '["1:00 PM - 5:00 PM","5:00 PM - 7:00 PM"]'. Older orders may hold a plain
// comma-separated string. Shared by the app and the Netlify email function.

export const TIME_SLOTS = ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '1:00 PM - 5:00 PM', '5:00 PM - 7:00 PM', '7:00 PM - 9:00 PM']

export const serializeWindows = (windows) => JSON.stringify(sortWindows(windows))

export function parseWindows(value) {
  if (!value) return []
  if (Array.isArray(value)) return sortWindows(value)
  const text = String(value).trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return sortWindows(parsed.map(String))
    } catch {
      // fall through to comma parsing
    }
  }
  return sortWindows(text.split(',').map(s => s.trim()).filter(Boolean))
}

// Earliest window first; anything unrecognised keeps its order at the end
function sortWindows(windows) {
  const rank = (w) => {
    const i = TIME_SLOTS.indexOf(w)
    return i === -1 ? TIME_SLOTS.length : i
  }
  return [...new Set(windows)].sort((a, b) => rank(a) - rank(b))
}

// "1:00 PM - 5:00 PM" -> "1:00 - 5:00 PM"; "11:00 AM - 1:00 PM" stays as is
export function formatWindow(window) {
  const match = String(window).match(/^\s*(\d{1,2}:\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)\s*$/i)
  if (!match) return String(window).trim()
  const [, start, startMeridiem, end, endMeridiem] = match
  return startMeridiem.toUpperCase() === endMeridiem.toUpperCase()
    ? `${start} - ${end} ${endMeridiem.toUpperCase()}`
    : `${start} ${startMeridiem.toUpperCase()} - ${end} ${endMeridiem.toUpperCase()}`
}

// "1:00 - 5:00 PM, 5:00 - 7:00 PM or 7:00 - 9:00 PM"
export function formatWindows(value) {
  const windows = parseWindows(value).map(formatWindow)
  if (windows.length <= 1) return windows[0] || ''
  return `${windows.slice(0, -1).join(', ')} or ${windows[windows.length - 1]}`
}

// Short form for a dashboard: touching windows merge into one span, so
// ["9:00 AM - 11:00 AM","11:00 AM - 1:00 PM","5:00 PM - 7:00 PM"] -> "9 AM - 1 PM or 5 - 7 PM",
// and all five windows -> "Any time, 9 AM - 9 PM".
export function summarizeWindows(value) {
  const windows = parseWindows(value)
  if (windows.length === 0) return ''
  const indexed = windows.map(w => TIME_SLOTS.indexOf(w))
  if (indexed.some(i => i === -1)) return formatWindows(value)
  if (indexed.length === TIME_SLOTS.length) return 'Any time, 9 AM - 9 PM'
  const bounds = (slot) => {
    const [start, end] = slot.split(' - ').map(part => part.trim())
    return { start, end }
  }
  const spans = []
  for (const i of indexed) {
    const last = spans[spans.length - 1]
    if (last && last.lastIndex === i - 1) { last.end = bounds(TIME_SLOTS[i]).end; last.lastIndex = i }
    else spans.push({ start: bounds(TIME_SLOTS[i]).start, end: bounds(TIME_SLOTS[i]).end, lastIndex: i })
  }
  const tidy = (t) => t.replace(':00', '')
  const span = ({ start, end }) => {
    const [sh, sm] = tidy(start).split(' '), [eh, em] = tidy(end).split(' ')
    return sm === em ? `${sh} - ${eh} ${em}` : `${sh} ${sm} - ${eh} ${em}`
  }
  const parts = spans.map(span)
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
}
