import { Router } from 'express'
import multer from 'multer'
import {
  aiMatchProducts,
  deactivateMissingForSupplier,
  detectFileType,
  extractProductsFromPdf,
  extractProductsFromSpreadsheetWithAi,
  normalizePrices,
  resolveSupplier,
  upsertProduct
} from '../lib/catalog.js'
import { normalizeCategory } from '../lib/categories.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
})

export function createCatalogRouter(supabase, openai) {
  const router = Router()

  router.get('/suppliers', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('suppliers').select('id, name').order('name')
      if (error) throw error
      res.json({ suppliers: data ?? [] })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'file is required' })

      const sourceType = req.body.source_type || 'price_list'
      const supplierName = req.body.supplier_name?.trim() || null
      const uploadedBy = req.body.uploaded_by || null

      if (!['contract', 'price_list', 'quote'].includes(sourceType)) {
        return res.status(400).json({ error: 'Invalid source_type' })
      }

      const fileType = detectFileType(req.file.originalname, req.file.mimetype)

      let rawProducts = []
      let skipped_notes = []
      let extraction_method = 'text'

      if (fileType === 'pdf') {
        const pdfResult = await extractProductsFromPdf(openai, req.file.buffer, {
          sourceType,
          defaultSupplier: supplierName
        })
        rawProducts = pdfResult.products ?? []
        skipped_notes = pdfResult.skipped_notes ?? []
        extraction_method = pdfResult.extraction_method ?? 'vision'
      } else {
        const fileResult = await extractProductsFromSpreadsheetWithAi(
          openai,
          req.file.buffer,
          fileType,
          { sourceType, defaultSupplier: supplierName }
        )
        rawProducts = fileResult.products ?? []
        skipped_notes = fileResult.skipped_notes ?? []
        extraction_method = fileResult.extraction_method ?? 'ai'
      }

      const withPrices = await normalizePrices(rawProducts)
      const skipped = rawProducts.length - withPrices.length

      const { data: uploadRow, error: upErr } = await supabase
        .from('catalog_uploads')
        .insert({
          file_name: req.file.originalname,
          file_type: fileType,
          source_type: sourceType,
          supplier_name: supplierName,
          uploaded_by: uploadedBy,
          status: 'preview',
          row_count: withPrices.length,
          skipped_no_price: skipped
        })
        .select('*')
        .single()

      if (upErr) throw upErr

      const rows = withPrices.map((p, i) => ({
        upload_id: uploadRow.id,
        row_index: i,
        name: p.name,
        category: normalizeCategory(p.category),
        unit: p.unit || 'piece',
        unit_price: p.unit_price,
        sku: p.sku ?? null,
        supplier_name: p.supplier_name || supplierName,
        keywords: p.keywords ?? [],
        aliases: p.aliases ?? [],
        size_spec: p.size_spec ?? null,
        confidence: p.confidence ?? 'medium',
        action: 'create'
      }))

      if (rows.length) {
        const { error: rowErr } = await supabase.from('catalog_upload_rows').insert(rows)
        if (rowErr) throw rowErr
      }

      const { data: preview } = await supabase
        .from('catalog_upload_rows')
        .select('id, name, category, unit, unit_price, sku, supplier_name, size_spec, action, confidence')
        .eq('upload_id', uploadRow.id)
        .order('row_index')

      if (!rows.length) {
        return res.status(422).json({
          error:
            'No products with prices were found. Check that the file has product rows with a price column (e.g. Preis Eur, Preis CHF).',
          skipped_no_price: skipped,
          skipped_notes,
          extraction_method
        })
      }

      res.status(201).json({
        upload_id: uploadRow.id,
        preview: preview ?? [],
        row_count: rows.length,
        skipped_no_price: skipped,
        skipped_notes,
        extraction_method
      })
    } catch (err) {
      console.error('[catalog upload]', err)
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/upload/:id/preview', async (req, res) => {
    try {
      const { data: upload, error: uErr } = await supabase
        .from('catalog_uploads')
        .select('*')
        .eq('id', req.params.id)
        .single()

      if (uErr) throw uErr

      const { data: rows, error } = await supabase
        .from('catalog_upload_rows')
        .select('id, name, category, unit, unit_price, sku, supplier_name, size_spec, action, confidence')
        .eq('upload_id', req.params.id)
        .order('row_index')

      if (error) throw error

      res.json({ upload, preview: rows ?? [] })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.patch('/upload/:id/rows/:rowId', async (req, res) => {
    const allowed = ['name', 'category', 'unit', 'unit_price', 'sku', 'supplier_name', 'action']
    const patch = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k]
    }
    if (patch.category) patch.category = normalizeCategory(patch.category)

    try {
      const { data, error } = await supabase
        .from('catalog_upload_rows')
        .update(patch)
        .eq('id', req.params.rowId)
        .eq('upload_id', req.params.id)
        .select('*')
        .single()

      if (error) throw error
      res.json({ row: data })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/upload/:id/commit', async (req, res) => {
    try {
      const { data: upload, error: uErr } = await supabase
        .from('catalog_uploads')
        .select('*')
        .eq('id', req.params.id)
        .single()

      if (uErr) throw uErr
      if (upload.status === 'committed') {
        return res.status(400).json({ error: 'Upload already committed' })
      }

      const { data: rows, error: rErr } = await supabase
        .from('catalog_upload_rows')
        .select('*')
        .eq('upload_id', req.params.id)
        .order('row_index')

      if (rErr) throw rErr
      if (!rows?.length) {
        return res.status(400).json({ error: 'No rows to import' })
      }

      const defaultSupplier = upload.supplier_name
      const supplierIdsUsed = new Set()
      const committedProductIds = []

      const { data: existing } = await supabase
        .from('products')
        .select('id, name, sku, supplier_id, unit_price')
        .eq('is_active', true)

      const decisions = await aiMatchProducts(openai, existing ?? [], rows)

      for (const row of rows) {
        if (row.action === 'skip') continue

        const decision = decisions.find((d) => d.row_id === row.id)
        const action = decision?.action ?? row.action ?? 'create'
        const matchId = decision?.match_product_id ?? row.match_product_id ?? null

        if (action === 'skip') continue

        const supplierId = await resolveSupplier(
          supabase,
          row.supplier_name || defaultSupplier
        )
        if (!supplierId) continue

        supplierIdsUsed.add(supplierId)

        const productId = await upsertProduct(supabase, row, supplierId, matchId, action)
        if (productId) committedProductIds.push(productId)
      }

      let deactivated = 0
      const replaceCatalog = upload.source_type !== 'quote'
      if (replaceCatalog) {
        for (const supplierId of supplierIdsUsed) {
          const idsForSupplier = []
          const { data: prods } = await supabase
            .from('products')
            .select('id')
            .in('id', committedProductIds)
            .eq('supplier_id', supplierId)

          for (const p of prods ?? []) idsForSupplier.push(p.id)
          deactivated += await deactivateMissingForSupplier(supabase, supplierId, idsForSupplier)
        }
      }

      await supabase
        .from('catalog_uploads')
        .update({ status: 'committed', committed_at: new Date().toISOString() })
        .eq('id', req.params.id)

      await supabase.from('catalog_upload_rows').delete().eq('upload_id', req.params.id)

      const { data: summary } = await supabase
        .from('products')
        .select('id, name, category, unit, unit_price, sku, size_spec, suppliers(name)')
        .in('id', committedProductIds)

      res.json({
        created_or_updated: committedProductIds.length,
        deactivated,
        products: summary ?? []
      })
    } catch (err) {
      console.error('[catalog commit]', err)
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
