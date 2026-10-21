import { createClient } from '@supabase/supabase-js'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)

const WAITING_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preparing your PDF</title>
<body style="margin:0;background:#faf8f3;color:#1a441f;font-family:Georgia,'Times New Roman',serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center">
<p style="font-size:20px;font-style:italic">Preparing your PDF&hellip;</p></body>`

// Fetches a PDF from one of our functions with the customer's session and shows it in a NEW
// tab, so the page they were on stays put. Browsers only allow a new tab while handling the
// tap itself, so the tab is opened first and pointed at the PDF once it is ready. If the
// browser blocks that, it falls back to a link that opens or saves the file.
// Throws with a readable message on failure.
export async function downloadPdf(path, fallbackName) {
  let tab = null
  try {
    tab = window.open('', '_blank')
    tab?.document.write(WAITING_PAGE)
    tab?.document.close()
  } catch { tab = null }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (!res.ok) {
      const { error: message } = await res.json().catch(() => ({}))
      throw new Error(message || `Request failed (${res.status})`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')

    if (tab && !tab.closed) {
      tab.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener'
      a.download = match ? match[1] : fallbackName
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
  } catch (err) {
    try { tab?.close() } catch { /* already closed */ }
    throw err
  }
}
