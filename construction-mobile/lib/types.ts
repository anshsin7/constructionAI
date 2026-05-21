export type Classification = {
  category: string
  matched_product_name: string | null
  confidence: string
  reasoning: string
}

export type Product = {
  id: string
  name: string
  category: string
  unit: string
  unit_price: number
  popularity_score?: number
  suppliers?: { name: string } | null
}

export type Order = {
  id: string
  status: string
  quantity: number
  total_price: number
  approval_note?: string | null
  po_pdf_url?: string | null
  created_at: string
  products?: { name: string; unit_price: number; category?: string }
}
