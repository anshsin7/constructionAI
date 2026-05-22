import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ChartPanel } from '../components/ChartPanel'
import { StatCard } from '../components/StatCard'
import { api, type DashboardData, type Site } from '../lib/api'
import { formatChf, tooltipStyle } from '../lib/charts'

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const over = spent > total
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-sm text-slate-400">
        <span>CHF {spent.toLocaleString()} spent</span>
        <span>CHF {total.toLocaleString()}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function OverviewPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getSites(), api.getDashboard()])
      .then(([s, d]) => {
        setSites(s.sites)
        setDash(d)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-red-400">{error}</p>

  const summary = dash?.summary

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="mt-1 text-slate-400">Sites, budgets, and quick sourcing metrics</p>
        </div>
        <Link
          to="/insights"
          className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/10"
        >
          Full insights →
        </Link>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total spent" value={formatChf(summary.total_spent)} hint={`Budget ${formatChf(summary.total_budget)}`} />
          <StatCard
            label="Pending approvals"
            value={String(summary.pending_approvals)}
            accent={summary.pending_approvals > 0 ? 'red' : 'slate'}
          />
          <StatCard label="Orders" value={String(summary.order_count)} />
          <StatCard label="Catalog" value={String(summary.catalog_products)} hint="Active products" accent="green" />
        </div>
      )}

      {dash && dash.spending_by_category.length > 0 && (
        <ChartPanel title="Company-wide spend by category" className="max-w-2xl">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dash.spending_by_category}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip {...tooltipStyle} formatter={(v) => [formatChf(Number(v ?? 0)), 'Spent']} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      )}

      <div>
        <h3 className="mb-4 text-lg font-semibold">Construction sites</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {sites.map((site) => (
            <Link
              key={site.id}
              to={`/sites/${site.id}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10"
            >
              <h3 className="text-lg font-bold">{site.name}</h3>
              <p className="text-sm text-slate-400">
                {site.delivery_address
                  ? site.delivery_address.split('\n')[0]
                  : site.location}
              </p>
              <BudgetBar spent={Number(site.spent)} total={Number(site.total_budget)} />
              <p className="mt-4 text-sm text-slate-500">
                {site.active_orders ?? 0} active order(s)
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
