type StatCardProps = {
  label: string
  value: string
  hint?: string
  accent?: 'amber' | 'green' | 'red' | 'slate'
}

const accentBorder = {
  amber: 'border-amber-500/40',
  green: 'border-emerald-500/40',
  red: 'border-red-500/40',
  slate: 'border-slate-700'
}

export function StatCard({ label, value, hint, accent = 'amber' }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-slate-900 p-5 ${accentBorder[accent]}`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
