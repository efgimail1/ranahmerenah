import clsx from 'clsx'

export default function Card({ children, className, padding = true }) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-gray-200',
      padding && 'p-5',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}