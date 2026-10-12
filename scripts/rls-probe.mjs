// Checks what a signed-out visitor (anon key only) can do. Reads counts only, never row data;
// write probes target an impossible id so nothing changes even if RLS is off.
// Usage: node --env-file=.env scripts/rls-probe.mjs
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY, { auth: { persistSession: false } })
const NO_ID = '00000000-0000-0000-0000-000000000000'
const tables = ['users', 'Orders', 'entrees', 'salads', 'add_ons', 'weekly_menu', 'delivery_settings', 'surveys', 'survey_responses']

for (const t of tables) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
  console.log(`read   ${t.padEnd(18)} ${error ? 'blocked (' + error.message + ')' : `${count} rows visible`}`)
}
for (const t of ['entrees', 'delivery_settings', 'users']) {
  const { data, error } = await supabase.from(t).update({ id: NO_ID }).eq('id', NO_ID).select('id')
  // Under RLS an update on rows you can't see changes nothing rather than erroring
  console.log(`update ${t.padEnd(18)} ${error ? 'blocked (' + error.message + ')' : `${data.length} rows changed`}`)
}
