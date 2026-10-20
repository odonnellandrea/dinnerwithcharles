// Customers have first_name and last_name; users.name keeps the full name so orders,
// admin lists and older code keep working. Everything that writes a name goes through here.
// A name saved before the split is never guessed apart: the first/last fields start blank
// and the old full name is shown as a hint until someone enters both parts.

export const joinName = (firstName, lastName) => [firstName, lastName].map(s => String(s || '').trim()).filter(Boolean).join(' ')

// Columns to save for a first and last name
export const nameColumns = (firstName, lastName) => ({
  first_name: String(firstName || '').trim(),
  last_name: String(lastName || '').trim(),
  name: joinName(firstName, lastName)
})

// Read first/last from a profile row. Older rows only have name, which is left alone.
export const namesFrom = (row) => ({
  firstName: row?.first_name || '',
  lastName: row?.last_name || '',
  // The full name as saved before the split, if first/last were never entered
  savedAs: !row?.first_name && !row?.last_name ? String(row?.name || '').trim() : ''
})

// Until supabase/migrations/20261020_first_last_name.sql is run, writes with the new
// columns fail; retry with just name so nobody is blocked by a pending migration
export const isMissingNameColumns = (error) => /first_name|last_name/.test(String(error?.message || ''))
export function withoutNameColumns(payload) {
  const { first_name: _f, last_name: _l, ...rest } = payload
  return rest
}
