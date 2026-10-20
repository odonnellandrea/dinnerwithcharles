import PDFDocument from 'pdfkit'

// Shared drawing for the customer PDFs (menu, reheat guide), measured from the Weekly
// Kitchen toolkit's PDFs so the downloads match the files Andrea sends by hand.
export const WIDTH = 324
export const PAGE = '#f6f1e4'
export const EDGE = '#d9cdb2'
export const BOX = '#e4dbc2'
export const GREEN = '#1e2e21'
export const GOLD = '#b8923f'
export const INK = '#2b2b2b'
export const MUTED = '#6f6c5e'
export const TAG = '#8e8a7a'
export const RULE = '#cfc9b6'
export const SIDE = 12
export const TOP = 29
export const L = 30
export const R = WIDTH - 31
export const CW = R - L
export const TX = 62          // text column beside the number circle
export const TW = R - TX

export const shortDate = (dateStr) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return `${m}/${d}/${String(y).slice(2)}`
}

export function frame(doc) {
  const H = doc.page.height
  doc.rect(0, 0, WIDTH, H).fill(EDGE)
  doc.rect(SIDE, TOP, WIDTH - SIDE * 2, H - TOP * 2).fill(PAGE)
  doc.rect(SIDE, TOP, WIDTH - SIDE * 2, 2).fill(GREEN)
}

// "DINNER WITH CHARLES / Weekly Kitchen / cooked by ... / WEEK OF m/d/yy" plus an optional line
// under the tag. Returns the y where body text can start.
export function header(doc, { weekOf, subline }) {
  doc.font('Courier').fontSize(8).fillColor(GREEN).text('DINNER WITH CHARLES', L, 54, { width: CW, align: 'center' })
  doc.font('Times-Bold').fontSize(26).fillColor(GREEN).text('Weekly Kitchen', L, 65, { width: CW, align: 'center' })
  doc.font('Times-Italic').fontSize(10).fillColor(MUTED).text('cooked by Chef Robert, your private chef', L, 92, { width: CW, align: 'center' })
  const pill = `WEEK OF ${shortDate(weekOf)}`
  doc.font('Courier').fontSize(8)
  const pw = doc.widthOfString(pill) + 24
  doc.rect((WIDTH - pw) / 2, 118, pw, 19).fill(GREEN)
  doc.fillColor(PAGE).text(pill, (WIDTH - pw) / 2, 124, { width: pw, align: 'center' })
  if (subline) {
    doc.font('Courier').fontSize(7.5).fillColor(TAG).text(subline.toUpperCase(), L, 149, { width: CW, align: 'center' })
    return 171
  }
  return 162
}

// Centered paragraph in the body font. Returns y after it.
export function intro(doc, y, text) {
  doc.font('Helvetica').fontSize(9.5).fillColor(INK)
  return wrapped(doc, text, L + 2, y, CW - 4, { lineGap: 4.7, align: 'center' })
}

// Wraps on spaces only, like the toolkit's PDFs (pdfkit would also break at hyphens).
// Draws each line at x and returns the y after the last line.
export function wrapped(doc, text, x, y, width, { lineGap = 0, align = 'left' } = {}) {
  const lines = []
  String(text).split('\n').forEach(paragraphText => {
    let line = ''
    paragraphText.split(/\s+/).filter(Boolean).forEach(word => {
      const trial = line ? `${line} ${word}` : word
      if (line && doc.widthOfString(trial) > width) { lines.push(line); line = word } else line = trial
    })
    lines.push(line)
  })
  const pitch = doc.currentLineHeight() + lineGap
  lines.forEach(line => { doc.text(line, x, y, { width, align, lineBreak: false }); y += pitch })
  return y
}

export const rule = (doc, y) => { doc.moveTo(L, y).lineTo(R, y).lineWidth(0.7).stroke(RULE) }
export const dashedRule = (doc, y) => { doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).dash(1.5, { space: 2.5 }).stroke(RULE).undash() }

// Section title with a green tag ("Pick 3") or an italic subtitle. Returns y for the first item.
export function sectionHeading(doc, y, title, { tag, subtitle } = {}) {
  doc.font('Times-Bold').fontSize(16).fillColor(GREEN).text(title, L, y)
  if (tag) {
    doc.font('Courier').fontSize(8)
    const tw = doc.widthOfString(tag) + 16
    doc.rect(R - tw, y + 1, tw, 16).fill(GREEN)
    doc.fillColor(PAGE).text(tag, R - tw, y + 5.5, { width: tw, align: 'center' })
  }
  if (subtitle) {
    doc.font('Times-Italic').fontSize(9).fillColor(MUTED).text(subtitle, L, y + 19, { width: CW })
    return y + 39
  }
  y += 21
  doc.moveTo(L, y).lineTo(R, y).lineWidth(1.6).stroke(GREEN)
  return y + 10
}

// Numbered dish: circle with "01", bold italic name, monospace tag line. Returns y after the tag line.
export function dishTitle(doc, y, num, name, tagLine) {
  doc.circle(42.5, y + 14, 11).lineWidth(1).stroke('#a9a697')
  doc.font('Courier').fontSize(9).fillColor('#8c8a7c').text(String(num).padStart(2, '0'), 31, y + 10.5, { width: 23, align: 'center' })
  doc.font('Times-BoldItalic').fontSize(13).fillColor(GREEN)
  y = wrapped(doc, name, TX, y, TW, { lineGap: 4.3 })
  if (tagLine) {
    y += 3.7
    doc.font('Courier').fontSize(8).fillColor(TAG)
    y = wrapped(doc, tagLine.toUpperCase(), TX, y, TW, { lineGap: 4.7 }) + 4.5
  } else {
    y += 2.2
  }
  return y
}

// Body paragraph in the dish column. Returns y after it.
export function paragraph(doc, y, text, { x = TX, width = TW, size = 9, lineGap = 4.2 } = {}) {
  doc.font('Helvetica').fontSize(size).fillColor(INK)
  return wrapped(doc, text, x, y, width, { lineGap })
}

// Tan box with the round badge and the contact line, then the handle. Returns the content end y.
export function footer(doc, y, badge) {
  y += 7
  const bh = badge ? 136 : 84
  doc.rect(L, y, CW, bh).fill(BOX)
  let fy = y + 22
  if (badge) {
    doc.image(badge, (WIDTH - 50) / 2, y + 26, { width: 50 })
    fy = y + 88
  }
  doc.font('Times-BoldItalic').fontSize(13).fillColor(GREEN).text('Questions About Your Order?', L, fy, { width: CW, align: 'center' })
  doc.font('Times-Italic').fontSize(9).fillColor(MUTED).text("Reach out anytime — we're happy to help.", L, fy + 18, { width: CW, align: 'center' })
  y += bh + 15
  doc.font('Courier').fontSize(8).fillColor(GREEN).text('@DINNERWITHCHARLES', L, y, { width: CW, align: 'center' })
  return y + 33
}

// Fetch the round badge from the site (nothing to bundle); null if it can't be reached.
export async function fetchBadge(siteUrl) {
  try {
    const res = await fetch(`${siteUrl}/Round%20Badge.png`)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
  } catch { /* text-only footer */ }
  return null
}

// Two passes: measure on a tall page, then draw on a page cut to size, like the toolkit's PDFs.
export function render(title, drawBody) {
  const probe = new PDFDocument({ size: [WIDTH, 6000], margin: 0 })
  const height = Math.ceil(drawBody(probe) + TOP)
  probe.end()
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [WIDTH, height], margin: 0, info: { Title: title, Author: 'Dinner with Charles' } })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    drawBody(doc)
    doc.rect(SIDE, height - TOP - 2, WIDTH - SIDE * 2, 2).fill(GREEN)
    doc.end()
  })
}

export const pdfResponse = (pdf, filename) => new Response(pdf, {
  status: 200,
  headers: {
    'content-type': 'application/pdf',
    'content-disposition': `attachment; filename="${filename.replace(/["\\]/g, '')}"`,
    'cache-control': 'private, no-store'
  }
})

export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
