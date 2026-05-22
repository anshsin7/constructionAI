import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { CHART_COLORS, formatChf, statusLabel, tooltipStyle } from '../lib/charts'
import { api, type Employee, type Order } from '../lib/api'

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [siteName, setSiteName] = useState('')
  const [siteLocation, setSiteLocation] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState<string | null>(null)
  const [batchSendTime, setBatchSendTime] = useState('17:00')
  const [queuedOrders, setQueuedOrders] = useState<Order[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [chartData, setChartData] = useState<{ category: string; amount: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingBatch, setSavingBatch] = useState(false)
  const [sendingBatch, setSendingBatch] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getSite(id)
      .then((r) => {
        setSiteName(r.site.name)
        setSiteLocation(r.site.location ?? '')
        setDeliveryAddress(r.site.delivery_address ?? null)
        const t = r.site.batch_send_time ?? '17:00:00'
        setBatchSendTime(t.slice(0, 5))
        setQueuedOrders(r.queued_orders ?? [])
        setOrders(r.orders)
        setEmployees(r.employees)
        setChartData(r.category_breakdown)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function saveBatchTime() {
    if (!id) return
    setSavingBatch(true)
    try {
      await api.updateSite(id, { batch_send_time: batchSendTime })
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingBatch(false)
    }
  }

  async function sendBatchNow() {
    if (!id) return
    setSendingBatch(true)
    try {
      const r = await api.sendSiteBatch(id)
      alert(
        r.orders_sent > 0
          ? `Sent ${r.orders_sent} order(s) in ${r.batches_sent} merged PO(s) to supplier(s).`
          : 'No queued orders to send.'
      )
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Batch send failed')
    } finally {
      setSendingBatch(false)
    }
  }

  async function saveBudget(userId: string, value: string) {
    const n = Number(value)
    if (Number.isNaN(n) || n < 0) return
    setSaving(userId)
    try {
      await api.updateBudget(userId, n)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  function exportCsv() {
    const header = 'Product,Status,Qty,Total,Date\n'
    const rows = orders
      .map(
        (o) =>
          `"${o.products?.name ?? ''}",${o.status},${o.quantity},${o.total_price},${o.created_at}`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${siteName}-orders.csv`
    a.click()
  }

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})
  const statusChart = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
  const totalOrderValue = orders.reduce((s, o) => s + Number(o.total_price), 0)

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div>
      <Link to="/" className="text-sm text-amber-400 hover:underline">
        ← All sites
      </Link>
      <h2 className="mt-4 mb-2 text-2xl font-bold">{siteName}</h2>
      {siteLocation ? (
        <p className="text-sm text-slate-400">{siteLocation}</p>
      ) : null}
      <p className="mb-4 text-sm text-slate-400">
        {orders.length} orders · {formatChf(totalOrderValue)} total value
      </p>

      {deliveryAddress ? (
        <p className="mb-4 text-sm text-slate-400">PO delivery: {deliveryAddress}</p>
      ) : null}

      <section className="mb-8 rounded-2xl border border-violet-900/50 bg-slate-900 p-6">
        <h3 className="font-semibold text-violet-300">Sourcing — batch orders</h3>
        <p className="mt-1 mb-4 text-sm text-slate-400">
          Non-urgent mobile orders stay <span className="text-violet-300">queued</span> until this
          time (Europe/Zurich). Same supplier → one merged PO.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">
            Daily send time
            <input
              type="time"
              value={batchSendTime}
              onChange={(e) => setBatchSendTime(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={savingBatch}
            onClick={saveBatchTime}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
          >
            {savingBatch ? 'Saving…' : 'Save time'}
          </button>
          <button
            type="button"
            disabled={sendingBatch || queuedOrders.length === 0}
            onClick={sendBatchNow}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {sendingBatch ? 'Sending…' : `Send batch now (${queuedOrders.length})`}
          </button>
        </div>
        {queuedOrders.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {queuedOrders.map((o) => (
              <li key={o.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                {o.products?.name ?? 'Product'} · qty {o.quantity} ·{' '}
                {formatChf(Number(o.total_price))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No orders waiting in the batch queue.</p>
        )}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Spending by category">
          {chartData.length === 0 ? (
            <p className="text-slate-500">No confirmed spending yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatChf(Number(v ?? 0)), 'Spent']} />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Orders by status">
          {statusChart.length === 0 ? (
            <p className="text-slate-500">No orders yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChart}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    label={({ status, count }) => `${statusLabel(status)} (${count})`}
                  >
                    {statusChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v, _n, p) => [v, statusLabel(p.payload.status)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartPanel>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Recent orders</h3>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-2">Product</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>PO</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-800">
                  <td className="py-2">{o.products?.name ?? '—'}</td>
                  <td>{o.status.replace(/_/g, ' ')}</td>
                  <td>{o.quantity}</td>
                  <td>CHF {o.total_price}</td>
                  <td>
                    {o.po_pdf_url ? (
                      <a
                        href={o.po_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:underline"
                      >
                        PDF
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 font-semibold">Employees & budget limits</h3>
        <div className="space-y-4">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-800/50 p-4"
            >
              <div>
                <p className="font-medium">{emp.name}</p>
                <p className="text-sm text-slate-400">
                  {emp.role} · {emp.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Budget CHF</label>
                <input
                  type="number"
                  defaultValue={emp.budget_limit}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                  onBlur={(e) => {
                    if (String(e.target.value) !== String(emp.budget_limit)) {
                      saveBudget(emp.id, e.target.value)
                    }
                  }}
                />
                {saving === emp.id && (
                  <span className="text-xs text-amber-400">Saving…</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
