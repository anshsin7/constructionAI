import { Resend } from 'resend'
import { generatePoPdf } from './generatePoPdf.js'

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
    .select('name, location, spent, total_budget')
    .eq('id', order.site_id)
    .single()

  return { order, product: productWithSupplier, requestor, site }
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

  const pdfBuffer = await generatePoPdf({
    poNumber,
    orderDate,
    siteName: site?.name ?? 'Site',
    siteLocation: site?.location,
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
  const resendKey = process.env.RESEND_API_KEY

  if (resendKey && poTestEmail) {
    const resend = new Resend(resendKey)
    const from = process.env.RESEND_FROM || 'Construction AI <onboarding@resend.dev>'
    await resend.emails.send({
      from,
      to: poTestEmail,
      subject: `PO #${poNumber} — ${site?.name ?? 'Site'}`,
      html: `
        <p>Please confirm this purchase order for <strong>${product?.name}</strong>.</p>
        <p>Quantity: ${order.quantity} · Total: CHF ${order.total_price}</p>
        <p><a href="${confirmUrl}">Confirm order</a></p>
      `,
      attachments: [{ filename: `PO-${poNumber}.pdf`, content: pdfBuffer }]
    })
    emailSent = true
  } else {
    console.log('[PO] Email skipped — set RESEND_API_KEY and PO_TEST_EMAIL in .env')
    console.log('[PO] Confirm link:', confirmUrl)
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
    email_sent: emailSent
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

  const { data: site } = await supabase
    .from('sites')
    .select('spent')
    .eq('id', order.site_id)
    .single()

  const newSpent = Number(site?.spent ?? 0) + Number(order.total_price)

  await supabase.from('sites').update({ spent: newSpent }).eq('id', order.site_id)

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('*')
    .single()

  if (updateError) throw updateError
  return { order: updated }
}
