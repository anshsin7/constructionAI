import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { api, type Employee, type Order } from '../lib/api'

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [siteName, setSiteName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [chartData, setChartData] = useState<{ category: string; amount: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getSite(id)
      .then((r) => {
        setSiteName(r.site.name)
        setOrders(r.orders)
        setEmployees(r.employees)
        setChartData(r.category_breakdown)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

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

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div>
      <Link to="/" className="text-sm text-amber-400 hover:underline">
        ← All sites
      </Link>
      <h2 className="mt-4 mb-6 text-2xl font-bold">{siteName}</h2>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 font-semibold">Spending by category</h3>
        {chartData.length === 0 ? (
          <p className="text-slate-500">No confirmed spending yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none' }}
                  formatter={(v) => [`CHF ${v ?? 0}`, 'Spent']}
                />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

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
