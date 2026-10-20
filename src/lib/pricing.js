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

export function priceOrder({ entreeCount, saladCount, addOnsCost = 0, messengerFee = 0 }) {
  const extraEntrees = Math.max(0, entreeCount - BASE_ENTREES)
  const extraSalads = Math.max(0, saladCount - BASE_SALADS)
  const entreeUpcharge = extraEntrees * EXTRA_ENTREE_PRICE
  const saladUpcharge = extraSalads * EXTRA_SALAD_PRICE
  return {
    extraEntrees,
    extraSalads,
    entreeUpcharge,
    saladUpcharge,
    addOnsCost,
    messengerFee,
    total: BASE_PRICE + entreeUpcharge + saladUpcharge + addOnsCost + messengerFee
  }
}
