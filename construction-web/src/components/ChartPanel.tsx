import type { ReactNode } from 'react'

export function ChartPanel({
  title,
  subtitle,
  children,
  className = ''
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900 p-6 ${className}`}
    >
      <h3 className="font-semibold text-slate-100">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
