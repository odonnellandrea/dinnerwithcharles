import { createClient } from '@supabase/supabase-js'

// The one Supabase connection for the whole app. Every screen imports this rather than making
// its own: each client runs its own sign-in handling over the same saved login, and with many
// of them the refreshes and locks collide, which stalls sign-in and makes loads come back empty.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)
