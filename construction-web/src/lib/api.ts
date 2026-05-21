const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data
}

export type Site = {
  id: string
  name: string
  location: string
  total_budget: number
  spent: number
  active_orders?: number
}

export type Order = {
  id: string
  status: string
  quantity: number
  total_price: number
  created_at: string
  po_pdf_url?: string | null
  approval_note?: string | null
  products?: { name: string; category?: string; unit_price?: number }
}

export type Employee = {
  id: string
  name: string
  email: string
  role: string
  budget_limit: number
}

export type CatalogPreviewRow = {
  id: string
  name: string
  category: string
  unit: string
  unit_price: number
  sku?: string | null
  supplier_name?: string | null
  size_spec?: string | null
}

export type CommittedProduct = {
  id: string
  name: string
  category: string
  unit_price: number
  sku?: string | null
  suppliers?: { name: string } | null
}

export const api = {
  getSites: () => request<{ sites: Site[] }>('/api/sites'),
  getSuppliers: () => request<{ suppliers: { id: string; name: string }[] }>('/api/catalog/suppliers'),
  uploadCatalog: async (
    file: File,
    fields: { source_type: string; supplier_name?: string; uploaded_by?: string }
  ) => {
    const form = new FormData()
    form.append('file', file)
    form.append('source_type', fields.source_type)
    if (fields.supplier_name) form.append('supplier_name', fields.supplier_name)
    if (fields.uploaded_by) form.append('uploaded_by', fields.uploaded_by)
    const res = await fetch(`${API_URL}/api/catalog/upload`, { method: 'POST', body: form })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? res.statusText)
    return data as {
      upload_id: string
      preview: CatalogPreviewRow[]
      skipped_no_price: number
    }
  },
  commitCatalog: (uploadId: string) =>
    request<{
      created_or_updated: number
      deactivated: number
      products: CommittedProduct[]
    }>(`/api/catalog/upload/${uploadId}/commit`, { method: 'POST' }),
  getSite: (id: string) =>
    request<{
      site: Site
      orders: Order[]
      employees: Employee[]
      category_breakdown: { category: string; amount: number }[]
    }>(`/api/sites/${id}`),
  getOrders: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params)
    return request<{ orders: Order[] }>(`/api/orders?${q}`)
  },
  updateBudget: (userId: string, budget_limit: number) =>
    request<{ user: Employee }>(`/api/users/${userId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ budget_limit })
    })
}

export { API_URL }
