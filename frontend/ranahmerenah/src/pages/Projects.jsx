import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '../api/projects'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import {
  formatRupiah, formatDate, toInputDate,
  PROJECT_STATUS, parseCurrency
} from '../utils/format'
import {
  Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, CheckCircle, Clock, Circle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Helper: parse initial data dari backend ke form ───────
function parseInitial(project) {
  if (!project) return null
  return {
    client_name: project.client_name || '',
    client_phone: project.client_phone || '',
    project_name: project.project_name || '',
    location: project.location || '',
    received_date: toInputDate(project.received_date),
    start_date: toInputDate(project.start_date),
    end_date: toInputDate(project.end_date),
    rab_value: project.rab_value ? String(Math.round(project.rab_value)) : '',
    architect_fee: project.architect_fee ? String(Math.round(project.architect_fee)) : '',
    status: project.status || 'pending',
    notes: project.notes || '',
  }
}

function parseInitialPayments(project) {
  if (!project?.payments?.length) return []
  return project.payments.map(p => ({
    id: p.id,
    term_type: p.term_type || 'dp',
    term_label: p.term_label || '',
    percentage: p.percentage ? String(p.percentage) : '',
    amount: p.amount ? String(Math.round(p.amount)) : '',
    due_date: toInputDate(p.due_date),
    notes: p.notes || '',
  }))
}

// ─── Form Component ────────────────────────────────────────
function ProjectForm({ initial, onSubmit, loading }) {
  const emptyForm = {
    client_name: '', client_phone: '', project_name: '',
    location: '', received_date: '', start_date: '', end_date: '',
    rab_value: '', architect_fee: '', status: 'pending', notes: '',
  }

  const [form, setForm] = useState(parseInitial(initial) || emptyForm)
  const [payments, setPayments] = useState(parseInitialPayments(initial))
  const [deletedPaymentIds, setDeletedPaymentIds] = useState([])

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const addPayment = () => {
    setPayments(p => [...p, {
      term_type: 'dp', term_label: '',
      percentage: '', amount: '', due_date: '', notes: ''
    }])
  }

  const setPayment = (i, field, val) => {
    setPayments(p => p.map((item, idx) =>
      idx === i ? { ...item, [field]: val } : item
    ))
  }

  const removePayment = (i) => {
  const pay = payments[i]
  if (pay.id) {
    setDeletedPaymentIds(prev => [...prev, pay.id])
  }
  setPayments(p => p.filter((_, idx) => idx !== i))
}

  // auto hitung amount dari percentage x architect_fee
  const handlePercentageChange = (i, pct) => {
    setPayment(i, 'percentage', pct)
    const fee = parseFloat(parseCurrency(form.architect_fee)) || 0
    if (fee > 0 && pct) {
      const amount = Math.round((parseFloat(pct) || 0) / 100 * fee)
      setPayment(i, 'amount', String(amount))
    }
  }

  const handleSubmit = (e) => {
  e.preventDefault()
  onSubmit({
    ...form,
    rab_value: parseFloat(parseCurrency(form.rab_value)) || 0,
    architect_fee: parseFloat(parseCurrency(form.architect_fee)) || 0,
    deletedPaymentIds,
    payments: payments.map(p => ({
      ...p,
      percentage: p.percentage ? parseFloat(p.percentage) : null,
      amount: p.amount ? parseFloat(parseCurrency(p.amount)) : null,
      due_date: p.due_date || null,
      notes: p.notes || null,
    }))
  })
}

  const termTypeOptions = [
    { value: 'dp', label: 'DP' },
    { value: 'termin', label: 'Termin' },
    { value: 'final', label: 'Final' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client & Project Info */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Client & Project Info
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Client Name *"
            value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
            placeholder="contoh: Pak Budi Santoso"
            required
          />
          <Input
            label="Phone Number"
            value={form.client_phone}
            onChange={e => set('client_phone', e.target.value)}
            placeholder="contoh: 08123456789"
          />
          <Input
            label="Project Name *"
            value={form.project_name}
            onChange={e => set('project_name', e.target.value)}
            placeholder="contoh: Villa 2 Lantai"
            className="col-span-2"
            required
          />
          <Input
            label="Location"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="contoh: Bandung, Jawa Barat"
            className="col-span-2"
          />
        </div>
      </div>

      {/* Tanggal */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Received Date
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Received Date *"
            type="date"
            value={form.received_date}
            onChange={e => set('received_date', e.target.value)}
            required
          />
          <Input
            label="Start Date"
            type="date"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
          />
        </div>
      </div>

      {/* Value & Status */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Value & Status
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <CurrencyInput
            label="RAB Value"
            value={form.rab_value}
            onChange={val => set('rab_value', val)}
            placeholder="0"
          />
          <CurrencyInput
            label="Architect Fee"
            value={form.architect_fee}
            onChange={val => set('architect_fee', val)}
            placeholder="0"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={e => set('status', e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <div className="mt-3">
          <Input
            label="Notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="additional notes (optional)"
          />
        </div>
      </div>

      {/* Termin Pembayaran */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Payment Terms
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={addPayment}>
            <Plus size={14} /> Add Term
          </Button>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
            There are no terms yet. Click "Add Term" to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {payments.map((pay, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Termin {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removePayment(i)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    label="Type"
                    value={pay.term_type}
                    onChange={e => setPayment(i, 'term_type', e.target.value)}
                  >
                    {termTypeOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  <Input
                    label="Label (e.g. Down Payment)"
                    value={pay.term_label}
                    onChange={e => setPayment(i, 'term_label', e.target.value)}
                    placeholder="contoh: DP, Termin 1"
                  />
                  <Input
                    label="Percentage  (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={pay.percentage}
                    onChange={e => handlePercentageChange(i, e.target.value)}
                    placeholder="contoh: 30"
                  />
                  <CurrencyInput
                    label="Amount"
                    value={pay.amount}
                    onChange={val => setPayment(i, 'amount', val)}
                    placeholder="0"
                  />
                  <Input
                    label="Due Date"
                    type="date"
                    value={pay.due_date}
                    onChange={e => setPayment(i, 'due_date', e.target.value)}
                  />
                  <Input
                    label="Notes"
                    value={pay.notes}
                    onChange={e => setPayment(i, 'notes', e.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? 'Save Changes' : 'Save Project'}
        </Button>
      </div>
    </form>
  )
}

// ─── Payment Status Icon ───────────────────────────────────
function PaymentStatusIcon({ status }) {
  if (status === 'paid') return <CheckCircle size={14} className="text-emerald-500" />
  if (status === 'partial') return <Clock size={14} className="text-amber-500" />
  return <Circle size={14} className="text-gray-300" />
}

// ─── Main Page ─────────────────────────────────────────────
export default function Projects() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editData, setEditData] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', filterStatus],
    queryFn: () => projectsApi.getAll(filterStatus ? { status: filterStatus } : {}),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { payments, ...projectData } = data
      // 1. buat proyek dulu
      const project = await projectsApi.create({ ...projectData, payments: [] })
      // 2. buat setiap termin satu per satu
      for (const p of payments) {
        await projectsApi.addPayment(project.id, p)
      }
      return project
    },
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      toast.success('Proyek berhasil ditambahkan!')
    },
    onError: (err) => toast.error(err.message),
  })

  const updateMutation = useMutation({
  mutationFn: async ({ id, data, deletedPaymentIds }) => {
    const { payments, ...projectData } = data

    // 1. update data proyek
    await projectsApi.update(id, projectData)

    // 2. hapus payment yang dihapus user
    for (const pid of deletedPaymentIds) {
      await projectsApi.deletePayment(pid)
    }

    // 3. update atau tambah payment
    for (const p of payments) {
      if (p.id) {
        const { id: pid, ...rest } = p
        await projectsApi.updatePayment(pid, rest)
      } else {
        await projectsApi.addPayment(id, p)
      }
    }
  },
  onSuccess: () => {
    invalidate()
    setModalOpen(false)
    setEditData(null)
    toast.success('Proyek berhasil diupdate!')
  },
  onError: (err) => toast.error(err.message),
})

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      invalidate()
      toast.success('Proyek dihapus.')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = (data) => {
  if (editData) {
    updateMutation.mutate({
      id: editData.id,
      data,
      deletedPaymentIds: data.deletedPaymentIds || [],
    })
  } else {
    createMutation.mutate(data)
  }
}

  const handleEdit = async (project) => {
    // fetch data terbaru supaya payments selalu up to date
    const fresh = await projectsApi.getById(project.id)
    setEditData(fresh)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    if (confirm('Yakin hapus proyek ini? Semua data pembayaran ikut terhapus.')) {
      deleteMutation.mutate(id)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const filters = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
    { label: 'On Hold', value: 'on_hold' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} projects found</p>
        </div>
        <Button variant="primary" onClick={() => { setEditData(null); setModalOpen(true) }}>
          <Plus size={16} /> Add Project
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === f.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No projects yet. Click "Add Project" to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map(p => {
            const st = PROJECT_STATUS[p.status] || {}
            const isExpanded = expandedId === p.id
            return (
              <Card key={p.id} padding={false}>
                {/* Header Row */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{p.project_name}</span>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.client_name}
                      {p.location ? ` · ${p.location}` : ''}
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-400">Architect Fee</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatRupiah(p.architect_fee)}
                    </div>
                  </div>

                  <div className="w-32 hidden md:block">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Progress</span>
                      <span className="text-xs font-medium text-emerald-600">
                        {p.progress_percent}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${p.progress_percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-400">Collected</div>
                    <div className="text-sm font-medium text-emerald-700">
                      {formatRupiah(p.total_paid)}
                    </div>
                    <div className="text-xs text-red-400">
                      Outstanding: {formatRupiah(p.total_outstanding)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded — Termin */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Payment Terms
                      </span>
                      <div className="text-xs text-gray-400">
                        RAB: {formatRupiah(p.rab_value)}
                      </div>
                    </div>

                    {!p.payments?.length ? (
                      <p className="text-xs text-gray-400 italic">
                        No payment terms found.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {p.payments.map((pay, i) => {
                          const ps = pay.status || 'unpaid'
                          const rowColor = {
                            paid: 'bg-emerald-50 border-emerald-200',
                            partial: 'bg-amber-50 border-amber-200',
                            unpaid: 'bg-white border-gray-200',
                          }
                          return (
                            <div key={pay.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${rowColor[ps]}`}
                            >
                              <PaymentStatusIcon status={ps} />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-800">
                                  {pay.term_label || `Term ${i + 1}`}
                                </span>
                                {pay.due_date && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    · Due Date: {formatDate(pay.due_date)}
                                  </span>
                                )}
                              </div>
                              {pay.percentage && (
                                <span className="text-xs text-gray-400">
                                  {pay.percentage}%
                                </span>
                              )}
                              <span className="text-sm font-semibold text-gray-900">
                                {formatRupiah(pay.amount)}
                              </span>
                              <Badge color={
                                ps === 'paid' ? 'green'
                                : ps === 'partial' ? 'amber'
                                : 'gray'
                              }>
                                {ps === 'paid' ? 'Paid'
                                  : ps === 'partial' ? 'Partial'
                                  : 'Unpaid'}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null) }}
        title={editData ? 'Edit Project' : 'Add New Project'}
        size="lg"
      >
        <ProjectForm
          key={editData?.id ?? 'new'}
          initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  )
}