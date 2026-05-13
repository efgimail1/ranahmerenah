import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workersApi } from '../api/workers'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import { formatRupiah, WORKER_ROLE, RATE_TYPE } from '../utils/format'
import { Plus, Pencil, Trash2, Phone, HardHat } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Role & Rate config ────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'foreman', label: 'Mandor' },
  { value: 'carpenter', label: 'Tukang Kayu' },
  { value: 'helper', label: 'Kenek' },
  { value: 'furniture_maker', label: 'Tukang Meubel' },
  { value: 'bricklayer', label: 'Tukang Batu' },
  { value: 'painter', label: 'Tukang Cat' },
  { value: 'electrician', label: 'Elektrisi' },
  { value: 'plumber', label: 'Tukang Ledeng' },
  { value: 'other', label: 'Lainnya' },
]

const RATE_OPTIONS = [
  { value: 'daily', label: 'Per Hari' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'fixed', label: 'Borongan' },
]

const ROLE_COLOR = {
  foreman: 'amber',
  carpenter: 'blue',
  helper: 'gray',
  furniture_maker: 'green',
  bricklayer: 'gray',
  painter: 'blue',
  electrician: 'amber',
  plumber: 'blue',
  other: 'gray',
}

// ─── Form ──────────────────────────────────────────────────
function WorkerForm({ initial, onSubmit, loading }) {
  const empty = {
    full_name: '', phone: '', role: 'carpenter',
    rate_type: 'daily', rate_amount: '', is_active: true, notes: '',
  }
  const [form, setForm] = useState(initial ? {
    ...initial,
    rate_amount: initial.rate_amount ? String(Math.round(initial.rate_amount)) : '',
  } : empty)

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      rate_amount: parseFloat(String(form.rate_amount).replace(/\D/g, '')) || 0,
      is_active: form.is_active === true || form.is_active === 'true',
    })
  }

  // hint tipe upah berdasarkan role
  const rateHint = {
    daily: 'Dibayar per hari kerja',
    per_unit: 'Dibayar per unit yang dikerjakan (cocok untuk tukang meubel)',
    fixed: 'Dibayar borongan untuk seluruh pekerjaan',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info Tukang */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Info Tukang
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nama Lengkap *"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
            placeholder="contoh: Pak Budi"
            required
          />
          <Input
            label="No. Telepon"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="contoh: 08123456789"
          />
          <Select
            label="Jabatan *"
            value={form.role}
            onChange={e => set('role', e.target.value)}
          >
            {ROLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select
            label="Status"
            value={form.is_active}
            onChange={e => set('is_active', e.target.value === 'true')}
          >
            <option value="true">Aktif</option>
            <option value="false">Tidak Aktif</option>
          </Select>
        </div>
      </div>

      {/* Upah */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Upah
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipe Upah *"
            value={form.rate_type}
            onChange={e => set('rate_type', e.target.value)}
          >
            {RATE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <CurrencyInput
            label={`Nominal Upah (${RATE_TYPE[form.rate_type]})`}
            value={form.rate_amount}
            onChange={val => set('rate_amount', val)}
            placeholder="0"
          />
        </div>
        <p className="text-xs text-gray-400 mt-2 ml-1">
          {rateHint[form.rate_type]}
        </p>
      </div>

      {/* Catatan */}
      <div>
        <Input
          label="Catatan"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="catatan tambahan (opsional)"
        />
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? 'Simpan Perubahan' : 'Simpan Tukang'}
        </Button>
      </div>
    </form>
  )
}

// ─── Worker Card ───────────────────────────────────────────
function WorkerCard({ worker, onEdit, onDelete }) {
  const roleColor = ROLE_COLOR[worker.role] || 'gray'
  const initials = worker.full_name
    .split(' ').slice(0, 2)
    .map(w => w[0]).join('').toUpperCase()

  const avatarColors = {
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    gray: 'bg-gray-100 text-gray-600',
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${avatarColors[roleColor]}`}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{worker.full_name}</span>
            <Badge color={worker.is_active ? 'green' : 'gray'}>
              {worker.is_active ? 'Aktif' : 'Nonaktif'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Badge color={roleColor}>
              {WORKER_ROLE[worker.role] || worker.role}
            </Badge>
            {worker.phone && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Phone size={11} /> {worker.phone}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(worker)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(worker.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Rate */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {RATE_TYPE[worker.rate_type] || worker.rate_type}
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {formatRupiah(worker.rate_amount)}
        </span>
      </div>

      {worker.notes && (
        <p className="text-xs text-gray-400 mt-2 italic">{worker.notes}</p>
      )}
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function Workers() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState(null)
  const [filterActive, setFilterActive] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['workers', filterActive, filterRole],
    queryFn: () => {
      const params = {}
      if (filterActive !== '') params.is_active = filterActive === 'true'
      return workersApi.getAll(params)
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['workers'] })

  const createMutation = useMutation({
    mutationFn: workersApi.create,
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      toast.success('Tukang berhasil ditambahkan!')
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => workersApi.update(id, data),
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      setEditData(null)
      toast.success('Data tukang berhasil diupdate!')
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: workersApi.delete,
    onSuccess: () => {
      invalidate()
      toast.success('Data tukang dihapus.')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = (data) => {
    if (editData) {
      updateMutation.mutate({ id: editData.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (worker) => {
    setEditData(worker)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    if (confirm('Yakin hapus data tukang ini?')) {
      deleteMutation.mutate(id)
    }
  }

  // filter by role di frontend (lebih simpel)
  const filtered = filterRole
    ? workers.filter(w => w.role === filterRole)
    : workers

  // group by role
  const grouped = ROLE_OPTIONS.reduce((acc, role) => {
    const list = filtered.filter(w => w.role === role.value)
    if (list.length > 0) acc[role.value] = { label: role.label, workers: list }
    return acc
  }, {})

  const activeCount = workers.filter(w => w.is_active).length
  const inactiveCount = workers.filter(w => !w.is_active).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Data Tukang</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {workers.length} tukang · {activeCount} aktif · {inactiveCount} nonaktif
          </p>
        </div>
        <Button variant="primary" onClick={() => { setEditData(null); setModalOpen(true) }}>
          <Plus size={16} /> Tambah Tukang
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filter Status */}
        <div className="flex gap-1.5">
          {[
            { label: 'Semua', value: '' },
            { label: 'Aktif', value: 'true' },
            { label: 'Nonaktif', value: 'false' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterActive(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterActive === f.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-200" />

        {/* Filter Jabatan */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterRole('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterRole === ''
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Semua Jabatan
          </button>
          {ROLE_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setFilterRole(r.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterRole === r.value
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HardHat size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">
              Belum ada tukang. Klik "Tambah Tukang" untuk mulai.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([role, group]) => (
            <div key={role}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {group.label} ({group.workers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.workers.map(w => (
                  <WorkerCard
                    key={w.id}
                    worker={w}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null) }}
        title={editData ? 'Edit Data Tukang' : 'Tambah Tukang Baru'}
        size="md"
      >
        <WorkerForm
          key={editData?.id ?? 'new'}
          initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  )
}