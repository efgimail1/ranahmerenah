import clsx from 'clsx'

export default function StatCard({ label, value, sub, icon: Icon, color = 'gray' }) {
  const colors = {
    green: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    gray: 'text-gray-600 bg-gray-100',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        {Icon && (
          <div className={clsx('p-2 rounded-lg', colors[color])}>
            <Icon size={18} />
          </div>
        )}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}