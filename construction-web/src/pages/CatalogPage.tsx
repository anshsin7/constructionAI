import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { StatCard } from '../components/StatCard'
import { api, type Product } from '../lib/api'
import { CHART_COLORS, formatChf, tooltipStyle } from '../lib/charts'

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .getProducts(search ? { search } : undefined)
      .then((r) => setProducts(r.products))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [search])

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category))
    return ['all', ...Array.from(set).sort()]
  }, [products])

  const filtered = useMemo(() => {
    if (category === 'all') return products
    return products.filter((p) => p.category === category)
  }, [products, category])

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of products) {
      map[p.category] = (map[p.category] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }, [products])

  const topPopular = useMemo(
    () => [...products].sort((a, b) => b.popularity_score - a.popularity_score).slice(0, 8),
    [products]
  )

  const avgPrice =
    products.length > 0
      ? products.reduce((s, p) => s + Number(p.unit_price), 0) / products.length
      : 0

  if (loading && !products.length) return <p className="text-slate-400">Loading catalog…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product catalog</h2>
          <p className="mt-1 text-slate-400">Unified catalog used by workers on site</p>
        </div>
        <Link
          to="/upload"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          Upload catalog
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active products" value={String(products.length)} accent="green" />
        <StatCard label="Categories" value={String(byCategory.length)} />
        <StatCard label="Avg unit price" value={formatChf(avgPrice)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Products per category">
          <div className="h-52">
            {byCategory.length === 0 ? (
              <p className="text-slate-500">No products yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    label={({ category, count }) => `${category} (${count})`}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>

        <ChartPanel title="Most ordered (popularity)">
          <div className="h-52">
            {topPopular.length === 0 ? (
              <p className="text-slate-500">Popularity grows as workers order.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPopular} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="popularity_score" name="Orders" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartPanel>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All categories' : c}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-2">Name</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Supplier</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Popularity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td>{p.category}</td>
                    <td className="text-slate-400">{p.sku ?? '—'}</td>
                    <td>{p.suppliers?.name ?? '—'}</td>
                    <td>{p.unit}</td>
                    <td>{formatChf(Number(p.unit_price))}</td>
                    <td>
                      <span className="rounded bg-slate-800 px-2 py-0.5">{p.popularity_score}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
