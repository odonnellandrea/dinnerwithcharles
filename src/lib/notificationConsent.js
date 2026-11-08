// Consent wording shared by the request-to-join form and the Notification Settings
// screen so customers always see the exact same choices. Edit the text here only.

export const EMAIL_CONSENT_TEXT = 'Email me weekly menu announcements and news from Dinner with Charles.'

// Two separate text consents: the first is about their orders and the weekly menu, the second
// is marketing. Each needs its own clear yes.
export const SMS_CONSENT_TEXT = "Text me when the menu opens and with updates about my orders and deliveries from Dinner with Charles."

export const SMS_MARKETING_CONSENT_TEXT = "Text me occasional news and offers from Dinner with Charles."

export const SMS_TERMS_TEXT = "Texts are sent by a person, not a machine, so frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of joining or ordering."

// Until 20261108_sms_marketing_opt_in.sql is run, writes with the new column fail; retry without it
export const isMissingSmsMarketingColumn = (error) => !!error && String(error.message || '').includes('sms_marketing_opt_in')
export function withoutSmsMarketingColumn(payload) {
  const { sms_marketing_opt_in: _m, ...rest } = payload
  return rest
}

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

// users.notification_prefs_set_at records when the customer was asked or made a choice
// (null = never asked; customers are asked once, then change choices in Settings). Until supabase/migrations/20261013_notification_prefs_set_at.sql
// is run the column doesn't exist, so writers retry without it instead of failing.
export const PREFS_SET_COLUMN = 'notification_prefs_set_at'

export const isMissingPrefsColumn = (error) => !!error && String(error.message || '').includes(PREFS_SET_COLUMN)

export function withoutPrefsColumn(payload) {
  const { [PREFS_SET_COLUMN]: _omit, ...rest } = payload
  return rest
}
