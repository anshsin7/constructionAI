import { useCallback, useEffect, useState } from 'react'
import { api, type CatalogPreviewRow, type CommittedProduct } from '../lib/api'

const SOURCE_TYPES = [
  { value: 'price_list', label: 'Price list' },
  { value: 'contract', label: 'Contract (PDF)' },
  { value: 'quote', label: 'Quote' }
] as const

const DEMO_PROCUREMENT_ID = '22222222-2222-2222-2222-222222222203'

type Step = 'form' | 'preview' | 'done'

export function UploadPage() {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [sourceType, setSourceType] = useState<string>('price_list')
  const [supplierName, setSupplierName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<Step>('form')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [preview, setPreview] = useState<CatalogPreviewRow[]>([])
  const [skipped, setSkipped] = useState(0)
  const [committed, setCommitted] = useState<CommittedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    api.getSuppliers().then((r) => setSuppliers(r.suppliers)).catch(() => {})
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }, [])

  async function handleUpload() {
    if (!file) {
      setError('Choose a file first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.uploadCatalog(file, {
        source_type: sourceType,
        supplier_name: supplierName || undefined,
        uploaded_by: DEMO_PROCUREMENT_ID
      })
      if (!result.preview?.length) {
        setError('No products with prices were found in this file.')
        return
      }
      setUploadId(result.upload_id)
      setPreview(result.preview)
      setSkipped(result.skipped_no_price)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    if (!uploadId) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.commitCatalog(uploadId)
      setCommitted(result.products)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Commit failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('form')
    setFile(null)
    setUploadId(null)
    setPreview([])
    setCommitted([])
    setSkipped(0)
    setError(null)
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Product catalog upload</h2>
      <p className="mb-6 text-sm text-slate-400">
        Import contracts, price lists, or quotes (CSV, XLSX, PDF up to 15 pages). All files are
        parsed with AI (PDFs use vision for scans). May take 30–90 seconds for large Excel files.
        products; rows without a price are skipped.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-red-300">
          {error}
        </p>
      )}

      {step === 'form' && (
        <div className="max-w-xl space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Document type</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Supplier</label>
            <input
              list="suppliers-list"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. BauSupply AG"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100"
            />
            <datalist id="suppliers-list">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed px-8 py-12 text-center transition ${
              dragOver ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-900/50'
            }`}
          >
            <p className="text-slate-300">Drag & drop CSV, XLSX, or PDF</p>
            <p className="mt-2 text-xs text-slate-500">or</p>
            <label className="mt-3 inline-block cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400">
              Browse files
              <input
                type="file"
                accept=".csv,.xlsx,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && <p className="mt-4 text-sm text-amber-300">{file.name}</p>}
          </div>

          <button
            type="button"
            disabled={loading || !file}
            onClick={handleUpload}
            className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900 disabled:opacity-50"
          >
            {loading ? 'AI reading document (may take up to 60s)…' : 'Upload & preview'}
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div>
          {skipped > 0 && (
            <p className="mb-4 text-sm text-amber-300">
              {skipped} row(s) skipped (no price found in document).
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Price (CHF)</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-slate-400">{row.sku ?? '—'}</td>
                    <td className="px-4 py-3">{row.category}</td>
                    <td className="px-4 py-3">{row.unit}</td>
                    <td className="px-4 py-3">{Number(row.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3">{row.supplier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.size_spec ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500">{preview.length} product(s) ready to import.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={loading || preview.length === 0}
              onClick={handleCommit}
              className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900 disabled:opacity-50"
            >
              {loading ? 'Saving to database…' : 'Confirm import'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-600 px-6 py-3 text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div>
          <p className="mb-4 text-green-400 font-semibold">
            Catalog updated — {committed.length} product(s) saved.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price (CHF)</th>
                  <th className="px-4 py-3">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {committed.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-slate-400">{p.sku ?? '—'}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3">{Number(p.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {(p.suppliers as { name?: string } | null)?.name ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-900"
          >
            Upload another file
          </button>
        </div>
      )}
    </div>
  )
}
