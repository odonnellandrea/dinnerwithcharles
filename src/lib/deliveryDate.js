// The next Monday as "YYYY-MM-DD" in the admin's own time zone. Built from the local date parts
// rather than toISOString(), which gives the UTC date and in New York after 8pm is already tomorrow.
export function nextMonday(now = new Date()) {
  const monday = new Date(now)
  monday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7))
  const pad = (n) => String(n).padStart(2, '0')
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
}
