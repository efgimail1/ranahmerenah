// Format angka ke Rupiah
export const formatRupiah = (value) => {
  if (!value && value !== 0) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format angka input currency (tampil 10.000.000)
export const formatCurrencyInput = (value) => {
  if (!value) return ''
  const num = String(value).replace(/\D/g, '')
  return new Intl.NumberFormat('id-ID').format(num)
}

// Parse currency input kembali ke angka
export const parseCurrency = (value) => {
  if (!value) return ''
  return String(value).replace(/\D/g, '')
}

// Format tanggal display: 05 May 2026
export const formatDate = (value) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(value))
}

// Konversi date dari backend ke YYYY-MM-DD untuk input — fix timezone
export const toInputDate = (value) => {
  if (!value) return ''
  // backend kirim "2026-05-12" langsung pakai, jangan lewat Date object
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return value
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Status label
export const PROJECT_STATUS = {
  pending: { label: 'Pending', color: 'gray' },
  in_progress: { label: 'Berjalan', color: 'blue' },
  completed: { label: 'Selesai', color: 'green' },
  on_hold: { label: 'Ditahan', color: 'amber' },
  cancelled: { label: 'Batal', color: 'red' },
}

export const PAYMENT_STATUS = {
  unpaid: { label: 'Belum Bayar', color: 'red' },
  partial: { label: 'Sebagian', color: 'amber' },
  paid: { label: 'Lunas', color: 'green' },
}

export const WORKER_ROLE = {
  foreman: 'Mandor',
  carpenter: 'Tukang Kayu',
  helper: 'Kenek',
  furniture_maker: 'Tukang Meubel',
  bricklayer: 'Tukang Batu',
  painter: 'Tukang Cat',
  electrician: 'Elektrisi',
  plumber: 'Tukang Ledeng',
  other: 'Lainnya',
}

export const RATE_TYPE = {
  daily: 'Per Hari',
  per_unit: 'Per Unit',
  fixed: 'Borongan',
}