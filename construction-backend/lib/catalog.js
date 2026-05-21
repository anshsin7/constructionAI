import readXlsxFile, { readSheet } from 'read-excel-file/node'
import { PDFParse } from 'pdf-parse'
import { CATEGORIES, normalizeCategory } from './categories.js'
import { buildSearchText } from './productSearch.js'

const MAX_PDF_PAGES = 15
const MAX_TEXT_CHARS = 120000
const MIN_PDF_TEXT_CHARS = 400
const PDF_VISION_PAGES_PER_REQUEST = 4

let usdChfCache = { rate: 0.88, at: 0 }
let eurChfCache = { rate: 0.95, at: 0 }

/** Parse amounts from CHF/EUR/USD strings, Swiss/German number formats, or Excel numbers. */
export function parseMoneyValue(value, currencyHint) {
  if (value == null || value === '') return { amount: NaN, currency: currencyHint ?? 'CHF' }

  if (typeof value === 'number') {
    return { amount: value, currency: (currencyHint ?? 'CHF').toUpperCase() }
  }

  let raw = String(value).trim()
  let currency = (currencyHint ?? 'CHF').toUpperCase()

  if (/€|eur\b/i.test(raw)) currency = 'EUR'
  else if (/\$|usd\b/i.test(raw)) currency = 'USD'
  else if (/chf|sfr|fr\.?\s*/i.test(raw)) currency = 'CHF'

  raw = raw
    .replace(/€|EUR|CHF|USD|SFr|Fr\.?|\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/[''\u2019]/g, '')

  // German/European decimal comma: 0,08 or 1.234,56
  if (/,\d{1,4}$/.test(raw)) {
    if (/^\d{1,3}(\.\d{3})*,\d+$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.')
    } else {
      raw = raw.replace(',', '.')
    }
  }

  const amount = parseFloat(raw)
  return { amount: Number.isFinite(amount) ? amount : NaN, currency }
}

/** @deprecated use parseMoneyValue */
export function parseSwissPrice(value) {
  return parseMoneyValue(value, 'CHF').amount
}

function mapUnit(raw) {
  const u = String(raw ?? 'piece').toLowerCase().trim()
  if (['st', 'stk', 'stück', 'stuck', 'stck', 'piece', 'pcs', 'pc', 'ea', 'paar'].includes(u))
    return 'piece'
  if (['rol', 'roll', 'rolle'].includes(u)) return 'roll'
  if (['box', 'kart', 'carton', 'dose', 'kanister'].includes(u)) return 'box'
  if (['kg', 'kilogram'].includes(u)) return 'kg'
  if (['m', 'meter', 'lm', 'lfm'].includes(u)) return 'm'
  if (['bag', 'sack'].includes(u)) return 'bag'
  return u.length <= 12 ? u : 'piece'
}

function mapGermanCategory(raw) {
  const c = String(raw ?? '').toLowerCase()
  if (/befestigung|schraub|dübel|anker/.test(c)) return 'Fasteners'
  if (/psa|schutz|handschuh|helm|brille/.test(c)) return 'PPE'
  if (/elektro|kabel/.test(c)) return 'Electrical'
  if (/werkzeug|bohr|hammer/.test(c)) return 'Hand Tools'
  if (/farbe|lack|spray/.test(c)) return 'Other'
  if (/kunststoff|rohr|muffe/.test(c)) return 'Plumbing'
  return normalizeCategory(raw)
}

const COLUMN_ALIASES = {
  name: ['artikelname', 'bezeichnung', 'produkt', 'product name', 'name', 'description'],
  sku: ['artikel id', 'artikelid', 'artikelnr', 'art.-nr', 'sku', 'artikel'],
  price: ['preis eur', 'preis chf', 'preis', 'price', 'einzelpreis', 'uvp', 'vk preis'],
  unit: ['einheit', 'unit', 'me', 'menge/me'],
  category: ['kategorie', 'category', 'rabattgruppe'],
  supplier: ['lieferant', 'supplier', 'vendor']
}

function columnMapFromHeaders(headerRow) {
  const map = {}
  const cells = Array.isArray(headerRow) ? headerRow : []
  cells.forEach((cell, index) => {
    const key = String(cell ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
    if (!key) return
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[field] != null) continue
      if (aliases.some((a) => key === a || key.includes(a))) map[field] = index
    }
  })
  return map
}

function priceCurrencyFromHeader(headerRow, priceCol) {
  if (priceCol == null) return 'CHF'
  const label = String((Array.isArray(headerRow) ? headerRow : [])[priceCol] ?? '').toLowerCase()
  if (/eur|€/.test(label)) return 'EUR'
  if (/usd|\$/.test(label)) return 'USD'
  return 'CHF'
}

function productExtractionPrompt(defaultSupplier) {
  return `You extract construction products from procurement documents (contracts, price lists, quotes, Excel catalogs).
Documents may be in German (Switzerland/Germany/EU). Common column headers:
- Swiss PDF quotes: Pos, Artikel, Bezeichnung, Menge/ME, Preis CHF, Betrag CHF
- Excel catalogs: Artikel Id, Artikelname, Kategorie, Einheit, Preis Eur, Lieferant

Return ONLY valid JSON:
{
  "products": [
    {
      "name": "English product name (translate from German)",
      "category": "one of: ${CATEGORIES.join(' | ')}",
      "unit": "piece|box|kg|m|roll|bag",
      "unit_price": number,
      "currency": "CHF | EUR | USD — match the source column (Preis Eur → EUR)",
      "sku": "Artikel Id / Artikel code or null",
      "supplier_name": "Lieferant or null",
      "keywords": ["english", "search", "terms"],
      "aliases": ["english alternate names", "original German name"],
      "size_spec": "e.g. Ø80mm, TX20 4x40 or null",
      "confidence": "high|medium|low"
    }
  ],
  "skipped_notes": ["reasons rows were omitted"]
}

Price rules (critical):
- unit_price must be a plain NUMBER only (e.g. 0.08 not "0,08 €"). Parse 0,08 € → 0.08, 1'720.00 → 1720
- Use unit price column (Preis Eur / Preis CHF), NOT line totals
- Set currency EUR when column is Preis Eur or values have €
- Set currency CHF for Preis CHF / CHF columns

Other rules:
- Einheit: Stk/Stück/Paar → piece, Rolle → roll, Dose → box, m → m
- Kategorie mapping: Befestigung→Fasteners, PSA→PPE, Elektro→Electrical, Werkzeug→Hand Tools
- Skip header rows and empty rows
- Include only rows with a positive unit_price
- supplier_name from Lieferant column or default: ${defaultSupplier ?? 'unknown'}`
}

function parseAiProductsResponse(raw) {
  const trimmed = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed)
  return {
    products: parsed.products ?? [],
    skipped_notes: parsed.skipped_notes ?? []
  }
}

async function fetchFxRate(from, cache) {
  if (Date.now() - cache.at < 3600000) return cache.rate
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=CHF`)
    const data = await res.json()
    const rate = data?.rates?.CHF
    if (rate) {
      cache.rate = rate
      cache.at = Date.now()
      return rate
    }
  } catch {
    /* fallback */
  }
  return cache.rate
}

export async function getUsdToChf() {
  return fetchFxRate('USD', usdChfCache)
}

export async function getEurToChf() {
  return fetchFxRate('EUR', eurChfCache)
}

/**
 * Direct parse of structured Excel (e.g. Artikelname + Preis Eur columns).
 */
export async function extractProductsFromSpreadsheet(buffer, { defaultSupplier }) {
  const table = await xlsxBufferToTableJson(buffer)
  if (!table?.rows?.length) return null
  const rows = [
    table.headers,
    ...table.rows.map((r) => table.headers.map((h) => r[h]))
  ]
  if (rows.length < 2) return null

  let headerRowIndex = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = (Array.isArray(rows[i]) ? rows[i] : [])
      .map((c) => String(c ?? '').toLowerCase())
      .join(' ')
    if (
      (line.includes('artikel') || line.includes('preis') || line.includes('name')) &&
      (line.includes('preis') || line.includes('price'))
    ) {
      headerRowIndex = i
      break
    }
  }
  if (headerRowIndex < 0) return null

  const headers = rows[headerRowIndex]
  const col = columnMapFromHeaders(headers)
  if (col.name == null || col.price == null) return null

  const priceCurrency = priceCurrencyFromHeader(headers, col.price)
  const products = []
  const skipped = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : []
    const name = String(row[col.name] ?? '').trim()
    if (!name || /^summe|total|gesamt/i.test(name)) continue

    const { amount, currency } = parseMoneyValue(row[col.price], priceCurrency)
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped.push(`No price for: ${name}`)
      continue
    }

    const germanName = name
    products.push({
      name: germanName,
      category: mapGermanCategory(col.category != null ? row[col.category] : ''),
      unit: mapUnit(col.unit != null ? row[col.unit] : 'piece'),
      unit_price: amount,
      currency,
      sku: col.sku != null ? String(row[col.sku] ?? '').trim() || null : null,
      supplier_name:
        col.supplier != null ? String(row[col.supplier] ?? '').trim() || null : defaultSupplier,
      keywords: [germanName.toLowerCase()],
      aliases: [germanName],
      size_spec: null,
      confidence: 'high'
    })
  }

  if (!products.length) return null
  return { products, skipped_notes: skipped, extraction_method: 'spreadsheet' }
}

function cellToString(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function normalizeXlsxRows(result) {
  if (!result?.length) return []
  // read-excel-file v9 readSheet: Row[]; readXlsxFile: { sheet, data }[]
  if (Array.isArray(result[0])) return result
  if (result[0]?.data && Array.isArray(result[0].data)) return result[0].data
  return []
}

/** Read every worksheet — not just the first (fixes data on sheet 2 e.g. Artikelstammdaten). */
async function readAllXlsxSheets(buffer) {
  const workbook = await readXlsxFile(buffer)
  if (!Array.isArray(workbook) || !workbook.length) {
    const fallback = normalizeXlsxRows(await readSheet(buffer))
    return [{ sheet: 'Sheet1', rows: fallback }]
  }
  return workbook.map((entry, index) => ({
    sheet: entry.sheet ?? entry.name ?? `Sheet${index + 1}`,
    rows: Array.isArray(entry.data) ? entry.data : normalizeXlsxRows(entry.data ?? entry)
  }))
}

function scoreSheetForCatalog(rows) {
  if (!rows?.length) return 0
  const headerIdx = findSpreadsheetHeaderIndex(rows)
  const headers = Array.isArray(rows[headerIdx]) ? rows[headerIdx] : []
  const col = columnMapFromHeaders(headers)
  let score = 0
  if (col.name != null) score += 4
  if (col.price != null) score += 6
  if (col.sku != null) score += 2
  if (col.supplier != null) score += 1
  const dataRowCount = Math.max(0, rows.length - headerIdx - 1)
  score += Math.min(15, dataRowCount)
  const headerLine = headers.map((c) => String(c ?? '').toLowerCase()).join(' ')
  if (headerLine.includes('artikelname')) score += 3
  if (headerLine.includes('preis eur') || headerLine.includes('preis chf')) score += 3
  return score
}

function rowsToTable(rows, sheetName, allSheetNames) {
  if (!rows?.length) return null
  const headerIdx = findSpreadsheetHeaderIndex(rows)
  const headerCells = Array.isArray(rows[headerIdx]) ? rows[headerIdx] : []
  const headers = headerCells.map((c, i) => {
    const label = cellToString(c).trim()
    return label || `column_${i + 1}`
  })

  const dataRows = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = Array.isArray(rows[i]) ? rows[i] : []
    const obj = {}
    let hasContent = false
    headers.forEach((h, col) => {
      const val = cellToJsonValue(cells[col])
      if (val !== '') hasContent = true
      obj[h] = val
    })
    if (hasContent) dataRows.push(obj)
  }

  if (!dataRows.length) return null

  return {
    sheet_name: sheetName,
    all_sheet_names: allSheetNames,
    headers,
    rows: dataRows,
    row_count: dataRows.length
  }
}

function findSpreadsheetHeaderIndex(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const line = (Array.isArray(rows[i]) ? rows[i] : [])
      .map((c) => String(c ?? '').toLowerCase())
      .join(' ')
    if (
      line.includes('preis') ||
      line.includes('price') ||
      (line.includes('artikel') && line.includes('name'))
    ) {
      return i
    }
  }
  return 0
}

function cellToJsonValue(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  return cellToString(value)
}

/** Build JSON table for AI — picks the sheet that looks like a product catalog. */
export async function xlsxBufferToTableJson(buffer) {
  const sheets = await readAllXlsxSheets(buffer)
  const allNames = sheets.map((s) => s.sheet)

  let bestTable = null
  let bestScore = 0

  for (const { sheet, rows } of sheets) {
    const score = scoreSheetForCatalog(rows)
    const table = rowsToTable(rows, sheet, allNames)
    if (table && score > bestScore) {
      bestScore = score
      bestTable = table
    }
  }

  // Fallback: first sheet with any rows
  if (!bestTable) {
    for (const { sheet, rows } of sheets) {
      const table = rowsToTable(rows, sheet, allNames)
      if (table) return table
    }
    return null
  }

  return bestTable
}

async function xlsxBufferToCsv(buffer) {
  const table = await xlsxBufferToTableJson(buffer)
  if (!table?.rows?.length) return ''
  const headerLine = table.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')
  const lines = table.rows.map((row) =>
    table.headers
      .map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`)
      .join(',')
  )
  return [headerLine, ...lines].join('\n')
}

export function detectFileType(filename, mimetype) {
  const lower = (filename ?? '').toLowerCase()
  if (lower.endsWith('.pdf') || mimetype === 'application/pdf') return 'pdf'
  if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
    throw new Error('Legacy .xls files are not supported. Save as .xlsx or CSV.')
  }
  if (lower.endsWith('.xlsx') || mimetype?.includes('spreadsheet')) return 'xlsx'
  return 'csv'
}

async function assertPdfPageCount(parser) {
  const info = await parser.getInfo()
  const pageCount = info.total ?? info.pages?.length ?? 0
  if (pageCount > MAX_PDF_PAGES) {
    throw new Error(`PDF has ${pageCount} pages. Maximum is ${MAX_PDF_PAGES}.`)
  }
  return pageCount
}

async function pdfBufferToText(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    await assertPdfPageCount(parser)
    const result = await parser.getText({
      lineEnforce: true,
      cellSeparator: '\t'
    })
    return result.text ?? ''
  } finally {
    await parser.destroy()
  }
}

/** Render PDF pages to PNG data URLs for GPT-4o vision (scanned PDFs). */
async function pdfBufferToPageImages(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const pageCount = await assertPdfPageCount(parser)
    const shots = await parser.getScreenshot({
      desiredWidth: 1400,
      imageDataUrl: true,
      imageBuffer: false
    })
    const pages = (shots.pages ?? [])
      .filter((p) => p.dataUrl)
      .sort((a, b) => a.pageNumber - b.pageNumber)
    if (!pages.length && pageCount > 0) {
      throw new Error('Could not render PDF pages for vision analysis')
    }
    return pages
  } finally {
    await parser.destroy()
  }
}

export async function bufferToDocumentText(buffer, fileType) {
  if (fileType === 'pdf') {
    return (await pdfBufferToText(buffer)).slice(0, MAX_TEXT_CHARS)
  }

  if (fileType === 'xlsx') {
    return (await xlsxBufferToCsv(buffer)).slice(0, MAX_TEXT_CHARS)
  }

  return buffer.toString('utf8').slice(0, MAX_TEXT_CHARS)
}

async function callProductExtractionAi(openai, userContent, defaultSupplier, { maxTokens = 16000 } = {}) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: productExtractionPrompt(defaultSupplier) },
      { role: 'user', content: userContent }
    ],
    max_tokens: maxTokens,
    temperature: 0.1
  })
  return parseAiProductsResponse(completion.choices[0].message.content)
}

export async function extractProductsWithAi(openai, documentText, { sourceType, defaultSupplier }) {
  const result = await callProductExtractionAi(
    openai,
    `Source type: ${sourceType}\n\nDocument:\n${documentText}`,
    defaultSupplier
  )
  return { ...result, extraction_method: 'ai' }
}

/** XLSX/CSV: always use AI on structured JSON (keeps numeric Preis Eur from Excel). */
export async function extractProductsFromSpreadsheetWithAi(
  openai,
  buffer,
  fileType,
  { sourceType, defaultSupplier }
) {
  let payload
  if (fileType === 'xlsx') {
    const table = await xlsxBufferToTableJson(buffer)
    if (!table?.rows?.length) {
      throw new Error('Excel file has no data rows after the header')
    }
    payload = JSON.stringify(table)
  } else {
    const text = buffer.toString('utf8').slice(0, MAX_TEXT_CHARS)
    if (!text.trim()) throw new Error('Could not read CSV file')
    payload = text
  }

  const userPrompt = `Source type: ${sourceType}
Format: ${fileType === 'xlsx' ? 'Excel spreadsheet as JSON (headers + rows). Prices may be numbers in "Preis Eur" column.' : 'CSV text'}

IMPORTANT:
- Data may be from sheet 2+ (e.g. "Artikelstammdaten") — use sheet_name in the JSON.
- Extract EVERY product row that has a price in Preis Eur / Preis CHF / Preis / price column.
- If "Preis Eur" column exists, set currency to EUR for those rows.
- unit_price must be a number (use the Excel number, e.g. 0.08 not 0).
- Do not skip rows because of extra columns (Gefahrgut, Lagerort, etc.).
- Excel tables are already flattened into rows in JSON.

Data:
${payload.slice(0, MAX_TEXT_CHARS)}`

  let result = await callProductExtractionAi(openai, userPrompt, defaultSupplier)

  if (!(result.products?.length > 0)) {
    result = await callProductExtractionAi(
      openai,
      `${userPrompt}\n\nRETRY: You returned zero products. The file is a German product catalog. Each row with Artikelname and Preis Eur is one product. Return at least all rows with a numeric price.`,
      defaultSupplier
    )
  }

  return { ...result, extraction_method: 'ai' }
}

async function extractProductsFromPdfVision(openai, pageImages, { sourceType, defaultSupplier, extraText }) {
  const allProducts = []
  const allSkipped = []
  const system = productExtractionPrompt(defaultSupplier)

  for (let i = 0; i < pageImages.length; i += PDF_VISION_PAGES_PER_REQUEST) {
    const chunk = pageImages.slice(i, i + PDF_VISION_PAGES_PER_REQUEST)
    const pageNums = chunk.map((p) => p.pageNumber).join(', ')

    const userContent = [
      {
        type: 'text',
        text: `Source type: ${sourceType}. Read these PDF page image(s) (page ${pageNums}). Extract all product rows from the table.${
          extraText
            ? `\n\nSupplementary text layer from PDF (may be incomplete):\n${extraText.slice(0, 8000)}`
            : ''
        }`
      },
      ...chunk.map((p) => ({
        type: 'image_url',
        image_url: { url: p.dataUrl, detail: 'high' }
      }))
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ],
      max_tokens: 8000,
      temperature: 0.1
    })

    const { products, skipped_notes } = parseAiProductsResponse(
      completion.choices[0].message.content
    )
    allProducts.push(...products)
    allSkipped.push(...(skipped_notes ?? []))
  }

  return { products: allProducts, skipped_notes: allSkipped, extraction_method: 'vision' }
}

/**
 * PDF: text layer first; if too little text or zero products → GPT-4o vision on page images.
 */
export async function extractProductsFromPdf(openai, buffer, { sourceType, defaultSupplier }) {
  let text = ''
  try {
    text = await pdfBufferToText(buffer)
  } catch (err) {
    console.warn('[catalog] PDF text extraction failed:', err.message)
  }

  const textOk = text.trim().length >= MIN_PDF_TEXT_CHARS

  if (textOk) {
    const textResult = await extractProductsWithAi(openai, text, {
      sourceType,
      defaultSupplier
    })
    if ((textResult.products?.length ?? 0) > 0) {
      return { ...textResult, extraction_method: 'text' }
    }
  }

  const pageImages = await pdfBufferToPageImages(buffer)
  return extractProductsFromPdfVision(openai, pageImages, {
    sourceType,
    defaultSupplier,
    extraText: textOk ? text : ''
  })
}

export async function normalizePrices(products) {
  const [usdRate, eurRate] = await Promise.all([getUsdToChf(), getEurToChf()])
  return products
    .map((p) => {
      const { amount, currency } = parseMoneyValue(p.unit_price, p.currency)
      if (!Number.isFinite(amount) || amount <= 0) return null

      let priceChf = amount
      const cur = currency.toUpperCase()
      if (cur === 'EUR') priceChf = Math.round(amount * eurRate * 100) / 100
      else if (cur === 'USD') priceChf = Math.round(amount * usdRate * 100) / 100
      else priceChf = Math.round(amount * 100) / 100

      return {
        ...p,
        unit: mapUnit(p.unit),
        unit_price: priceChf,
        currency: 'CHF'
      }
    })
    .filter(Boolean)
}

export async function resolveSupplier(supabase, name) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) {
    const { data } = await supabase.from('suppliers').select('id').limit(1).single()
    return data?.id ?? null
  }

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({ name: trimmed })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

export async function aiMatchProducts(openai, existingProducts, newRows) {
  const slimExisting = existingProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    supplier_id: p.supplier_id,
    unit_price: p.unit_price
  }))

  const slimNew = newRows.map((r) => ({
    row_id: r.id,
    name: r.name,
    sku: r.sku,
    supplier_name: r.supplier_name,
    unit_price: r.unit_price
  }))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Decide for each NEW product row whether it matches an EXISTING product (same item) or is new.
Return ONLY JSON: { "decisions": [ { "row_id": "uuid", "action": "create"|"update"|"skip", "match_product_id": "uuid|null" } ] }
- update: same physical product, refresh price/metadata
- create: genuinely new SKU/name
- skip: duplicate junk or unparseable
Use judgment on name + sku + supplier — screws with different sizes are different products.`
      },
      {
        role: 'user',
        content: JSON.stringify({ existing: slimExisting, new_rows: slimNew })
      }
    ],
    max_tokens: 4000,
    temperature: 0.1
  })

  const raw = completion.choices[0].message.content.trim()
  const trimmed = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(trimmed)
  return parsed.decisions ?? []
}

export async function upsertProduct(supabase, row, supplierId, matchProductId, action) {
  const keywords = Array.isArray(row.keywords) ? row.keywords : []
  const aliases = Array.isArray(row.aliases) ? row.aliases : []
  const category = normalizeCategory(row.category)
  const search_text = buildSearchText({
    name: row.name,
    description: row.description,
    category,
    keywords,
    aliases,
    size_spec: row.size_spec
  })

  const payload = {
    name: row.name,
    category,
    unit: mapUnit(row.unit),
    unit_price: Number(row.unit_price),
    supplier_id: supplierId,
    sku: row.sku || null,
    size_spec: row.size_spec || null,
    keywords,
    search_text,
    is_active: true,
    description: row.description ?? null
  }

  let productId = matchProductId

  if (action === 'update' && matchProductId) {
    const { error } = await supabase.from('products').update(payload).eq('id', matchProductId)
    if (error) throw error
    productId = matchProductId
  } else if (action === 'create') {
    const { data, error } = await supabase.from('products').insert(payload).select('id').single()
    if (error) throw error
    productId = data.id
  } else {
    return null
  }

  await supabase.from('product_aliases').delete().eq('product_id', productId)
  if (aliases.length) {
    await supabase.from('product_aliases').insert(
      aliases.map((alias) => ({
        product_id: productId,
        alias: String(alias).trim(),
        source: 'import'
      }))
    )
  }

  return productId
}

export async function deactivateMissingForSupplier(supabase, supplierId, activeProductIds) {
  const { data: all } = await supabase
    .from('products')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)

  const keep = new Set(activeProductIds)
  const toDeactivate = (all ?? []).map((p) => p.id).filter((id) => !keep.has(id))

  if (toDeactivate.length) {
    await supabase.from('products').update({ is_active: false }).in('id', toDeactivate)
  }

  return toDeactivate.length
}
