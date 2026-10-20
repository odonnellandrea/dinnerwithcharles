// How a customer gets their order. They can tick more than one on the request-to-join form
// (admin can change it); users.delivery_option stores the values comma-separated, e.g. "home,pickup".
export const DELIVERY_OPTIONS = [
  { value: 'home', label: 'Home delivery', hint: 'within range' },
  { value: 'office', label: 'Delivery to an office or a friend’s place', hint: 'within range' },
  { value: 'pickup', label: 'Pickup in NoMad' },
  { value: 'messenger', label: 'Uber messenger delivery', hint: 'anywhere in Manhattan, at cost, $12–18 depending on delivery conditions' },
  { value: 'waitlist', label: 'Waitlist for my neighborhood' }
]

export const parseDeliveryOptions = (text) => String(text || '').split(',').map(s => s.trim()).filter(Boolean)
export const joinDeliveryOptions = (values) => DELIVERY_OPTIONS.map(o => o.value).filter(v => values.includes(v)).join(',')
export const hasDeliveryOption = (text, value) => parseDeliveryOptions(text).includes(value)

// "Home delivery, Pickup in NoMad"
export const deliveryOptionLabel = (text) =>
  parseDeliveryOptions(text).map(v => DELIVERY_OPTIONS.find(o => o.value === v)?.label || v).join(', ')
