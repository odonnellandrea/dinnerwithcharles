// Referral, promo and business codes. The codes themselves live in the referral_codes table,
// managed from the admin Codes tab; the database functions in
// supabase/migrations/20261022_referral_codes.sql decide what a code is worth.

// Codes are not case sensitive and spaces around them don't count
export const normalizeCode = (value) => String(value || '').trim().toUpperCase()

const dollars = (cents) => {
  const n = Number(cents || 0) / 100
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`
}

export const formatCents = dollars

// What the join form tells someone who typed a good code
export const codeMessage = ({ discount_cents: cents }) =>
  cents > 0 ? `✓ Code applied: ${dollars(cents)} off your first order.` : '✓ Code applied.'
