import { Link, Outlet, useLocation } from 'react-router-dom'
import { API_URL } from '../lib/api'

const nav = [
  { to: '/', label: 'Dashboard', match: (p: string) => p === '/' },
  { to: '/insights', label: 'Insights', match: (p: string) => p === '/insights' },
  { to: '/catalog', label: 'Catalog', match: (p: string) => p.startsWith('/catalog') },
  { to: '/orders', label: 'Orders', match: (p: string) => p === '/orders' },
  { to: '/upload', label: 'Upload', match: (p: string) => p.startsWith('/upload') }
]

export function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-amber-400">C-Flow</h1>
            <p className="text-xs text-slate-500">Procurement & sourcing</p>
          </div>
          <nav className="flex gap-2">
            {nav.map(({ to, label, match }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  match(pathname)
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-8 text-center text-xs text-slate-600">
        API: {API_URL}
      </footer>
    </div>
  )
}
