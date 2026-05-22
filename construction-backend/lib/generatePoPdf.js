import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function generatePoPdf(details) {
  const {
    poNumber,
    orderDate,
    siteName,
    siteAddress,
    requestorName,
    productName,
    quantity,
    unit,
    unitPrice,
    totalPrice,
    supplierName
  } = details

  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.4, 0.4, 0.4)

  let y = 800
  const draw = (text, size = 11, useBold = false, color = black) => {
    page.drawText(text, { x: 50, y, size, font: useBold ? bold : font, color })
    y -= size + 10
  }

  draw('PURCHASE ORDER', 22, true)
  draw(`PO #${poNumber}`, 14, true)
  draw(`Date: ${orderDate}`)
  y -= 8
  draw('Deliver to', 12, true)
  draw(siteName, 12, true)
  const addressLines = (siteAddress || '—')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of addressLines.length ? addressLines : ['—']) {
    draw(line, 11)
  }
  y -= 8
  draw('Supplier', 12, true)
  draw(supplierName)
  y -= 8
  draw('Requested by', 12, true)
  draw(requestorName)
  y -= 16

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: muted })
  y -= 20
  draw('Description', 10, true)
  page.drawText('Qty', { x: 360, y: y + 21, size: 10, font: bold, color: black })
  page.drawText('Unit', { x: 410, y: y + 21, size: 10, font: bold, color: black })
  page.drawText('Total', { x: 480, y: y + 21, size: 10, font: bold, color: black })
  y -= 4
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: muted })
  y -= 18

  page.drawText(productName, { x: 50, y, size: 11, font })
  page.drawText(String(quantity), { x: 360, y, size: 11, font })
  page.drawText(`CHF ${unitPrice}`, { x: 410, y, size: 11, font })
  page.drawText(`CHF ${totalPrice}`, { x: 480, y, size: 11, font: bold })
  y -= 30

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: muted })
  y -= 24
  draw(`Total: CHF ${totalPrice}`, 14, true)
  y -= 30
  draw('Authorized signature: _XXX_______', 10)
  draw('C-Flow — auto-generated PO', 9, false, muted)

  return Buffer.from(await doc.save())
}

/** Combined PO for multiple queued orders to the same supplier. */
export async function generateBatchPoPdf(details) {
  const {
    poNumber,
    orderDate,
    siteName,
    siteAddress,
    supplierName,
    requestorSummary,
    lineItems,
    totalPrice
  } = details

  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.4, 0.4, 0.4)

  let y = 800
  const draw = (text, size = 11, useBold = false, color = black) => {
    page.drawText(text, { x: 50, y, size, font: useBold ? bold : font, color })
    y -= size + 10
  }

  draw('PURCHASE ORDER (BATCH)', 20, true)
  draw(`PO #${poNumber}`, 14, true)
  draw(`Date: ${orderDate}`)
  y -= 8
  draw('Deliver to', 12, true)
  draw(siteName, 12, true)
  const addressLines = (siteAddress || '—')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of addressLines.length ? addressLines : ['—']) {
    draw(line, 11)
  }
  y -= 8
  draw('Supplier', 12, true)
  draw(supplierName)
  y -= 8
  draw('Requested by', 12, true)
  draw(requestorSummary)
  y -= 12

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: muted })
  y -= 18
  draw('Description', 10, true)
  page.drawText('Qty', { x: 360, y: y + 21, size: 10, font: bold, color: black })
  page.drawText('Unit', { x: 410, y: y + 21, size: 10, font: bold, color: black })
  page.drawText('Total', { x: 480, y: y + 21, size: 10, font: bold, color: black })
  y -= 4
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: muted })
  y -= 16

  for (const line of lineItems) {
    if (y < 120) break
    const label =
      line.productName.length > 42 ? `${line.productName.slice(0, 39)}…` : line.productName
    page.drawText(label, { x: 50, y, size: 10, font })
    page.drawText(String(line.quantity), { x: 360, y, size: 10, font })
    page.drawText(`CHF ${line.unitPrice}`, { x: 410, y, size: 10, font })
    page.drawText(`CHF ${line.lineTotal}`, { x: 480, y, size: 10, font })
    y -= 18
  }

  y -= 8
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: muted })
  y -= 22
  draw(`Total: CHF ${totalPrice}`, 14, true)
  y -= 30
  draw('Authorized signature: _XXX_______', 10)
  draw('C-Flow — auto-generated batch PO', 9, false, muted)

  return Buffer.from(await doc.save())
}
