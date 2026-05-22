import { Resend } from 'resend'
import { generateBatchPoPdf, generatePoPdf } from './generatePoPdf.js'

const PO_BUCKET = process.env.SUPABASE_PO_BUCKET || 'po-documents'

export async function loadOrderContext(supabase, orderId) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single()
  if (error) throw error

  const { data: product } = await supabase
    .from('products')
    .select('name, unit, unit_price, supplier_id')
    .eq('id', order.product_id)
    .single()

  let suppliers = null
  if (product?.supplier_id) {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('name, email')
      .eq('id', product.supplier_id)
      .single()
    suppliers = sup
  }
  const productWithSupplier = product ? { ...product, suppliers } : null

  const { data: requestor } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', order.requestor_id)
    .single()

  const { data: site } = await supabase
    .from('sites')
    .select('name, location, delivery_address, spent, total_budget')
    .eq('id', order.site_id)
    .single()

  return { order, product: productWithSupplier, requestor, site }
}

export function siteDeliveryAddress(site) {
  const delivery = site?.delivery_address?.trim()
  if (delivery) return delivery
  const location = site?.location?.trim()
  return location || null
}

export async function fulfillPurchaseOrder(supabase, orderId) {
  const { order, product, requestor, site } = await loadOrderContext(supabase, orderId)

  if (order.status === 'po_sent' || order.status === 'confirmed') {
    return { order, alreadySent: true, po_pdf_url: order.po_pdf_url }
  }

  if (order.status !== 'approved') {
    throw new Error(`Cannot send PO for order in status: ${order.status}`)
  }

  const poNumber = order.id.slice(0, 8).toUpperCase()
  const orderDate = new Date(order.created_at).toLocaleDateString('de-CH')
  const supplierName = product?.suppliers?.name ?? 'Supplier'
  // Never email real supplier addresses from seed data — use PO_TEST_EMAIL in .env only
  const poTestEmail = process.env.PO_TEST_EMAIL?.trim() || null

  const deliveryAddress = siteDeliveryAddress(site)

  const pdfBuffer = await generatePoPdf({
    poNumber,
    orderDate,
    siteName: site?.name ?? 'Site',
    siteAddress: deliveryAddress,
    requestorName: requestor?.name ?? 'Worker',
    productName: product?.name ?? 'Product',
    quantity: order.quantity,
    unit: product?.unit ?? 'piece',
    unitPrice: Number(product?.unit_price ?? order.total_price / order.quantity).toFixed(2),
    totalPrice: Number(order.total_price).toFixed(2),
    supplierName
  })

  const filePath = `po-${orderId}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(PO_BUCKET)
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(PO_BUCKET).getPublicUrl(filePath)
  const poPdfUrl = publicUrl.publicUrl

  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
  const confirmUrl = `${baseUrl}/confirm?po=${orderId}`

  let emailSent = false
  let emailError = null
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim() || 'C-Flow <onboarding@resend.dev>'

  if (!resendKey) {
    console.warn('[PO] Email skipped — RESEND_API_KEY missing in .env')
  } else if (!poTestEmail) {
    console.warn('[PO] Email skipped — PO_TEST_EMAIL missing in .env')
  } else {
    try {
      const resend = new Resend(resendKey)
      const { data, error } = await resend.emails.send({
        from,
        to: poTestEmail,
        subject: `PO #${poNumber} — ${site?.name ?? 'Site'}`,
        html: `
          <p>Please confirm this purchase order for <strong>${product?.name}</strong>.</p>
          <p>Quantity: ${order.quantity} · Total: CHF ${order.total_price}</p>
          <p><strong>Deliver to:</strong><br>${site?.name ?? 'Site'}<br>${(deliveryAddress ?? '—').replace(/\n/g, '<br>')}</p>
          <p><a href="${confirmUrl}">Confirm order</a></p>
        `,
        attachments: [{ filename: `PO-${poNumber}.pdf`, content: pdfBuffer }]
      })
      if (error) {
        emailError = error.message ?? String(error)
        console.error('[PO] Resend API error:', error)
      } else {
        emailSent = true
        console.log('[PO] Email sent to', poTestEmail, data?.id ? `(id ${data.id})` : '')
      }
    } catch (err) {
      emailError = err.message
      console.error('[PO] Email send failed:', err.message)
    }
  }

  if (!emailSent) {
    console.log('[PO] Confirm link (no email):', confirmUrl)
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'po_sent',
      po_pdf_url: poPdfUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select('*')
    .single()

  if (updateError) throw updateError

  return {
    order: updated,
    po_pdf_url: poPdfUrl,
    confirm_url: confirmUrl,
    email_sent: emailSent,
    email_error: emailError
  }
}

export async function fulfillBatchPurchaseOrder(supabase, { siteId, supplierId, orders }) {
  if (!orders?.length) throw new Error('No orders to batch')

  const orderIds = orders.map((o) => o.id)
  const batchPoKey = `BATCH-${orderIds[0].slice(0, 8).toUpperCase()}`
  const poNumber = batchPoKey.replace('BATCH-', '')

  const { data: site } = await supabase
    .from('sites')
    .select('name, location, delivery_address')
    .eq('id', siteId)
    .single()

  let supplierName = 'Supplier'
  if (supplierId && supplierId !== 'unknown') {
    const { data: sup } = await supabase.from('suppliers').select('name').eq('id', supplierId).single()
    supplierName = sup?.name ?? supplierName
  }

  const productIds = [...new Set(orders.map((o) => o.product_id))]
  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit, unit_price')
    .in('id', productIds)

  const productById = Object.fromEntries((products ?? []).map((p) => [p.id, p]))

  const requestorIds = [...new Set(orders.map((o) => o.requestor_id))]
  const { data: requestors } = await supabase.from('users').select('id, name').in('id', requestorIds)
  const requestorNames = (requestors ?? []).map((r) => r.name)
  const requestorSummary =
    requestorNames.length <= 2
      ? requestorNames.join(', ')
      : `${requestorNames.slice(0, 2).join(', ')} +${requestorNames.length - 2} more`

  const lineItems = orders.map((o) => {
    const p = productById[o.product_id]
    const unitPrice = Number(p?.unit_price ?? o.total_price / o.quantity).toFixed(2)
    return {
      productName: p?.name ?? 'Product',
      quantity: o.quantity,
      unitPrice,
      lineTotal: Number(o.total_price).toFixed(2)
    }
  })

  const totalPrice = orders.reduce((s, o) => s + Number(o.total_price), 0).toFixed(2)
  const orderDate = new Date().toLocaleDateString('de-CH')
  const deliveryAddress = siteDeliveryAddress(site)

  const pdfBuffer = await generateBatchPoPdf({
    poNumber,
    orderDate,
    siteName: site?.name ?? 'Site',
    siteAddress: deliveryAddress,
    supplierName,
    requestorSummary,
    lineItems,
    totalPrice
  })

  const filePath = `po-batch-${batchPoKey}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(PO_BUCKET)
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) throw uploadError

  const { data: publicUrl } = supabase.storage.from(PO_BUCKET).getPublicUrl(filePath)
  const poPdfUrl = publicUrl.publicUrl

  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`
  const confirmUrl = `${baseUrl}/confirm?po=${orderIds[0]}`

  const poTestEmail = process.env.PO_TEST_EMAIL?.trim() || null
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM?.trim() || 'C-Flow <onboarding@resend.dev>'

  let emailSent = false
  let emailError = null

  const linesHtml = lineItems
    .map(
      (l) =>
        `<li>${l.productName} — qty ${l.quantity} — CHF ${l.lineTotal}</li>`
    )
    .join('')

  if (!resendKey) {
    console.warn('[PO] Email skipped — RESEND_API_KEY missing in .env')
  } else if (!poTestEmail) {
    console.warn('[PO] Email skipped — PO_TEST_EMAIL missing in .env')
  } else {
    try {
      const resend = new Resend(resendKey)
      const { data, error } = await resend.emails.send({
        from,
        to: poTestEmail,
        subject: `Batch PO #${poNumber} — ${site?.name ?? 'Site'} (${orders.length} lines)`,
        html: `
          <p>Combined purchase order for <strong>${supplierName}</strong>.</p>
          <ul>${linesHtml}</ul>
          <p><strong>Total: CHF ${totalPrice}</strong></p>
          <p><strong>Deliver to:</strong><br>${site?.name ?? 'Site'}<br>${(deliveryAddress ?? '—').replace(/\n/g, '<br>')}</p>
          <p><a href="${confirmUrl}">Confirm batch</a></p>
        `,
        attachments: [{ filename: `PO-BATCH-${poNumber}.pdf`, content: pdfBuffer }]
      })
      if (error) {
        emailError = error.message ?? String(error)
        console.error('[PO] Batch Resend error:', error)
      } else {
        emailSent = true
        console.log('[PO] Batch email sent to', poTestEmail, data?.id ? `(id ${data.id})` : '')
      }
    } catch (err) {
      emailError = err.message
      console.error('[PO] Batch email failed:', err.message)
    }
  }

  if (!emailSent) {
    console.log('[PO] Batch confirm link (no email):', confirmUrl)
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'po_sent',
      po_pdf_url: poPdfUrl,
      batch_po_key: batchPoKey,
      updated_at: now
    })
    .in('id', orderIds)
    .select('*')

  if (updateError) throw updateError

  return {
    batch_po_key: batchPoKey,
    po_pdf_url: poPdfUrl,
    confirm_url: confirmUrl,
    email_sent: emailSent,
    email_error: emailError,
    order_ids: orderIds,
    orders: updated,
    supplier_name: supplierName,
    line_count: orders.length
  }
}

export async function confirmPurchaseOrder(supabase, orderId) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single()
  if (error) throw error

  if (order.status === 'confirmed') {
    return { order, alreadyConfirmed: true }
  }
  if (order.status !== 'po_sent') {
    throw new Error(`Order cannot be confirmed from status: ${order.status}`)
  }

  const confirmFilter = order.batch_po_key
    ? { column: 'batch_po_key', value: order.batch_po_key }
    : { column: 'id', value: orderId }

  const { data: toConfirm, error: listErr } = await supabase
    .from('orders')
    .select('id, total_price, site_id')
    .eq(confirmFilter.column, confirmFilter.value)
    .eq('status', 'po_sent')

  if (listErr) throw listErr

  const { data: site } = await supabase
    .from('sites')
    .select('spent')
    .eq('id', order.site_id)
    .single()

  const addSpent = (toConfirm ?? []).reduce((s, o) => s + Number(o.total_price), 0)
  const newSpent = Number(site?.spent ?? 0) + addSpent

  await supabase.from('sites').update({ spent: newSpent }).eq('id', order.site_id)

  const ids = (toConfirm ?? []).map((o) => o.id)
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .in('id', ids)
    .select('*')

  if (updateError) throw updateError
  return { order: updated?.find((o) => o.id === orderId) ?? order, confirmed_count: ids.length }
}
