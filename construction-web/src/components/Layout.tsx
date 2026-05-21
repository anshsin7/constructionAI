import { Link, Outlet, useLocation } from 'react-router-dom'
import { API_URL } from '../lib/api'

const nav = [
  { to: '/', label: 'Sites' },
  { to: '/orders', label: 'Orders' },
  { to: '/upload', label: 'Catalog upload' }
]

export function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-amber-400">Construction AI</h1>
            <p className="text-xs text-slate-500">Procurement dashboard</p>
          </div>
          <nav className="flex gap-2">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  pathname === to || (to === '/upload' && pathname.startsWith('/upload'))
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
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-8 text-center text-xs text-slate-600">
        API: {API_URL}
      </footer>
    </div>
  )
}
