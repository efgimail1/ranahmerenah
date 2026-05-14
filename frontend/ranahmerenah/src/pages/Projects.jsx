import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '../api/projects'
import { workersApi } from '../api/workers'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import {
  formatRupiah, formatDate, toInputDate,
  parseCurrency, PROJECT_STATUS, WORKER_ROLE, RATE_TYPE
} from '../utils/format'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  CheckCircle, Clock, Circle, X, HardHat, CreditCard, Info
} from 'lucide-react'
import toast from 'react-hot-toast'


const RATE_OPTIONS = [
  { value: 'daily',    label: 'Per Day' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'fixed',    label: 'Fixed / Lump Sum' },
]

// ─── Parse helpers ─────────────────────────────────────────
function parseInitialHeader(p) {
  if (!p) return null
  return {
    client_name:    p.client_name    || '',
    client_phone:   p.client_phone   || '',
    project_name:   p.project_name   || '',
    location:       p.location       || '',
    received_date:  toInputDate(p.received_date),
    start_date:     toInputDate(p.start_date),
    end_date:       toInputDate(p.end_date),
    rab_value:      p.rab_value      ? String(Math.round(p.rab_value))      : '',
    architect_fee:  p.architect_fee  ? String(Math.round(p.architect_fee))  : '',
    status:         p.status         || 'pending',
    notes:          p.notes          || '',
  }
}

function parseInitialPayments(p) {
  if (!p?.payments?.length) return []
  return p.payments.map(pay => ({
    id:         pay.id,
    term_type:  pay.term_type  || 'dp',
    term_label: pay.term_label || '',
    percentage: pay.percentage ? String(pay.percentage) : '',
    amount:     pay.amount     ? String(Math.round(pay.amount)) : '',
    due_date:   toInputDate(pay.due_date),
    status:     pay.status     || 'unpaid',
    notes:      pay.notes      || '',
  }))
}

// ─── Tab: Project Info ──────────────────────────────────────
function TabInfo({ form, setForm }) {
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))
  
  return (
    <div className="space-y-5 pt-4">
      {/* Client & Project */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Client & Project
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Client Name *" value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
            placeholder="e.g. Mr. Budi Santoso" required />
          <Input label="Phone Number" value={form.client_phone}
            onChange={e => set('client_phone', e.target.value)}
            placeholder="e.g. 08123456789" />
          <Input label="Project Name *" value={form.project_name}
            onChange={e => set('project_name', e.target.value)}
            placeholder="e.g. 2-Story Villa" className="col-span-2" required />
          <Input label="Location" value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="e.g. Bandung, West Java" className="col-span-2" />
        </div>
      </div>

      {/* Dates */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Dates
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Received Date *" type="date"
            value={form.received_date}
            onChange={e => set('received_date', e.target.value)} required />
          <Input label="Start Date" type="date"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)} />
          <Input label="Target Completion" type="date"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>

      {/* Value & Status */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Value & Status
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <CurrencyInput label="RAB Value" value={form.rab_value}
            onChange={v => set('rab_value', v)} placeholder="0" />
          <CurrencyInput label="Architect Fee" value={form.architect_fee}
            onChange={v => set('architect_fee', v)} placeholder="0" />
          <Select label="Status" value={form.status}
            onChange={e => set('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Input label="Notes" value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="additional notes (optional)" className="col-span-3" />
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Payment Terms ────────────────────────────────────
function TabPayments({ payments, setPayments, architectFee, setDeletedPaymentIds }) {
  const addPayment = () => setPayments(p => [...p, {
    term_type: 'dp', term_label: '', percentage: '',
    amount: '', due_date: '', status: 'unpaid', notes: ''
  }])

  const set = (i, f, v) => setPayments(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it))

  const remove = (i) => {
    const pay = payments[i]
    if (pay.id) setDeletedPaymentIds(prev => [...prev, pay.id])
    setPayments(p => p.filter((_, idx) => idx !== i))
  }

  const handlePct = (i, pct) => {
    set(i, 'percentage', pct)
    const fee = parseFloat(parseCurrency(architectFee)) || 0
    if (fee > 0 && pct) {
      const amount = Math.round((parseFloat(pct) || 0) / 100 * fee)
      set(i, 'amount', String(amount))
    }
  }

  const statusIcon = (s) => {
    if (s === 'paid')    return <CheckCircle size={14} className="text-emerald-500" />
    if (s === 'partial') return <Clock size={14} className="text-amber-500" />
    return <Circle size={14} className="text-gray-300" />
  }

  const statusColor = { paid: 'green', partial: 'amber', unpaid: 'gray' }
  const totalPct = payments.reduce((s, p) => s + (parseFloat(p.percentage) || 0), 0)
  const totalAmt = payments.reduce((s, p) => s + (parseFloat(parseCurrency(p.amount)) || 0), 0)

  return (
    <div className="pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Payment Terms
          </h4>
          {payments.length > 0 && (
            <span className={`text-xs font-medium ${totalPct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {totalPct}% allocated
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addPayment}>
          <Plus size={14} /> Add Term
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
          <CreditCard size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No payment terms yet. Click "Add Term" to add.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((pay, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(pay.status || 'unpaid')}
                  <span className="text-xs font-semibold text-gray-500">Term {i + 1}</span>
                  {pay.status && (
                    <Badge color={statusColor[pay.status] || 'gray'}>
                      {pay.status === 'paid' ? 'Paid' : pay.status === 'partial' ? 'Partial' : 'Unpaid'}
                    </Badge>
                  )}
                </div>
                <button type="button" onClick={() => remove(i)}
                  className="text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Select label="Type" value={pay.term_type}
                  onChange={e => set(i, 'term_type', e.target.value)}>
                  <option value="dp">Down Payment</option>
                  <option value="termin">Progress Payment</option>
                  <option value="final">Final Payment</option>
                </Select>
                <Input label="Label" value={pay.term_label}
                  onChange={e => set(i, 'term_label', e.target.value)}
                  placeholder="e.g. DP, Term 1" />
                <Select label="Status" value={pay.status || 'unpaid'}
                  onChange={e => set(i, 'status', e.target.value)}>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </Select>
                <Input label="Percentage (%)" type="number" min="0" max="100"
                  value={pay.percentage}
                  onChange={e => handlePct(i, e.target.value)}
                  placeholder="e.g. 30" />
                <CurrencyInput label="Amount" value={pay.amount}
                  onChange={v => set(i, 'amount', v)} placeholder="0" />
                <Input label="Due Date" type="date" value={pay.due_date}
                  onChange={e => set(i, 'due_date', e.target.value)} />
                <Input label="Notes" value={pay.notes}
                  onChange={e => set(i, 'notes', e.target.value)}
                  placeholder="optional" className="col-span-3" />
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="flex justify-end gap-6 p-3 bg-white border border-gray-200 rounded-lg text-sm">
            <div className="text-right">
              <div className="text-xs text-gray-400">Total Allocated</div>
              <div className={`font-semibold ${totalPct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {totalPct}%
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-6">
              <div className="text-xs text-gray-400">Total Amount</div>
              <div className="font-semibold text-gray-900">{formatRupiah(totalAmt)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Workers ──────────────────────────────────────────
function TabWorkers({ projectId, projectName }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen]   = useState(false)
  const [form, setForm]         = useState({
    worker_id: '', rate_type: 'daily', rate_amount: '',
    start_date: '', end_date: '', notes: ''
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => workersApi.getAll({}),
  })

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['project-assignments', projectId],
    queryFn: async () => {
      const all = []
      for (const w of workers) {
        const assigns = await workersApi.getAssignments(w.id)
        assigns.filter(a => a.project_id === projectId)
          .forEach(a => all.push({ ...a, worker: w }))
      }
      return all
    },
    enabled: !!projectId && workers.length > 0,
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleWorkerChange = (wid) => {
    set('worker_id', wid)
    const found = workers.find(w => w.id === parseInt(wid))
    if (found?.rate_amount) set('rate_amount', String(Math.round(parseFloat(found.rate_amount))))
    if (found?.rate_type)   set('rate_type', found.rate_type)
  }

  const createAssignment = useMutation({
    mutationFn: (data) => workersApi.createAssignment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] })
      setAddOpen(false)
      setForm({ worker_id:'', rate_type:'daily', rate_amount:'', start_date:'', end_date:'', notes:'' })
      toast.success('Worker assigned to project!')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteAssignment = useMutation({
    mutationFn: (id) => workersApi.deleteAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] })
      toast.success('Worker removed from project.')
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createAssignment.mutate({
      worker_id:   parseInt(form.worker_id),
      project_id:  projectId,
      rate_type:   form.rate_type,
      rate_amount: parseFloat(parseCurrency(form.rate_amount)) || 0,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
      notes:       form.notes      || null,
      is_active:   true,
    })
  }

  if (!projectId) return (
    <div className="pt-4 text-center py-8 text-gray-400 text-sm">
      Save project first to assign workers.
    </div>
  )

  return (
    <div className="pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Assigned Workers ({assignments.length})
        </h4>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Assign Worker
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
          <HardHat size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No workers assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
                {a.worker?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{a.worker?.full_name}</div>
                <div className="text-xs text-gray-400 flex gap-2">
                  <span>{WORKER_ROLE[a.worker?.role]}</span>
                  <span>·</span>
                  <span>{RATE_TYPE[a.rate_type]}</span>
                  {a.start_date && <span>· From {formatDate(a.start_date)}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{formatRupiah(a.rate_amount)}</div>
                <Badge color={a.is_active ? 'green' : 'gray'}>
                  {a.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Remove this worker from project?'))
                    deleteAssignment.mutate(a.id)
                }}
                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Worker Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Assign Worker to {projectName}</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Select label="Worker *" value={form.worker_id}
                onChange={e => handleWorkerChange(e.target.value)} required>
                <option value="">-- Select Worker --</option>
                {workers.filter(w => w.is_active).map(w => (
                  <option key={w.id} value={w.id}>
                    {w.full_name} — {WORKER_ROLE[w.role]}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Wage Type *" value={form.rate_type}
                  onChange={e => set('rate_type', e.target.value)}>
                  {RATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <CurrencyInput label="Rate Amount *" value={form.rate_amount}
                  onChange={v => set('rate_amount', v)} placeholder="0" />
                <Input label="Start Date" type="date" value={form.start_date}
                  onChange={e => set('start_date', e.target.value)} />
                <Input label="End Date" type="date" value={form.end_date}
                  onChange={e => set('end_date', e.target.value)} />
              </div>
              <Input label="Notes" value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="optional" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={createAssignment.isPending}>
                  Assign Worker
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Project Form — Tabbed ─────────────────────────────────
function ProjectForm({ initial, onSubmit, loading }) {
  const [activeTab, setActiveTab] = useState('info')
  const [form, setForm] = useState(parseInitialHeader(initial) || {
    client_name:'', client_phone:'', project_name:'', location:'',
    received_date:'', start_date:'', end_date:'',
    rab_value:'', architect_fee:'', status:'pending', notes:''
  })
  const [payments, setPayments] = useState(parseInitialPayments(initial))
  const [deletedPaymentIds, setDeletedPaymentIds] = useState([])

  const tabs = [
    { id: 'info',     label: 'Project Info',    icon: Info },
    { id: 'payments', label: 'Payment Terms',   icon: CreditCard },
    { id: 'workers',  label: 'Workers',         icon: HardHat },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      rab_value:      parseFloat(parseCurrency(form.rab_value))      || 0,
      architect_fee:  parseFloat(parseCurrency(form.architect_fee))  || 0,
      deletedPaymentIds,
      payments: payments.map(p => ({
        ...p,
        percentage: p.percentage ? parseFloat(p.percentage) : null,
        amount:     p.amount ? parseFloat(parseCurrency(p.amount)) : null,
        due_date:   p.due_date || null,
        notes:      p.notes    || null,
      }))
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-0">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 -mx-6 px-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
            {tab.id === 'payments' && payments.length > 0 && (
              <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <TabInfo form={form} setForm={setForm} />
      )}
      {activeTab === 'payments' && (
        <TabPayments
          payments={payments}
          setPayments={setPayments}
          architectFee={form.architect_fee}
          deletedPaymentIds={deletedPaymentIds}
          setDeletedPaymentIds={setDeletedPaymentIds}
        />
      )}
      {activeTab === 'workers' && (
        <TabWorkers
          projectId={initial?.id}
          projectName={form.project_name || initial?.project_name}
        />
      )}

      {/* Submit — only info & payments tabs */}
      {activeTab !== 'workers' && (
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
          <Button type="submit" variant="primary" loading={loading}>
            {initial ? 'Save Changes' : 'Save Project'}
          </Button>
        </div>
      )}
    </form>
  )
}

// ─── Payment Status Icon ───────────────────────────────────
function PaymentStatusIcon({ status }) {
  if (status === 'paid')    return <CheckCircle size={14} className="text-emerald-500" />
  if (status === 'partial') return <Clock size={14} className="text-amber-500" />
  return <Circle size={14} className="text-gray-300" />
}

// ─── Main Page ─────────────────────────────────────────────
export default function Projects() {
  const qc = useQueryClient()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editData,     setEditData]     = useState(null)
  const [expandedId,   setExpandedId]   = useState(null)
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
      const project = await projectsApi.create({ ...projectData, payments: [] })
      for (const p of payments) await projectsApi.addPayment(project.id, p)
      return project
    },
    onSuccess: () => { invalidate(); setModalOpen(false); toast.success('Project created!') },
    onError:   (e) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { payments, deletedPaymentIds, ...projectData } = data
      await projectsApi.update(id, projectData)
      for (const pid of (deletedPaymentIds || [])) await projectsApi.deletePayment(pid)
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
      invalidate(); setModalOpen(false); setEditData(null)
      toast.success('Project updated!')
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => { invalidate(); toast.success('Project deleted.') },
    onError:   (e) => toast.error(e.message),
  })

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data })
    else createMutation.mutate(data)
  }

  const handleEdit = async (project) => {
    const fresh = await projectsApi.getById(project.id)
    setEditData(fresh)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this project? All payment data will also be deleted.'))
      deleteMutation.mutate(id)
  }

  const filters = [
    { label: 'All',         value: '' },
    { label: 'Pending',     value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed',   value: 'completed' },
    { label: 'On Hold',     value: 'on_hold' },
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button key={f.value} onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === f.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
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
            const st  = PROJECT_STATUS[p.status] || {}
            const isExp = expandedId === p.id
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {/* Row */}
                <div className="flex items-stretch divide-x divide-gray-100">
                  {/* Project Name */}
                  <div className="flex flex-col justify-center px-5 py-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{p.project_name}</span>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.client_name}{p.location ? ` · ${p.location}` : ''}
                    </div>
                  </div>

                  {/* Architect Fee */}
                  <div className="flex flex-col justify-center px-4 py-4 min-w-32.5">
                    <div className="text-xs text-gray-400 mb-0.5">Architect Fee</div>
                    <div className="text-sm font-semibold text-gray-900">{formatRupiah(p.architect_fee)}</div>
                  </div>

                  {/* Progress */}
                  <div className="flex flex-col justify-center px-4 py-4 w-36">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="font-medium text-emerald-600">{p.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${p.progress_percent}%` }} />
                    </div>
                  </div>

                  {/* Collected */}
                  <div className="flex flex-col justify-center px-4 py-4 min-w-32.5 text-right">
                    <div className="text-xs text-gray-400 mb-0.5">Collected</div>
                    <div className="text-sm font-medium text-emerald-700">{formatRupiah(p.total_paid)}</div>
                    <div className="text-xs text-red-400">Outstanding: {formatRupiah(p.total_outstanding)}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 px-3">
                    <button onClick={() => handleEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={15} />
                    </button>
                    <button onClick={() => setExpandedId(isExp ? null : p.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                      {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Expanded — Payment Terms */}
                {isExp && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Payment Terms
                      </span>
                      <span className="text-xs text-gray-400">RAB: {formatRupiah(p.rab_value)}</span>
                    </div>
                    {!p.payments?.length ? (
                      <p className="text-xs text-gray-400 italic">No payment terms configured.</p>
                    ) : (
                      <div className="space-y-2">
                        {p.payments.map((pay, i) => {
                          const ps = pay.status || 'unpaid'
                          const rowColor = {
                            paid:'bg-emerald-50 border-emerald-200',
                            partial:'bg-amber-50 border-amber-200',
                            unpaid:'bg-white border-gray-200'
                          }
                          return (
                            <div key={pay.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${rowColor[ps]}`}>
                              <PaymentStatusIcon status={ps} />
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-800">
                                  {pay.term_label || `Term ${i + 1}`}
                                </span>
                                {pay.due_date && (
                                  <span className="text-xs text-gray-400 ml-2">
                                    · Due: {formatDate(pay.due_date)}
                                  </span>
                                )}
                              </div>
                              {pay.percentage && (
                                <span className="text-xs text-gray-400">{pay.percentage}%</span>
                              )}
                              <span className="text-sm font-semibold text-gray-900">
                                {formatRupiah(pay.amount)}
                              </span>
                              <Badge color={ps==='paid'?'green':ps==='partial'?'amber':'gray'}>
                                {ps==='paid'?'Paid':ps==='partial'?'Partial':'Unpaid'}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
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