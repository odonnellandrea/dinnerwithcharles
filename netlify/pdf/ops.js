import PDFDocument from 'pdfkit'

// The kitchen's 4x6in black-and-white thermal documents (packing lists and chef reference),
// ported line for line from the weekly-kitchen-packing-list and weekly-kitchen-chef-reference
// skills. Those were written for reportlab, where y counts up from the bottom of the page and
// text is placed by its baseline; Canvas below gives pdfkit the same calls so the drawing code
// can stay as it was.
const PAGE_W = 288
const PAGE_H = 432
const BLACK = '#000000'
const WHITE = '#ffffff'
const GREY = '#4d4d4d'

class Canvas {
  constructor(title, size = [PAGE_W, PAGE_H]) {
    this.W = size[0]
    this.H = size[1]
    this.doc = new PDFDocument({ size, margin: 0, info: { Title: title, Author: 'Dinner with Charles' } })
    this.chunks = []
    this.doc.on('data', chunk => this.chunks.push(chunk))
    this.font = 'Helvetica'
    this.size = 10
    this.fill = BLACK
    this.stroke = BLACK
    this.lineWidth = 1
  }

  setFont(name, size) { this.font = name; this.size = size }
  setFillColor(color) { this.fill = color }
  setStrokeColor(color) { this.stroke = color }
  setLineWidth(width) { this.lineWidth = width }

  stringWidth(text, font, size) { return this.doc.font(font).fontSize(size).widthOfString(text) }

  drawText(x, baseline, text, align) {
    this.doc.font(this.font).fontSize(this.size).fillColor(this.fill)
    const ascent = (this.doc._font.ascender * this.size) / 1000
    const width = this.doc.widthOfString(text)
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
    this.doc.text(text, left, this.H - baseline - ascent, { lineBreak: false })
  }

  drawString(x, y, text) { this.drawText(x, y, text, 'left') }
  drawRightString(x, y, text) { this.drawText(x, y, text, 'right') }
  drawCentredString(x, y, text) { this.drawText(x, y, text, 'center') }

  line(x1, y1, x2, y2) {
    this.doc.moveTo(x1, this.H - y1).lineTo(x2, this.H - y2).lineWidth(this.lineWidth).stroke(this.stroke)
  }

  // y is the bottom edge, as in reportlab
  rect(x, y, w, h, { fill = false, stroke = true } = {}) {
    const top = this.H - y - h
    this.doc.lineWidth(this.lineWidth)
    if (fill && stroke) this.doc.rect(x, top, w, h).fillAndStroke(this.fill, this.stroke)
    else if (fill) this.doc.rect(x, top, w, h).fill(this.fill)
    else if (stroke) this.doc.rect(x, top, w, h).stroke(this.stroke)
  }

  circle(cx, cy, r, { fill = true, stroke = false } = {}) {
    this.doc.lineWidth(this.lineWidth)
    const shape = this.doc.circle(cx, this.H - cy, r)
    if (fill && stroke) shape.fillAndStroke(this.fill, this.stroke)
    else if (fill) shape.fill(this.fill)
    else if (stroke) shape.stroke(this.stroke)
  }

  // Text at an angle, counter-clockwise like reportlab's rotate(), starting at (x, baseline)
  drawRotated(x, baseline, angle, text) {
    this.doc.save()
    this.doc.translate(x, this.H - baseline)
    this.doc.rotate(-angle)
    this.doc.font(this.font).fontSize(this.size).fillColor(this.fill)
    const ascent = (this.doc._font.ascender * this.size) / 1000
    this.doc.text(text, 0, -ascent, { lineBreak: false })
    this.doc.restore()
  }

  showPage() { this.doc.addPage({ size: [this.W, this.H], margin: 0 }) }

  finish() {
    return new Promise((resolve, reject) => {
      this.doc.on('end', () => resolve(Buffer.concat(this.chunks)))
      this.doc.on('error', reject)
      this.doc.end()
    })
  }
}

// Word-wrap on spaces only, like the skills' versions
function wrapText(c, text, font, size, maxWidth) {
  const lines = []
  let cur = ''
  for (const word of String(text).split(' ')) {
    const test = `${cur} ${word}`.trim()
    if (c.stringWidth(test, font, size) > maxWidth) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// clients: [{ name, household?, address?, delivery?, entrees: [{ name, components }], salads?, addons?, notes? }]
export function makePackingList(clients, weekLabel) {
  const c = new Canvas(`Packing List - ${weekLabel}`)

  const drawClient = (order) => {
    const margin = 0.26 * 72
    const contentW = PAGE_W - 2 * margin
    const x = margin
    const y = [PAGE_H - margin]
    const groups = [['ENTRÉES', order.entrees || []], ['SIDES', order.salads || []], ['ADD-ONS', order.addons || []]]
    const totalContainers = groups.reduce((sum, [, items]) => sum + items.reduce((n, item) => n + item.components.length, 0), 0)

    c.setFillColor(BLACK)
    c.setFont('Helvetica-Bold', 9.5)
    c.drawString(x, y[0], 'DINNER WITH CHARLES')
    c.setFillColor(GREY)
    c.setFont('Helvetica', 7.5)
    c.drawRightString(PAGE_W - margin, y[0], `Packing List — ${weekLabel}`)
    y[0] -= 24

    c.setFillColor(BLACK)
    c.setFont('Helvetica-Bold', 15)
    for (const nameLine of wrapText(c, order.name, 'Helvetica-Bold', 15, contentW - 60)) {
      c.drawString(x, y[0], nameLine)
      y[0] -= 15.5
    }
    y[0] += 1.5

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(GREY)
    c.drawRightString(PAGE_W - margin, y[0] + 10, `${totalContainers} containers`)

    c.setFont('Helvetica', 7.3)
    c.setFillColor(BLACK)
    for (const [key, prefix] of [['household', ''], ['address', ''], ['delivery', 'Delivery: ']]) {
      if (order[key]) {
        for (const line of wrapText(c, `${prefix}${order[key]}`, 'Helvetica', 7.3, contentW)) {
          c.drawString(x, y[0], line)
          y[0] -= 9.5
        }
      }
    }
    y[0] -= 5

    c.setStrokeColor(BLACK)
    c.setLineWidth(0.8)
    c.line(x, y[0], x + contentW, y[0])
    y[0] -= 12

    const footer = () => {
      c.setFont('Helvetica', 6)
      c.setFillColor(GREY)
      c.drawCentredString(PAGE_W / 2, 0.18 * 72, '@dinnerwithcharles')
    }

    const newContinuationPage = () => {
      footer()
      c.showPage()
      y[0] = PAGE_H - margin
      c.setFillColor(BLACK)
      c.setFont('Helvetica-Bold', 10)
      c.drawString(x, y[0], `${order.name} (continued)`)
      y[0] -= 22
    }

    const checklistLine = (label, indent = 3) => {
      const boxX = x + indent
      c.setStrokeColor(BLACK)
      c.setLineWidth(0.7)
      c.rect(boxX, y[0] - 0.5, 7, 7, { fill: false, stroke: true })
      c.setFillColor(BLACK)
      c.setFont('Helvetica', 8.3)
      const labelLines = wrapText(c, label, 'Helvetica', 8.3, contentW - indent - 12)
      c.drawString(boxX + 11, y[0], labelLines[0])
      y[0] -= 10.5
      for (const extra of labelLines.slice(1)) {
        c.drawString(boxX + 11, y[0], extra)
        y[0] -= 10.5
      }
    }

    const groupHeader = (title) => {
      if (y[0] < 0.55 * 72) newContinuationPage()
      c.setFont('Helvetica-Bold', 8.5)
      c.setFillColor(BLACK)
      c.drawString(x, y[0], title)
      y[0] -= 12
    }

    const dishGroup = (item) => {
      let est = 9.5 * wrapText(c, item.name, 'Helvetica-BoldOblique', 7.6, contentW).length
      for (const comp of item.components) est += 10.5 * wrapText(c, comp, 'Helvetica', 8.3, contentW - 15).length
      if (y[0] - est < 0.55 * 72) newContinuationPage()
      c.setFont('Helvetica-BoldOblique', 7.6)
      c.setFillColor(GREY)
      for (const line of wrapText(c, item.name, 'Helvetica-BoldOblique', 7.6, contentW)) {
        c.drawString(x, y[0], line)
        y[0] -= 9.5
      }
      for (const comp of item.components) checklistLine(comp, 3)
      y[0] -= 3
    }

    let first = true
    for (const [title, items] of groups) {
      if (!items.length) continue
      if (!first) y[0] -= 2
      first = false
      groupHeader(title)
      items.forEach(dishGroup)
    }

    if (order.notes?.length) {
      let estNotes = 19
      for (const line of order.notes) estNotes += 8 * wrapText(c, line, 'Helvetica', 6.8, contentW).length
      if (y[0] - estNotes < 0.35 * 72) newContinuationPage()
      c.setStrokeColor(GREY)
      c.setLineWidth(0.4)
      c.line(x, y[0], x + contentW, y[0])
      y[0] -= 10
      c.setFont('Helvetica-Bold', 7)
      c.setFillColor(BLACK)
      c.drawString(x, y[0], 'SPECIAL INSTRUCTIONS')
      y[0] -= 9
      c.setFont('Helvetica', 6.8)
      c.setFillColor(GREY)
      for (const line of order.notes) {
        for (const noteLine of wrapText(c, line, 'Helvetica', 6.8, contentW)) {
          // A long note can run past the page; carry on over the next one
          if (y[0] < 0.35 * 72) newContinuationPage()
          c.setFont('Helvetica', 6.8)
          c.setFillColor(GREY)
          c.drawString(x, y[0], noteLine)
          y[0] -= 8
        }
      }
    }

    footer()
  }

  clients.forEach((order, i) => {
    drawClient(order)
    if (i < clients.length - 1) c.showPage()
  })
  return c.finish()
}

// data: { weekLabel, entrees, salads, addons? } where each dish is
// { name, components, description, packaging, qty, parentsWant }
export function makeChefReference(data) {
  const c = new Canvas(data.weekLabel)
  const margin = 0.28 * 72
  const contentW = PAGE_W - 2 * margin
  const y = [PAGE_H - margin]

  const wrap = (text, font, size, maxWidth) => wrapText(c, text, font, size, maxWidth)
  const newPage = () => { c.showPage(); y[0] = PAGE_H - margin - 6 }
  const ensureSpace = (needed) => { if (y[0] - needed < margin) newPage() }

  c.setFont('Helvetica-Bold', 10)
  c.setFillColor(BLACK)
  c.drawString(margin, y[0] - 10, 'DINNER WITH CHARLES')
  c.setFont('Helvetica', 8)
  c.drawRightString(PAGE_W - margin, y[0] - 10, data.weekLabel)
  y[0] -= 22
  c.setStrokeColor(BLACK)
  c.setLineWidth(1)
  c.line(margin, y[0], PAGE_W - margin, y[0])
  y[0] -= 16

  c.setFont('Helvetica-Oblique', 6.8)
  c.setFillColor(BLACK)
  for (const line of wrap('Big number = client orders this week. ":)" = parents also want it (not in the count).', 'Helvetica-Oblique', 6.8, contentW)) {
    c.drawString(margin, y[0], line)
    y[0] -= 8
  }
  y[0] -= 6

  const sectionHeader = (title, countLabel) => {
    ensureSpace(30)
    c.setFont('Helvetica-Bold', 13)
    c.setFillColor(BLACK)
    c.drawString(margin, y[0], title)
    c.setFont('Helvetica', 8)
    c.drawRightString(PAGE_W - margin, y[0], countLabel)
    y[0] -= 8
    c.setStrokeColor(BLACK)
    c.setLineWidth(1)
    c.line(margin, y[0], PAGE_W - margin, y[0])
    y[0] -= 16
  }

  const dish = (num, { name, components, description, packaging, qty, parentsWant }) => {
    const nameLines = wrap(name, 'Helvetica-Bold', 9.5, contentW - 20)
    const compGroups = components.map(comp => wrap(comp, 'Helvetica-Oblique', 7, contentW - 32))
    const totalCompLines = compGroups.reduce((n, g) => n + g.length, 0)
    const descLines = description ? wrap(description, 'Helvetica', 7.3, contentW - 20) : []
    const packLines = packaging ? wrap(packaging, 'Helvetica-Bold', 6.8, contentW - 32) : []
    const boxH = packLines.length ? 10 + 8.8 * packLines.length + 12 : 0
    ensureSpace(11 * nameLines.length + 8.6 * totalCompLines + 4 + 9.3 * descLines.length + boxH + 18)

    c.setFont('Helvetica-Bold', 9.5)
    c.setFillColor(BLACK)
    c.drawString(margin, y[0], `${num}.`)
    if (qty != null) {
      c.setFont('Helvetica-Bold', 15)
      const numW = c.stringWidth(String(qty), 'Helvetica-Bold', 15)
      c.drawRightString(PAGE_W - margin, y[0] - 1, String(qty))
      if (parentsWant) {
        c.setFont('Helvetica-Bold', 10)
        c.drawRightString(PAGE_W - margin - numW - 4, y[0], ':)')
      }
      c.setFont('Helvetica-Bold', 9.5)
    }
    for (const nameLine of nameLines) {
      c.drawString(margin + 14, y[0], nameLine)
      y[0] -= 11
    }

    if (compGroups.length) {
      c.setFont('Helvetica-Oblique', 7)
      c.setFillColor(BLACK)
      for (const group of compGroups) {
        group.forEach((line, j) => {
          c.drawString(margin + 14, y[0], (j === 0 ? '• ' : '  ') + line)
          y[0] -= 8.6
        })
      }
      y[0] -= 2
    }

    c.setFont('Helvetica', 7.3)
    c.setFillColor(BLACK)
    for (const line of descLines) {
      c.drawString(margin + 14, y[0], line)
      y[0] -= 9.3
    }
    y[0] -= 4

    if (packLines.length) {
      const boxLeft = margin + 14
      const boxW = contentW - 14
      const boxTop = y[0] + 2.5
      const labelH = 9.5
      const boxHActual = labelH + 8.8 * packLines.length + 5
      c.setFillColor(BLACK)
      c.rect(boxLeft, boxTop - labelH, boxW, labelH, { fill: true, stroke: false })
      c.setFillColor(WHITE)
      c.setFont('Helvetica-Bold', 6.2)
      // The "■" in the skill isn't in the standard PDF fonts, so draw the square
      c.rect(boxLeft + 3.5, boxTop - labelH + 2.9, 3.6, 3.6, { fill: true, stroke: false })
      c.drawString(boxLeft + 9.5, boxTop - labelH + 2.4, 'PACKAGING')
      c.setStrokeColor(BLACK)
      c.setLineWidth(0.7)
      c.rect(boxLeft, boxTop - boxHActual, boxW, boxHActual - labelH, { fill: false, stroke: true })
      c.setFillColor(BLACK)
      c.setFont('Helvetica-Bold', 6.8)
      let ty = boxTop - labelH - 8.5
      for (const line of packLines) {
        c.drawString(boxLeft + 3.5, ty, line)
        ty -= 8.8
      }
      y[0] = boxTop - boxHActual - 10
    }
    y[0] -= 4
  }

  const section = (title, noun, items, first, onNewPage = true) => {
    if (!items.length) return
    if (!first && onNewPage) newPage()
    else if (!first) y[0] -= 10
    sectionHeader(title, `${noun}${items.length} ${items.length === 1 ? 'dish' : 'dishes'}`)
    items.forEach((item, i) => dish(i + 1, item))
  }

  section('ENTRÉES', 'Pick 3 · ', data.entrees, true)
  section('SIDES', 'Pick 2 · ', data.salads, !data.entrees.length)
  // Add-ons are few, so they follow the salads instead of taking a page of their own
  section('ADD-ONS', '', data.addons || [], !data.entrees.length && !data.salads.length, !data.salads.length)

  return c.finish()
}

// Shortens a dish name to fit a column: drops the "with ..." part, then clips with an ellipsis
function fitName(c, name, font, size, maxWidth) {
  let text = String(name)
  if (c.stringWidth(text, font, size) <= maxWidth) return text
  text = text.split(/\s+(?:with|&)\s+/i)[0]
  while (text.length > 3 && c.stringWidth(`${text}…`, font, size) > maxWidth) text = text.slice(0, -1).trimEnd()
  return c.stringWidth(text, font, size) <= maxWidth ? text : `${text}…`
}

// gridData: { weekLabel, dishes: [{ section, name }], customers: [{ name, values: [...one per dish], dots }] }
// Cell values: 0 not ordered, 1 ordered, "2" and up doubled. Customers with dots (Andrea and her
// parents) are drawn with dots instead of a solid block, and always go last.
export function makeOrderGrid(gridData) {
  const W = 6 * 72
  const H = 4 * 72
  const c = new Canvas(gridData.weekLabel, [W, H])
  const customers = [...gridData.customers].sort((a, b) => Number(!!a.dots) - Number(!!b.dots))
  const names = customers.map(cust => cust.name)
  const rows = gridData.dishes.map((dish, i) => [dish.section, dish.name, customers.map(cust => cust.values[i] || 0)])
  const total = (values) => values.reduce((n, v) => n + (Number(v) || 0), 0)

  const margin = 12
  const totalColW = 30
  c.setFont('Helvetica-Bold', 7.2)
  const widest = Math.max(0, ...rows.map(([, dish]) => c.stringWidth(dish, 'Helvetica-Bold', 7.2)))
  const nameColW = Math.min(120, Math.max(78, widest + 10))
  const nCols = names.length
  const gridW = W - 2 * margin - nameColW - totalColW
  const colW = nCols ? gridW / nCols : gridW

  let y = H - margin
  c.setFont('Helvetica-Bold', 10.5); c.setFillColor(BLACK)
  c.drawString(margin, y - 10, 'DINNER WITH CHARLES')
  c.setFont('Helvetica', 7); c.setFillColor('#666666')
  c.drawRightString(W - margin, y - 10, gridData.weekLabel)
  y -= 16
  c.setStrokeColor(BLACK); c.setLineWidth(1)
  c.line(margin, y, W - margin, y)
  y -= 10
  c.setFont('Helvetica-Bold', 11.5); c.setFillColor(BLACK)
  c.drawString(margin, y - 9, gridData.weekLabel)
  y -= 15
  const headerRowH = 38
  const headerBaseY = y - headerRowH
  let x = margin + nameColW
  c.setFont('Helvetica-Bold', 7)
  for (const name of names) {
    c.drawRotated(x + colW / 2, headerBaseY + 4, 55, name)
    x += colW
  }
  c.setFont('Helvetica-Bold', 6.5); c.setFillColor(BLACK)
  c.drawCentredString(x + totalColW / 2, headerBaseY + 6, 'TOT')

  const sectionH = 11
  const sectionCount = new Set(rows.map(([section]) => section)).size
  // Shrink the rows a little if the week has many dishes, so the table stays on the page
  const room = headerBaseY - margin - 10 - sectionCount * sectionH
  const dishRowH = Math.max(8, Math.min(13.5, room / Math.max(rows.length, 1)))
  const tableBottom = headerBaseY - (sectionCount * sectionH + rows.length * dishRowH)

  c.setLineWidth(0.6); c.setStrokeColor(BLACK)
  c.line(margin, headerBaseY, W - margin, headerBaseY)
  let vx = margin + nameColW
  c.setLineWidth(0.8); c.line(vx, headerBaseY, vx, tableBottom)
  c.setStrokeColor('#bbbbbb'); c.setLineWidth(0.4)
  for (let i = 1; i < nCols; i++) {
    vx = margin + nameColW + i * colW
    c.line(vx, headerBaseY, vx, tableBottom)
  }
  c.setStrokeColor(BLACK); c.setLineWidth(0.8)
  c.line(margin + nameColW + nCols * colW, headerBaseY, margin + nameColW + nCols * colW, tableBottom)
  c.line(margin, headerBaseY, margin, tableBottom)
  c.line(W - margin, headerBaseY, W - margin, tableBottom)

  y = headerBaseY
  let lastSection = null
  for (const [section, dish, values] of rows) {
    if (section !== lastSection) {
      c.setFillColor(BLACK)
      c.rect(margin, y - sectionH, W - 2 * margin, sectionH, { fill: true, stroke: false })
      c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 7.5)
      c.drawString(margin + 4, y - sectionH + 3, section)
      y -= sectionH
      c.setStrokeColor('#bbbbbb'); c.setLineWidth(0.4)
      c.line(margin, y, W - margin, y)
      lastSection = section
    }
    const rowMid = y - dishRowH / 2
    c.setFillColor(BLACK); c.setFont('Helvetica-Bold', 7.2)
    c.drawString(margin + 4, rowMid - 2.5, fitName(c, dish, 'Helvetica-Bold', 7.2, nameColW - 8))
    let xx = margin + nameColW
    const pad = 2.5
    values.forEach((val, ci) => {
      const cellW = colW - 2 * pad
      const cellH = dishRowH - 2 * pad
      if (Number(val) >= 1 && customers[ci].dots) {
        c.setFillColor(BLACK)
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) c.circle(xx + pad + (k + 0.5) * (cellW / 3), y - dishRowH + pad + (r + 0.5) * (cellH / 2), Math.min(1.5, cellH / 5), { fill: true })
      } else if (Number(val) === 1) {
        c.setFillColor(BLACK)
        c.rect(xx + pad, y - dishRowH + pad, cellW, cellH, { fill: true, stroke: false })
      } else if (Number(val) > 1) {
        c.setFillColor(BLACK); c.setFont('Helvetica-Bold', 7.5)
        c.drawCentredString(xx + colW / 2, rowMid - 2.5, String(val))
        c.setFont('Helvetica-Bold', 7.2)
      }
      xx += colW
    })
    c.setFillColor(BLACK); c.setFont('Helvetica-Bold', 8)
    c.drawCentredString(xx + totalColW / 2, rowMid - 2.5, String(total(values)))
    y -= dishRowH
    c.setStrokeColor('#bbbbbb'); c.setLineWidth(0.4)
    c.line(margin, y, W - margin, y)
  }
  c.setStrokeColor(BLACK); c.setLineWidth(0.9)
  c.line(margin, tableBottom, W - margin, tableBottom)
  c.setFont('Helvetica', 5.8); c.setFillColor('#666666')
  c.drawCentredString(W / 2, margin - 7, 'Solid box = ordered  ·  Dots = Andrea & parents  ·  2 = doubled up  ·  TOT = total  ·  @dinnerwithcharles')
  return c.finish()
}
