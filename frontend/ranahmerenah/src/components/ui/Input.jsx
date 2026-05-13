import clsx from 'clsx'
import { formatCurrencyInput, parseCurrency } from '../../utils/format'

export default function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        className={clsx(
          'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2',
          'focus:ring-emerald-500 focus:border-emerald-500 transition-all',
          error && 'border-red-400 focus:ring-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        className={clsx(
          'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500',
          'focus:border-emerald-500 transition-all bg-white',
          error && 'border-red-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// Input khusus currency — tampil format 10.000.000
export function CurrencyInput({ label, error, value, onChange, className, ...props }) {
  const handleChange = (e) => {
    const raw = parseCurrency(e.target.value)
    onChange(raw) // kirim angka murni ke parent
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={formatCurrencyInput(value)}
          onChange={handleChange}
          className={clsx(
            'w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900',
            'placeholder:text-gray-400 focus:outline-none focus:ring-2',
            'focus:ring-emerald-500 focus:border-emerald-500 transition-all',
            error && 'border-red-400 focus:ring-red-400',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}