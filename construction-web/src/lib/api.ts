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
  delivery_address?: string | null
  batch_send_time?: string | null
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

export type DashboardData = {
  summary: {
    site_count: number
    total_budget: number
    total_spent: number
    order_count: number
    pending_approvals: number
    queued_orders: number
    catalog_products: number
  }
  spending_by_site: {
    site_id: string
    name: string
    spent: number
    budget: number
    order_spend: number
  }[]
  spending_by_category: { category: string; amount: number }[]
  orders_by_status: { status: string; count: number }[]
  top_products: { name: string; category?: string; orders: number; revenue: number }[]
  top_products_by_orders: { name: string; category?: string; orders: number; revenue: number }[]
  spending_timeline: { date: string; label: string; amount: number }[]
  catalog_by_category: { category: string; count: number }[]
}

export type Product = {
  id: string
  name: string
  category: string
  unit: string
  unit_price: number
  popularity_score: number
  sku?: string | null
  suppliers?: { name: string } | null
}

export const api = {
  getDashboard: () => request<DashboardData>('/api/dashboard'),
  getSites: () => request<{ sites: Site[] }>('/api/sites'),
  getProducts: (params?: { category?: string; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.category) q.set('category', params.category)
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return request<{ products: Product[] }>(`/api/products${qs ? `?${qs}` : ''}`)
  },
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
  commitCatalog: async (uploadId: string) => {
    const res = await fetch(`${API_URL}/api/catalog/upload/${uploadId}/commit`, {
      method: 'POST'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? res.statusText)
    return data as {
      created_or_updated: number
      deactivated: number
      products: CommittedProduct[]
    }
  },
  getSite: (id: string) =>
    request<{
      site: Site
      orders: Order[]
      queued_orders: Order[]
      queued_count: number
      employees: Employee[]
      category_breakdown: { category: string; amount: number }[]
    }>(`/api/sites/${id}`),
  sendSiteBatch: (siteId: string) =>
    request<{
      site_id: string
      batches_sent: number
      orders_sent: number
      groups: unknown[]
    }>(`/api/sites/${siteId}/send-batch`, { method: 'POST' }),
  updateSite: (
    siteId: string,
    body: {
      delivery_address?: string
      location?: string
      name?: string
      batch_send_time?: string
    }
  ) =>
    request<{ site: Site }>(`/api/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
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
