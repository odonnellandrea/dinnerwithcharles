// Away date ranges: { starts_on, ends_on, note } as "YYYY-MM-DD" strings

const short = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// "Nov 24–30", "Dec 20–Jan 4", or a single day "Nov 10"
export function formatRange({ starts_on, ends_on }) {
  if (starts_on === ends_on) return short(starts_on)
  const sameMonth = starts_on.slice(0, 7) === ends_on.slice(0, 7)
  return sameMonth ? `${short(starts_on)}–${Number(ends_on.slice(8))}` : `${short(starts_on)}–${short(ends_on)}`
}

export const todayIso = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Ranges that haven't finished yet, soonest first
export const upcoming = (ranges, today = todayIso()) =>
  (ranges || []).filter(r => r.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))

export const isAwayOn = (ranges, dateIso) => !!dateIso && (ranges || []).some(r => r.starts_on <= dateIso && dateIso <= r.ends_on)

// "Away Nov 24–30, then Dec 20–Jan 4"
export function awaySummary(ranges, today = todayIso()) {
  const next = upcoming(ranges, today)
  if (!next.length) return ''
  const [first, ...rest] = next
  const now = first.starts_on <= today
  return `${now ? 'Away until ' + short(first.ends_on) : 'Away ' + formatRange(first)}${rest.length ? ', then ' + rest.map(formatRange).join(', ') : ''}`
}
