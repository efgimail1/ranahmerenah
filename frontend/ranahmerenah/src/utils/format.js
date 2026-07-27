export const formatRupiah = (value) => {
  if (!value && value !== 0) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

export const formatCurrencyInput = (value) => {
  if (!value) return ''
  const num = String(value).replace(/\D/g, '')
  return new Intl.NumberFormat('id-ID').format(num)
}

export const parseCurrency = (value) => {
  if (!value) return ''
  return String(value).replace(/\D/g, '')
}

export const formatDate = (value) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(value))
}

export const toInputDate = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) return value
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const PROJECT_STATUS = {
  pending:     { label: 'Pending',      color: 'gray'  },
  in_progress: { label: 'In Progress',  color: 'blue'  },
  completed:   { label: 'Completed',    color: 'green' },
  on_hold:     { label: 'On Hold',      color: 'amber' },
  cancelled:   { label: 'Cancelled',    color: 'red'   },
}

export const PAYMENT_STATUS = {
  unpaid:  { label: 'Unpaid',   color: 'red'   },
  partial: { label: 'Partial',  color: 'amber' },
  paid:    { label: 'Paid',     color: 'green' },
}

export const WORKER_ROLE = {
  foreman:            'Mandor',
  sub_foreman:        'Wakil Mandor',
  carpenter:          'Tukang Kayu',
  bricklayer:         'Tukang Batu',
  bricklayer_general: 'Tukang Bangunan',
  helper:             'Kenek',
  furniture_maker:    'Tukang Meubel',
  painter:            'Tukang Cat',
  blacksmith:         'Tukang Las',
  electrician:        'Elektrisi',
  plumber:            'Tukang Ledeng',
  other:              'Lainnya',
}

export const RATE_TYPE = {
  daily:    'Harian (full)',
  per_unit: 'Per Unit / Borongan',
  fixed:    'Fixed / Lump Sum',
}

export const BANK_OPTIONS = ['BCA', 'Blu', 'Jago']

export const toWhatsappLink = (phone) => {
  if (!phone) return null
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  else if (!digits.startsWith('62')) digits = '62' + digits
  return `https://wa.me/${digits}`
}