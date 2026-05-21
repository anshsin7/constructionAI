import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI, { toFile } from 'openai'
import { confirmPurchaseOrder, fulfillPurchaseOrder } from './lib/poPipeline.js'
import { CATEGORIES } from './lib/categories.js'
import { rankProducts } from './lib/productSearch.js'
import { createCatalogRouter } from './routes/catalog.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' })) // large enough for base64 images

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseAiJson(raw) {
  const trimmed = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

async function enrichOrders(orders) {
  if (!orders?.length) return []

  const productIds = [...new Set(orders.map((o) => o.product_id).filter(Boolean))]
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit_price, category, unit')
    .in('id', productIds)

  if (error) throw error

  const byId = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  return orders.map((o) => ({
    ...o,
    products: byId[o.product_id]
      ? {
          name: byId[o.product_id].name,
          unit_price: byId[o.product_id].unit_price,
          category: byId[o.product_id].category,
          unit: byId[o.product_id].unit
        }
      : null
  }))
}

async function fetchPendingForApprover(approverId) {
  const { data: workers, error: workersError } = await supabase
    .from('users')
    .select('id')
    .eq('manager_id', approverId)

  if (workersError) throw workersError

  const workerIds = workers?.map((w) => w.id) ?? []
  const byId = new Map()

  const { data: byApprover, error: aErr } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending_approval')
    .eq('approver_id', approverId)

  if (aErr) throw aErr
  for (const o of byApprover ?? []) byId.set(o.id, o)

  if (workerIds.length > 0) {
    const { data: byTeam, error: tErr } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending_approval')
      .in('requestor_id', workerIds)

    if (tErr) throw tErr
    for (const o of byTeam ?? []) byId.set(o.id, o)
  }

  const sorted = [...byId.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  return enrichOrders(sorted)
}

async function tryAutoPo(orderId) {
  try {
    return await fulfillPurchaseOrder(supabase, orderId)
  } catch (err) {
    console.error('[PO]', err.message)
    return null
  }
}

async function approverMayActOnOrder(order, approverId) {
  if (order.approver_id === approverId) return true
  const { data: requestor } = await supabase
    .from('users')
    .select('manager_id')
    .eq('id', order.requestor_id)
    .single()
  return requestor?.manager_id === approverId
}

app.use('/api/catalog', createCatalogRouter(supabase, openai))

// ── POST /api/classify ──────────────────────────────────────────
app.post('/api/classify', async (req, res) => {
  const { type, data } = req.body
  // type: 'image' | 'text'
  // data: base64 string (image) or plain string (text/voice transcript)

  try {
    let messages

    if (type === 'image') {
      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${data}` }
            },
            {
              type: 'text',
              text: `You are a construction site procurement assistant.
Analyze this image and identify what construction product or material is shown or needed.
Infer dimensions (e.g. screw size M8x80) when visible.
Return ONLY valid JSON, no markdown:
{
  "category": "<one of: ${CATEGORIES.join(' | ')}>",
  "matched_product_name": "<specific product name in English or null>",
  "search_query": "<short english search phrase for catalog>",
  "keywords": ["english", "terms"],
  "size_spec": "<dimensions if known, else null>",
  "confidence": "<high | medium | low>",
  "reasoning": "<one sentence>"
}`
            }
          ]
        }
      ]
    } else {
      messages = [
        {
          role: 'user',
          content: `You are a construction site procurement assistant.
A worker needs a product. Understand their request in any language; respond with English catalog terms.
Worker said: "${data}"

Return ONLY valid JSON, no markdown:
{
  "category": "<one of: ${CATEGORIES.join(' | ')}>",
  "matched_product_name": "<specific product name in English or null>",
  "search_query": "<short english search phrase>",
  "keywords": ["english", "terms"],
  "size_spec": "<dimensions if mentioned e.g. 7.5x92mm, else null>",
  "confidence": "<high | medium | low>",
  "reasoning": "<one sentence>"
}`
        }
      ]
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 400
    })

    const raw = completion.choices[0].message.content
    const classification = parseAiJson(raw)

    const { data: catalog, error } = await supabase
      .from('products')
      .select('*, suppliers(name), product_aliases(alias)')
      .eq('is_active', true)
      .order('popularity_score', { ascending: false })
      .limit(500)

    if (error) throw error

    const products = rankProducts(catalog ?? [], classification, 50)

    res.json({
      classification,
      products
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/products ───────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { category, search } = req.query

  try {
    let query = supabase
      .from('products')
      .select('*, suppliers(name)')
      .eq('is_active', true)
      .order('popularity_score', { ascending: false })

    if (category) query = query.eq('category', category)
    if (search) {
      const q = `%${search}%`
      query = query.or(`name.ilike.${q},search_text.ilike.${q}`)
    }

    const { data: products, error } = await query
    if (error) throw error

    res.json({ products })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/orders ────────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  const { requestor_id, product_id, quantity, input_method, ai_classification } =
    req.body

  if (!requestor_id || !product_id || !quantity || !input_method) {
    return res.status(400).json({
      error: 'requestor_id, product_id, quantity, and input_method are required'
    })
  }

  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, unit_price, name, is_active')
      .eq('id', product_id)
      .single()

    if (productError) throw productError
    if (product.is_active === false) {
      return res.status(400).json({ error: 'Product is no longer available' })
    }

    const { data: requestor, error: userError } = await supabase
      .from('users')
      .select('id, site_id, budget_limit, manager_id, name')
      .eq('id', requestor_id)
      .single()

    if (userError) throw userError

    const total_price = Number(product.unit_price) * Number(quantity)
    const needsApproval = total_price > Number(requestor.budget_limit)

    let approverId = requestor.manager_id ?? null
    if (needsApproval && !approverId && requestor.site_id) {
      const { data: siteApprover } = await supabase
        .from('users')
        .select('id')
        .eq('site_id', requestor.site_id)
        .eq('role', 'approver')
        .limit(1)
        .maybeSingle()
      approverId = siteApprover?.id ?? null
    }

    const order = {
      requestor_id,
      product_id,
      quantity,
      total_price,
      site_id: requestor.site_id,
      input_method,
      ai_classification: ai_classification ?? null,
      status: needsApproval ? 'pending_approval' : 'approved',
      approver_id: needsApproval ? approverId : null
    }

    const { data: created, error: orderError } = await supabase
      .from('orders')
      .insert(order)
      .select('*')
      .single()

    if (orderError) throw orderError
    const [enriched] = await enrichOrders([created])

    const { data: current } = await supabase
      .from('products')
      .select('popularity_score')
      .eq('id', product_id)
      .single()

    await supabase
      .from('products')
      .update({ popularity_score: (current?.popularity_score ?? 0) + 1 })
      .eq('id', product_id)

    const po = needsApproval ? null : await tryAutoPo(created.id)
    const orderOut = po?.order ? (await enrichOrders([po.order]))[0] : enriched

    res.status(201).json({
      order: orderOut,
      needs_approval: needsApproval,
      approver_id: needsApproval ? approverId : null,
      po
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders ─────────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  const { requestor_id, approver_id, status } = req.query

  try {
    if (approver_id && status === 'pending_approval') {
      const orders = await fetchPendingForApprover(approver_id)
      return res.json({ orders })
    }

    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

    if (requestor_id) query = query.eq('requestor_id', requestor_id)
    if (approver_id) query = query.eq('approver_id', approver_id)
    if (status) query = query.eq('status', status)

    const { data: orders, error } = await query
    if (error) throw error

    res.json({ orders: await enrichOrders(orders ?? []) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/transcribe ────────────────────────────────────────
const AUDIO_MIME = {
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  caf: 'audio/x-caf',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  webm: 'audio/webm',
  '3gp': 'audio/3gpp'
}

app.post('/api/transcribe', async (req, res) => {
  const { audio, filename = 'recording.m4a' } = req.body
  if (!audio) {
    return res.status(400).json({ error: 'audio (base64) is required' })
  }

  try {
    const buffer = Buffer.from(audio, 'base64')
    const ext = filename.split('.').pop()?.toLowerCase() || 'm4a'
    const mime = AUDIO_MIME[ext] ?? 'audio/m4a'
    const file = await toFile(buffer, filename, { type: mime })
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1'
    })
    res.json({ text: transcription.text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders/:id ─────────────────────────────────────────
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    const [enriched] = await enrichOrders([order])
    res.json({ order: enriched })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/orders/:id/approve ───────────────────────────────
app.patch('/api/orders/:id/approve', async (req, res) => {
  const { approver_id, approval_note } = req.body

  if (!approver_id) {
    return res.status(400).json({ error: 'approver_id is required' })
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, approver_id, requestor_id')
      .eq('id', req.params.id)
      .single()

    if (fetchError) throw fetchError
    if (existing.status !== 'pending_approval') {
      return res.status(400).json({ error: `Order is ${existing.status}, not pending approval` })
    }
    if (!(await approverMayActOnOrder(existing, approver_id))) {
      return res.status(403).json({ error: 'Not authorized to approve this order' })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'approved',
        approver_id,
        approval_note: approval_note ?? null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    const [enriched] = await enrichOrders([order])
    const po = await tryAutoPo(req.params.id)
    const orderOut = po?.order ? (await enrichOrders([po.order]))[0] : enriched
    res.json({ order: orderOut, po })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/orders/:id/reject ────────────────────────────────
app.patch('/api/orders/:id/reject', async (req, res) => {
  const { approver_id, approval_note } = req.body

  if (!approver_id) {
    return res.status(400).json({ error: 'approver_id is required' })
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, approver_id, requestor_id')
      .eq('id', req.params.id)
      .single()

    if (fetchError) throw fetchError
    if (existing.status !== 'pending_approval') {
      return res.status(400).json({ error: `Order is ${existing.status}, not pending approval` })
    }
    if (!(await approverMayActOnOrder(existing, approver_id))) {
      return res.status(403).json({ error: 'Not authorized to reject this order' })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'rejected',
        approver_id,
        approval_note: approval_note ?? null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    const [enriched] = await enrichOrders([order])
    res.json({ order: enriched })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/orders/:id/po ─────────────────────────────────────
app.post('/api/orders/:id/po', async (req, res) => {
  try {
    const result = await fulfillPurchaseOrder(supabase, req.params.id)
    const [order] = await enrichOrders([result.order])
    res.json({ ...result, order })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/supplier/confirm ──────────────────────────────────
app.post('/api/supplier/confirm', async (req, res) => {
  const orderId = req.body.po ?? req.body.order_id ?? req.query.po
  if (!orderId) {
    return res.status(400).json({ error: 'po (order id) is required' })
  }
  try {
    const result = await confirmPurchaseOrder(supabase, orderId)
    const [order] = await enrichOrders([result.order])
    res.json({ ...result, order })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /confirm?po=<orderId> — supplier link from email ────────
app.get('/confirm', async (req, res) => {
  const orderId = req.query.po
  if (!orderId) {
    return res.status(400).send('<h1>Missing po query parameter</h1>')
  }
  try {
    const result = await confirmPurchaseOrder(supabase, orderId)
    const [order] = await enrichOrders([result.order])
    const name = order.products?.name ?? 'your order'
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
      <h1>Order confirmed</h1>
      <p>PO for <strong>${name}</strong> is confirmed. The site team has been notified.</p>
      <p>Status: ${order.status}</p>
    </body></html>`)
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`)
  }
})

// ── GET /api/sites ──────────────────────────────────────────────
app.get('/api/sites', async (req, res) => {
  try {
    const { data: sites, error } = await supabase.from('sites').select('*').order('name')
    if (error) throw error

    const { data: orders } = await supabase
      .from('orders')
      .select('id, site_id, status')
      .in('status', ['pending_approval', 'approved', 'po_sent'])

    const activeBySite = {}
    for (const o of orders ?? []) {
      if (o.site_id) activeBySite[o.site_id] = (activeBySite[o.site_id] ?? 0) + 1
    }

    res.json({
      sites: (sites ?? []).map((s) => ({
        ...s,
        active_orders: activeBySite[s.id] ?? 0
      }))
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/sites/:id ──────────────────────────────────────────
app.get('/api/sites/:id', async (req, res) => {
  try {
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (siteError) throw siteError

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('site_id', req.params.id)
      .order('created_at', { ascending: false })

    if (ordersError) throw ordersError

    const enriched = await enrichOrders(orders ?? [])

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, budget_limit')
      .eq('site_id', req.params.id)
      .order('name')

    if (usersError) throw usersError

    const spendingByCategory = {}
    for (const o of enriched) {
      if (!['approved', 'po_sent', 'confirmed'].includes(o.status)) continue
      const cat = o.products?.category ?? 'Other'
      spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + Number(o.total_price)
    }

    const categoryBreakdown = Object.entries(spendingByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    res.json({
      site,
      orders: enriched,
      employees: users ?? [],
      category_breakdown: categoryBreakdown
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/users/:id/budget ─────────────────────────────────
app.patch('/api/users/:id/budget', async (req, res) => {
  const { budget_limit } = req.body
  if (budget_limit === undefined || budget_limit === null) {
    return res.status(400).json({ error: 'budget_limit is required' })
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ budget_limit: Number(budget_limit) })
      .eq('id', req.params.id)
      .select('id, name, email, role, budget_limit, site_id')
      .single()

    if (error) throw error
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/dashboard — procurement analytics ──────────────────
const SPENT_STATUSES = ['approved', 'po_sent', 'confirmed']

app.get('/api/dashboard', async (req, res) => {
  try {
    const { data: sites, error: sitesErr } = await supabase
      .from('sites')
      .select('id, name, total_budget, spent')
    if (sitesErr) throw sitesErr

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, status, total_price, created_at, site_id, product_id, quantity')
      .order('created_at', { ascending: false })
    if (ordersErr) throw ordersErr

    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, category, popularity_score, unit_price')
      .eq('is_active', true)
    if (prodErr) throw prodErr

    const enriched = await enrichOrders(orders ?? [])

    const ordersByStatus = {}
    let pendingApprovals = 0
    const categorySpend = {}
    const siteSpend = {}
    const productStats = {}
    const dailySpend = {}

    for (const o of enriched) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1
      if (o.status === 'pending_approval') pendingApprovals++

      if (SPENT_STATUSES.includes(o.status)) {
        const amount = Number(o.total_price)
        const cat = o.products?.category ?? 'Other'
        categorySpend[cat] = (categorySpend[cat] ?? 0) + amount
        if (o.site_id) siteSpend[o.site_id] = (siteSpend[o.site_id] ?? 0) + amount
        const day = String(o.created_at).slice(0, 10)
        dailySpend[day] = (dailySpend[day] ?? 0) + amount
      }

      const pname = o.products?.name
      if (pname) {
        if (!productStats[pname]) {
          productStats[pname] = { name: pname, category: o.products?.category, orders: 0, revenue: 0 }
        }
        productStats[pname].orders += 1
        productStats[pname].revenue += Number(o.total_price)
      }
    }

    const catalogByCategory = {}
    for (const p of products ?? []) {
      catalogByCategory[p.category] = (catalogByCategory[p.category] ?? 0) + 1
    }

    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const spendingTimeline = days.map((date) => ({
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      }),
      amount: Math.round((dailySpend[date] ?? 0) * 100) / 100
    }))

    const siteList = sites ?? []
    res.json({
      summary: {
        site_count: siteList.length,
        total_budget: siteList.reduce((s, x) => s + Number(x.total_budget), 0),
        total_spent: siteList.reduce((s, x) => s + Number(x.spent), 0),
        order_count: enriched.length,
        pending_approvals: pendingApprovals,
        catalog_products: products?.length ?? 0
      },
      spending_by_site: siteList.map((s) => ({
        site_id: s.id,
        name: s.name,
        spent: Number(s.spent),
        budget: Number(s.total_budget),
        order_spend: siteSpend[s.id] ?? 0
      })),
      spending_by_category: Object.entries(categorySpend)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      orders_by_status: Object.entries(ordersByStatus).map(([status, count]) => ({
        status,
        count
      })),
      top_products: Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      top_products_by_orders: Object.values(productStats)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10),
      spending_timeline: spendingTimeline,
      catalog_by_category: Object.entries(catalogByCategory)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const port = process.env.PORT || 3001
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend running on http://0.0.0.0:${port}`)
  console.log('Expo Go on phone: use your Mac LAN IP, not localhost')
})
