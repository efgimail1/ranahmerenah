import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workersApi } from '../api/workers'
import { projectsApi } from '../api/projects'
import { ledgerApi } from '../api/ledger'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import { formatRupiah, formatDate, parseCurrency, WORKER_ROLE, RATE_TYPE } from '../utils/format'
import { Plus, HardHat, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

function WageForm({ onSubmit, loading, projects }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [form, setForm] = useState({
    period_start: '', period_end: '',
    payment_date: '', days_worked: '',
    unit_count: '', deduction: '', notes: '',
  })
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  // Load workers assigned to selected project
  const { data: allWorkers=[] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => workersApi.getAll({}),
  })

  const { data: projectAssignments=[] } = useQuery({
    queryKey: ['project-assignments-wages', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return []
      const all = []
      for (const w of allWorkers) {
        const assigns = await workersApi.getAssignments(w.id)
        assigns
          .filter(a => a.project_id === parseInt(selectedProject) && a.is_active)
          .forEach(a => all.push({ ...a, worker: w }))
      }
      return all
    },
    enabled: !!selectedProject && allWorkers.length > 0,
  })

  // Check for duplicate payment in same period
  const { data: existingWages=[] } = useQuery({
    queryKey: ['wages-check', selectedAssignment?.id, form.period_start, form.period_end],
    queryFn: () => workersApi.getAllWages({ project_id: parseInt(selectedProject) }),
    enabled: !!selectedProject,
  })

  const isDuplicate = selectedAssignment && form.period_start && form.period_end &&
    existingWages.some(w =>
      w.assignment_id === selectedAssignment.id &&
      w.period_start === form.period_start &&
      w.period_end === form.period_end
    )

  const rateSnapshot = selectedAssignment?.rate_amount ? parseFloat(selectedAssignment.rate_amount) : 0
  const daysWorked   = parseFloat(form.days_worked) || 0
  const unitCount    = parseFloat(form.unit_count) || 0
  const deduction    = parseFloat(parseCurrency(form.deduction)) || 0

  const calcGross = () => {
    if (!selectedAssignment) return 0
    if (selectedAssignment.rate_type === 'daily')    return rateSnapshot * daysWorked
    if (selectedAssignment.rate_type === 'per_unit') return rateSnapshot * unitCount
    return rateSnapshot
  }

  const gross = calcGross()
  const net   = gross - deduction

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isDuplicate) return toast.error('Duplicate: wage already recorded for this period!')
    if (!selectedAssignment) return toast.error('Please select a worker')
    onSubmit({
      assignment_id: selectedAssignment.id,
      worker_id:     selectedAssignment.worker_id,
      project_id:    parseInt(selectedProject),
      payment_date:  form.payment_date,
      period_start:  form.period_start || null,
      period_end:    form.period_end   || null,
      days_worked:   selectedAssignment.rate_type==='daily'    ? daysWorked  : null,
      unit_count:    selectedAssignment.rate_type==='per_unit' ? unitCount   : null,
      rate_snapshot: rateSnapshot,
      gross_amount:  gross,
      deduction:     deduction,
      net_amount:    net,
      notes:         form.notes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Wage Payment Details</h4>

      {/* Step 1: Select Project */}
      <Select label="Project *" value={selectedProject}
        onChange={e => { setSelectedProject(e.target.value); setSelectedAssignment(null) }}
        required>
        <option value="">-- Select Project --</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
      </Select>

      {/* Step 2: Select Worker from project assignments */}
      {selectedProject && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Worker *</label>
          {projectAssignments.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              No active workers assigned to this project. Assign workers from the Projects page first.
            </div>
          ) : (
            <div className="space-y-2">
              {projectAssignments.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAssignment(a)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedAssignment?.id === a.id
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
                    {a.worker?.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{a.worker?.full_name}</div>
                    <div className="text-xs text-gray-400">{WORKER_ROLE[a.worker?.role]}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatRupiah(a.rate_amount)}</div>
                    <div className="text-xs text-gray-400">{RATE_TYPE[a.rate_type]}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Period & Details */}
      {selectedAssignment && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Period Start" type="date" value={form.period_start}
              onChange={e => set('period_start', e.target.value)} />
            <Input label="Period End" type="date" value={form.period_end}
              onChange={e => set('period_end', e.target.value)} />
            <Input label="Payment Date *" type="date" value={form.payment_date}
              onChange={e => set('payment_date', e.target.value)} required />

            {selectedAssignment.rate_type === 'daily' && (
              <Input label="Working Days" type="text" inputMode="decimal"
                value={form.days_worked}
                onChange={e => set('days_worked', e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))}
                placeholder="e.g. 6" />
            )}
            {selectedAssignment.rate_type === 'per_unit' && (
              <Input label="Unit Count" type="text" inputMode="decimal"
                value={form.unit_count}
                onChange={e => set('unit_count', e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))}
                placeholder="e.g. 3" />
            )}

            <CurrencyInput label="Deduction" value={form.deduction}
              onChange={v => set('deduction', v)} placeholder="0" />
            <Input label="Notes" value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="optional" className="col-span-2" />
          </div>

          {/* Duplicate warning */}
          {isDuplicate && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={14} className="text-red-600 shrink-0" />
              <span className="text-xs text-red-700 font-medium">
                Warning: A wage payment for this worker already exists for the same period. Please check before saving.
              </span>
            </div>
          )}

          {/* Calculation preview */}
          {gross > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {selectedAssignment.rate_type === 'daily'
                    ? `${daysWorked} days × ${formatRupiah(rateSnapshot)}`
                    : selectedAssignment.rate_type === 'per_unit'
                    ? `${unitCount} units × ${formatRupiah(rateSnapshot)}`
                    : 'Lump Sum'}
                </span>
                <span className="font-medium">{formatRupiah(gross)}</span>
              </div>
              {deduction > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Deduction</span>
                  <span className="font-medium text-red-500">- {formatRupiah(deduction)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
                <span className="text-gray-800">Net amount paid</span>
                <span className="text-emerald-700">{formatRupiah(net)}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}
          disabled={!selectedAssignment || gross <= 0 || isDuplicate}>
          Save Wage Payment
        </Button>
      </div>
    </form>
  )
}

export default function Wages() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [filterProject, setFilterProject] = useState('')

  const { data: projects=[] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  })

  const { data: allWorkers=[] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => workersApi.getAll({}),
  })

  const { data: wages=[], isLoading } = useQuery({
    queryKey: ['wages', filterProject],
    queryFn: () => workersApi.getAllWages(filterProject ? { project_id: filterProject } : {}),
  })

  const workerMap  = Object.fromEntries(allWorkers.map(w => [w.id, w]))
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.project_name]))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['wages'] })
    qc.invalidateQueries({ queryKey: ['ledger'] })
    qc.invalidateQueries({ queryKey: ['ledger-summary'] })
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const wage = await workersApi.createWage(data)
      const worker = workerMap[data.worker_id]
      await ledgerApi.createExpense({
        entry_date:        data.payment_date,
        entry_type:        'expense',
        description:       `Wage payment — ${worker?.full_name || 'Worker'}`,
        paid_to:           worker?.full_name || '',
        gross_expense:     data.gross_amount,
        discount_received: 0,
        payment_method:    'cash',
        project_id:        data.project_id || null,
        wage_payment_id:   wage.id,
        notes:             data.notes || '',
      })
      return wage
    },
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      toast.success('Wage payment saved & recorded in ledger!')
    },
    onError: (e) => toast.error(e.message),
  })

  const totalGross = wages.reduce((s,w) => s + parseFloat(w.gross_amount||0), 0)
  const totalNet   = wages.reduce((s,w) => s + parseFloat(w.net_amount||0),   0)
  const totalDays  = wages.filter(w => {
    const worker = workerMap[w.worker_id]
    return worker && w.days_worked
  }).reduce((s,w) => s + parseFloat(w.days_worked||0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Wage Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {wages.length} transactions · automatically recorded in ledger
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Pay Wages
        </Button>
      </div>

      {/* Summary */}
      {wages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Gross Wages</p>
            <p className="text-lg font-semibold text-gray-900">{formatRupiah(totalGross)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Net Paid</p>
            <p className="text-lg font-semibold text-gray-900">{formatRupiah(totalNet)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Working Days</p>
            <p className="text-lg font-semibold text-gray-900">{totalDays} days</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48">
        <option value="">All Projects</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
      </select>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : wages.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HardHat size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No wage payments yet.</p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Details</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Gross</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Deduction</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {wages.map(wage => {
                const worker = workerMap[wage.worker_id]
                return (
                  <tr key={wage.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(wage.payment_date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{worker?.full_name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge color="gray">{WORKER_ROLE[worker?.role] || '-'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {wage.project_id ? projectMap[wage.project_id] : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {wage.period_start && wage.period_end
                        ? `${formatDate(wage.period_start)} – ${formatDate(wage.period_end)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {wage.days_worked
                        ? `${parseFloat(wage.days_worked)} days × ${formatRupiah(wage.rate_snapshot)}`
                        : wage.unit_count
                        ? `${parseFloat(wage.unit_count)} units × ${formatRupiah(wage.rate_snapshot)}`
                        : `Lump Sum ${formatRupiah(wage.rate_snapshot)}`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatRupiah(wage.gross_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {parseFloat(wage.deduction||0) > 0
                        ? <span className="text-red-500">- {formatRupiah(wage.deduction)}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatRupiah(wage.net_amount)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total ({wages.length} transactions)
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-700">{formatRupiah(totalGross)}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-500">
                  - {formatRupiah(totalGross - totalNet)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatRupiah(totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title="Pay Worker Wages" size="md">
        <WageForm key={modalOpen}
          onSubmit={d => createMutation.mutate(d)}
          loading={createMutation.isPending}
          projects={projects} />
      </Modal>
    </div>
  )
}