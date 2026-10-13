// Consent wording shared by the request-to-join form and the Notification Settings
// screen so customers always see the exact same choices. Edit the text here only.

export const EMAIL_CONSENT_TEXT = 'Email me weekly menu announcements and news from Dinner with Charles.'

export const SMS_CONSENT_TEXT = 'Text me when the menu opens and with order updates from Dinner with Charles. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of joining or ordering.'

export const TRANSACTIONAL_NOTE = "Order confirmations and delivery emails are always sent, whatever you choose here."

// US numbers: 10 digits, or 11 starting with 1. Returns +1XXXXXXXXXX, or null if invalid.
export function normalizeUsPhone(input) {
  const digits = String(input || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

// +15551234567 -> (555) 123-4567; anything else is shown as stored
export function formatUsPhone(value) {
  const normalized = normalizeUsPhone(value)
  if (!normalized) return value || ''
  const d = normalized.slice(2)
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// users.notification_prefs_set_at records when the customer made an explicit choice
// (null = never asked). Until supabase/migrations/20261013_notification_prefs_set_at.sql
// is run the column doesn't exist, so writers retry without it instead of failing.
export const PREFS_SET_COLUMN = 'notification_prefs_set_at'

export const isMissingPrefsColumn = (error) => !!error && String(error.message || '').includes(PREFS_SET_COLUMN)

export function withoutPrefsColumn(payload) {
  const { [PREFS_SET_COLUMN]: _omit, ...rest } = payload
  return rest
}
