import { API_URL } from './config'
import type { Classification, Order, Product } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })
  const text = await res.text()
  let data: { error?: string } & T
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text || `Request failed (${res.status})`)
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

export async function classify(
  type: 'text' | 'image',
  data: string,
  requestor_id: string
): Promise<{ classification: Classification; products: Product[] }> {
  return request('/api/classify', {
    method: 'POST',
    body: JSON.stringify({ type, data, requestor_id })
  })
}

export async function transcribe(
  audioBase64: string,
  filename = 'recording.m4a'
): Promise<{ text: string }> {
  return request('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audio: audioBase64, filename })
  })
}

export type PoResult = {
  po_pdf_url?: string
  confirm_url?: string
  email_sent?: boolean
} | null

export async function createOrder(body: {
  requestor_id: string
  product_id: string
  quantity: number
  input_method: 'image' | 'voice' | 'text'
  ai_classification?: Classification
  is_urgent: boolean
}): Promise<{
  order: Order
  needs_approval: boolean
  queued?: boolean
  batch_send_time?: string | null
  po?: PoResult
}> {
  return request('/api/orders', { method: 'POST', body: JSON.stringify(body) })
}

export async function fetchOrders(params: {
  requestor_id?: string
  approver_id?: string
  status?: string
}): Promise<{ orders: Order[] }> {
  const q = new URLSearchParams()
  if (params.requestor_id) q.set('requestor_id', params.requestor_id)
  if (params.approver_id) q.set('approver_id', params.approver_id)
  if (params.status) q.set('status', params.status)
  const data = await request<{ orders: Order[] | null }>(`/api/orders?${q}`)
  return { orders: data.orders ?? [] }
}

export async function approveOrder(
  id: string,
  approver_id: string,
  approval_note?: string
): Promise<{ order: Order; po?: PoResult }> {
  return request(`/api/orders/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ approver_id, approval_note })
  })
}

export async function rejectOrder(
  id: string,
  approver_id: string,
  approval_note?: string
): Promise<{ order: Order }> {
  return request(`/api/orders/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ approver_id, approval_note })
  })
}
