// Shared by the order form and the confirmation email so totals never drift apart.
export const BASE_PRICE = 160
export const BASE_ENTREES = 3
export const BASE_SALADS = 2
export const EXTRA_ENTREE_PRICE = 40
export const EXTRA_SALAD_PRICE = 15
// Uber messenger for customers outside the walking range, passed through at cost.
// Default per customer; admin sets the real cost on each customer's card.
export const MESSENGER_FEE = 12
export const MESSENGER_FEE_RANGE = '$12–18'

// What messenger delivery adds to one customer's order. Zero is a real fee (waived), so only a
// missing or invalid value falls back to the default.
export function messengerFeeFor(profile) {
  if (profile?.messenger_delivery !== true) return 0
  const fee = profile.messenger_fee == null ? NaN : Number(profile.messenger_fee)
  return Number.isFinite(fee) && fee >= 0 ? fee : MESSENGER_FEE
}

// The base package price and complimentary flag from a customer's profile (admin sets both)
export function pricingFor(profile) {
  const base = profile?.base_price == null ? NaN : Number(profile.base_price)
  return { basePrice: Number.isFinite(base) && base >= 0 ? base : BASE_PRICE, complimentary: profile?.complimentary === true }
}

// discount (dollars) comes off the food only, never the messenger fee, and never below zero.
// A complimentary order costs nothing at all.
export function priceOrder({ entreeCount, saladCount, addOnsCost = 0, messengerFee = 0, discount = 0, basePrice = BASE_PRICE, complimentary = false }) {
  const extraEntrees = Math.max(0, entreeCount - BASE_ENTREES)
  const extraSalads = Math.max(0, saladCount - BASE_SALADS)
  const entreeUpcharge = extraEntrees * EXTRA_ENTREE_PRICE
  const saladUpcharge = extraSalads * EXTRA_SALAD_PRICE
  const subtotal = basePrice + entreeUpcharge + saladUpcharge + addOnsCost
  const discountTaken = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  return {
    basePrice,
    complimentary,
    extraEntrees,
    extraSalads,
    entreeUpcharge,
    saladUpcharge,
    addOnsCost,
    messengerFee,
    subtotal,
    discount: discountTaken,
    total: complimentary ? 0 : subtotal - discountTaken + messengerFee
  }
}
