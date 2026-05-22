import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { StatCard } from '../components/StatCard'
import { api, type Order } from '../lib/api'
import { CHART_COLORS, formatChf, statusLabel, tooltipStyle } from '../lib/charts'

const STATUSES = [
  'all',
  'pending_approval',
  'queued',
  'approved',
  'po_sent',
  'confirmed',
  'rejected'
]

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Order | null>(null)

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = status === 'all' ? {} : { status }
    api
      .getOrders(params)
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status])

  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of orders) m[o.status] = (m[o.status] ?? 0) + 1
    return Object.entries(m).map(([status, count]) => ({ status, count }))
  }, [orders])

  const totalValue = useMemo(
    () => orders.reduce((s, o) => s + Number(o.total_price), 0),
    [orders]
  )

  if (loading) return <p className="text-slate-400">Loading orders…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Order history</h2>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders shown" value={String(orders.length)} />
        <StatCard label="Total value" value={formatChf(totalValue)} accent="amber" />
        <StatCard
          label="Pending"
          value={String(orders.filter((o) => o.status === 'pending_approval').length)}
          accent="red"
        />
      </div>

      {statusBreakdown.length > 0 && (
        <ChartPanel title="Status breakdown (current filter)" className="max-w-md">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ status, count }) => `${statusLabel(status)} (${count})`}
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-400">
            <tr>
              <th className="p-3">Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/40"
                  onClick={() => setSelected(o)}
                >
                  <td className="p-3 font-medium">{o.products?.name ?? '—'}</td>
                  <td>{o.products?.category ?? '—'}</td>
                  <td>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 capitalize">
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{o.quantity}</td>
                  <td>CHF {o.total_price}</td>
                  <td className="text-slate-400">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{selected.products?.name}</h3>
            <p className="mt-2 text-slate-400">Status: {selected.status}</p>
            <p>Quantity: {selected.quantity}</p>
            <p>Total: CHF {selected.total_price}</p>
            {selected.po_pdf_url && (
              <a
                href={selected.po_pdf_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-amber-400 hover:underline"
              >
                Open PO PDF
              </a>
            )}
            <button
              type="button"
              className="mt-6 w-full rounded-lg bg-slate-800 py-2 hover:bg-slate-700"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
