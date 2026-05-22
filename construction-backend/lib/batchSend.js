import { fulfillBatchPurchaseOrder } from './poPipeline.js'

export const BATCH_TZ = 'Europe/Zurich'

export function normalizeBatchTime(value) {
  if (!value) return null
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

export function zurichDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BATCH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function zurichTimeHHMM(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BATCH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

/** Group queued orders by supplier (via product.supplier_id). */
export async function groupQueuedOrdersBySupplier(supabase, siteId) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('site_id', siteId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!orders?.length) return []

  const productIds = [...new Set(orders.map((o) => o.product_id))]
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, supplier_id')
    .in('id', productIds)

  if (pErr) throw pErr

  const supplierByProduct = Object.fromEntries((products ?? []).map((p) => [p.id, p.supplier_id]))
  const groups = new Map()

  for (const order of orders) {
    const supplierId = supplierByProduct[order.product_id] ?? 'unknown'
    if (!groups.has(supplierId)) groups.set(supplierId, [])
    groups.get(supplierId).push(order)
  }

  return [...groups.entries()].map(([supplierId, groupOrders]) => ({
    supplierId,
    orders: groupOrders
  }))
}

export async function processSiteBatch(supabase, siteId, { force = false } = {}) {
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, name, batch_send_time, last_batch_sent_date')
    .eq('id', siteId)
    .single()

  if (siteErr) throw siteErr

  const groups = await groupQueuedOrdersBySupplier(supabase, siteId)
  if (groups.length === 0) {
    return { site_id: siteId, batches_sent: 0, orders_sent: 0, groups: [] }
  }

  const today = zurichDateKey()
  const results = []

  for (const { supplierId, orders } of groups) {
    const result = await fulfillBatchPurchaseOrder(supabase, {
      siteId,
      supplierId,
      orders
    })
    results.push(result)
  }

  await supabase
    .from('sites')
    .update({ last_batch_sent_date: today })
    .eq('id', siteId)

  return {
    site_id: siteId,
    batches_sent: results.length,
    orders_sent: results.reduce((n, r) => n + (r.order_ids?.length ?? 0), 0),
    groups: results,
    forced: force
  }
}

export async function runScheduledBatches(supabase) {
  const { data: sites, error } = await supabase
    .from('sites')
    .select('id, batch_send_time, last_batch_sent_date')
    .not('batch_send_time', 'is', null)

  if (error) throw error

  const nowHHMM = zurichTimeHHMM()
  const today = zurichDateKey()
  const ran = []

  for (const site of sites ?? []) {
    const target = normalizeBatchTime(site.batch_send_time)
    if (!target || target !== nowHHMM) continue
    if (site.last_batch_sent_date === today) continue

    const result = await processSiteBatch(supabase, site.id)
    if (result.orders_sent > 0) {
      ran.push(result)
      console.log(
        `[Batch] Site ${site.id}: sent ${result.orders_sent} order(s) in ${result.batches_sent} PO(s) at ${nowHHMM}`
      )
    }
  }

  return ran
}

export function startBatchScheduler(supabase) {
  const tick = async () => {
    try {
      await runScheduledBatches(supabase)
    } catch (err) {
      console.error('[Batch] Scheduler error:', err.message)
    }
  }

  tick()
  const interval = setInterval(tick, 60 * 1000)
  return () => clearInterval(interval)
}
