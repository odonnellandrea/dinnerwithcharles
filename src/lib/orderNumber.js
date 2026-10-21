// A short, readable number for an order, taken from its id (the customer's email plus the
// time it was placed, e.g. "maya@example.com-1792580000123" -> "#000123"). It appears in the
// emails and the admin Orders table, and typing it into the Orders search finds the order,
// because it is the end of the id.
export function orderNumber(orderId) {
  const digits = String(orderId || '').split('-').pop().replace(/\D/g, '')
  return digits ? `#${digits.slice(-6)}` : ''
}
