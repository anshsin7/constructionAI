import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Site } from '../lib/api'

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getSites()
      .then((r) => setSites(r.sites))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-slate-400">Loading sites…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Site overview</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {sites.map((site) => (
          <Link
            key={site.id}
            to={`/sites/${site.id}`}
            className="block rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10"
          >
            <h3 className="text-lg font-bold">{site.name}</h3>
            <p className="text-sm text-slate-400">{site.location}</p>
            <BudgetBar spent={Number(site.spent)} total={Number(site.total_budget)} />
            <p className="mt-4 text-sm text-slate-500">
              {site.active_orders ?? 0} active order(s)
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
