import { createClient } from '@supabase/supabase-js'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)

// Fetches a PDF from one of our functions with the customer's session and saves it,
// using the filename the function chose. Throws with a readable message on failure.
export async function downloadPdf(path, fallbackName) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
  if (!res.ok) {
    const { error: message } = await res.json().catch(() => ({}))
    throw new Error(message || `Request failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')
  const a = document.createElement('a')
  a.href = url
  a.download = match ? match[1] : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
