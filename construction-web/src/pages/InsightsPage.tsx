import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { StatCard } from '../components/StatCard'
import { api, type DashboardData } from '../lib/api'
import { CHART_COLORS, formatChf, statusLabel, tooltipStyle } from '../lib/charts'

export function InsightsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-400">Loading insights…</p>
  if (error) return <p className="text-red-400">{error}</p>
  if (!data) return null

  const { summary } = data
  const budgetUsed =
    summary.total_budget > 0
      ? Math.round((summary.total_spent / summary.total_budget) * 100)
      : 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Sourcing insights</h2>
        <p className="mt-1 text-slate-400">
          Cross-site spending, order pipeline, and catalog overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total spent" value={formatChf(summary.total_spent)} hint={`of ${formatChf(summary.total_budget)} budget (${budgetUsed}%)`} />
        <StatCard
          label="Orders"
          value={String(summary.order_count)}
          hint={`${summary.pending_approvals} pending approval`}
          accent={summary.pending_approvals > 0 ? 'red' : 'slate'}
        />
        <StatCard label="Active sites" value={String(summary.site_count)} />
        <StatCard
          label="Catalog products"
          value={String(summary.catalog_products)}
          hint="Available on mobile"
          accent="green"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Spending trend" subtitle="Last 14 days (approved & confirmed orders)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.spending_timeline}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [formatChf(Number(v ?? 0)), 'Spent']} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#f59e0b"
                  fill="url(#spendGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Orders by status">
          <div className="h-56">
            {data.orders_by_status.length === 0 ? (
              <p className="text-slate-500">No orders yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.orders_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ status, count }) =>
                      `${statusLabel(status)} (${count})`
                    }
                  >
                    {data.orders_by_status.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v, _n, p) => [v, statusLabel(p.payload.status)]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Spend by site" subtitle="Budget vs recorded spend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.spending_by_site} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip {...tooltipStyle} formatter={(v) => formatChf(Number(v ?? 0))} />
                <Legend />
                <Bar dataKey="spent" name="Spent" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                <Bar dataKey="budget" name="Budget" fill="#475569" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.spending_by_site.map((s) => (
              <Link
                key={s.site_id}
                to={`/sites/${s.site_id}`}
                className="text-xs text-amber-400 hover:underline"
              >
                {s.name} →
              </Link>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Spend by category">
          <div className="h-64">
            {data.spending_by_category.length === 0 ? (
              <p className="text-slate-500">No category spend yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.spending_by_category}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatChf(Number(v ?? 0)), 'Spent']} />
                  <Bar dataKey="amount" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Top products by revenue">
          <div className="h-56">
            {data.top_products.length === 0 ? (
              <p className="text-slate-500">No order data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_products} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v) => formatChf(Number(v ?? 0))} />
                  <Bar dataKey="revenue" fill="#34d399" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>

        <ChartPanel title="Catalog size by category">
          <div className="h-56">
            {data.catalog_by_category.length === 0 ? (
              <p className="text-slate-500">
                No products — <Link to="/upload" className="text-amber-400 hover:underline">upload catalog</Link>
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.catalog_by_category}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, count }) => `${category} (${count})`}
                  >
                    {data.catalog_by_category.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>
      </div>
    </div>
  )
}
