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
import { Plus, HardHat } from 'lucide-react'
import toast from 'react-hot-toast'

function WageForm({ onSubmit, loading, workers, projects }) {
  const [form, setForm] = useState({
    worker_id: '',
    project_id: '',
    payment_date: '',
    days_worked: '',
    unit_count: '',
    rate_snapshot: '',
    gross_amount: '',
    deduction: '',
    net_amount: '',
    notes: '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const selectedWorker = workers.find(w => w.id === parseInt(form.worker_id))

  // auto isi rate saat pilih tukang
  const handleWorkerChange = (workerId) => {
    set('worker_id', workerId)
    const worker = workers.find(w => w.id === parseInt(workerId))
    if (worker) {
      set('rate_snapshot', String(Math.round(parseFloat(worker.rate_amount))))
    }
  }

  // auto hitung gross & net
  const rateSnapshot = parseFloat(parseCurrency(form.rate_snapshot)) || 0
  const daysWorked   = parseFloat(form.days_worked) || 0
  const unitCount    = parseFloat(form.unit_count) || 0
  const deduction    = parseFloat(parseCurrency(form.deduction)) || 0

  const calcGross = () => {
    if (!selectedWorker) return 0
    if (selectedWorker.rate_type === 'daily')    return rateSnapshot * daysWorked
    if (selectedWorker.rate_type === 'per_unit') return rateSnapshot * unitCount
    return rateSnapshot // fixed/borongan
  }

  const gross  = calcGross()
  const net    = gross - deduction

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      worker_id:    parseInt(form.worker_id),
      project_id:   form.project_id ? parseInt(form.project_id) : null,
      payment_date: form.payment_date,
      days_worked:  selectedWorker?.rate_type === 'daily'    ? daysWorked  : null,
      unit_count:   selectedWorker?.rate_type === 'per_unit' ? unitCount   : null,
      rate_snapshot: rateSnapshot,
      gross_amount:  gross,
      deduction:     deduction,
      net_amount:    net,
      notes:         form.notes,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Wage Payment Details
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Worker *"
            value={form.worker_id}
            onChange={e => handleWorkerChange(e.target.value)}
            required
          >
            <option value="">-- Select Worker --</option>
            {workers.filter(w => w.is_active).map(w => (
              <option key={w.id} value={w.id}>
                {w.full_name} — {WORKER_ROLE[w.role]}
              </option>
            ))}
          </Select>

          <Select
            label="Project"
            value={form.project_id}
            onChange={e => set('project_id', e.target.value)}
          >
            <option value="">-- Select Project --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </Select>

          <Input
            label="Payment Date *"
            type="date"
            value={form.payment_date}
            onChange={e => set('payment_date', e.target.value)}
            required
          />

          <CurrencyInput
            label="Rate (snapshot)"
            value={form.rate_snapshot}
            onChange={val => set('rate_snapshot', val)}
            placeholder="0"
          />

          {/* Qty berdasarkan tipe */}
          {selectedWorker?.rate_type === 'daily' && (
            <Input
              label="Working Days"
              type="text"
              inputMode="decimal"
              value={form.days_worked}
              onChange={e => set('days_worked', e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))}
              placeholder="0"
            />
          )}

          {selectedWorker?.rate_type === 'per_unit' && (
            <Input
              label="Unit Count"
              type="text"
              inputMode="decimal"
              value={form.unit_count}
              onChange={e => set('unit_count', e.target.value.replace(/[^0-9.,]/g,'').replace(',','.'))}
              placeholder="0"
            />
          )}

          <CurrencyInput
            label="Deduction"
            value={form.deduction}
            onChange={val => set('deduction', val)}
            placeholder="0"
          />

          <Input
            label="Notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="optional"
            className="col-span-2"
          />
        </div>
      </div>

      {/* Worker Info */}
      {selectedWorker && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <HardHat size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Worker Info</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-gray-500">Position</span>
              <div className="font-medium text-gray-800">{WORKER_ROLE[selectedWorker.role]}</div>
            </div>
            <div>
              <span className="text-gray-500">Rate Type</span>
              <div className="font-medium text-gray-800">{RATE_TYPE[selectedWorker.rate_type]}</div>
            </div>
            <div>
              <span className="text-gray-500">Standard Rate</span>
              <div className="font-medium text-gray-800">{formatRupiah(selectedWorker.rate_amount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Kalkulasi */}
      {gross > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {selectedWorker?.rate_type === 'daily'
                ? `${daysWorked} hari × ${formatRupiah(rateSnapshot)}`
                : selectedWorker?.rate_type === 'per_unit'
                ? `${unitCount} unit × ${formatRupiah(rateSnapshot)}`
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
            <span className="text-gray-800">Pay Worker Wages</span>
            <span className="text-emerald-700">{formatRupiah(net)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}
          disabled={!selectedWorker || gross <= 0}>
          Save Wage Payment
        </Button>
      </div>
    </form>
  )
}

export default function Wages() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: wages = [], isLoading } = useQuery({
    queryKey: ['wages'],
    queryFn: async () => {
      const workers = await workersApi.getAll({})
      const allWages = []
      for (const w of workers) {
        const wWages = await workersApi.getWages(w.id)
        wWages.forEach(wage => allWages.push({ ...wage, worker: w }))
      }
      return allWages.sort((a,b) => new Date(b.payment_date) - new Date(a.payment_date))
    },
  })

  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => workersApi.getAll({}),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['wages'] })
    qc.invalidateQueries({ queryKey: ['ledger'] })
    qc.invalidateQueries({ queryKey: ['ledger-summary'] })
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const wage = await workersApi.createWage(data)
      // otomatis catat ke ledger sebagai pengeluaran
      await ledgerApi.createExpense({
        entry_date:       data.payment_date,
        entry_type:       'expense',
        description:      `Upah ${workers.find(w=>w.id===data.worker_id)?.full_name || 'tukang'}`,
        paid_to:          workers.find(w=>w.id===data.worker_id)?.full_name || '',
        gross_expense:    data.gross_amount,
        discount_received: 0,
        payment_method:   'cash',
        wage_payment_id:  wage.id,
        notes:            data.notes || '',
      })
      return wage
    },
    onSuccess: () => {
      invalidate()
      setModalOpen(false)
      toast.success('Upah dicatat & otomatis masuk pembukuan!')
    },
    onError: (e) => toast.error(e.message),
  })

  const projectMap = Object.fromEntries(projects.map(p=>[p.id,p.project_name]))

  const totalGross = wages.reduce((s,w) => s + parseFloat(w.gross_amount||0), 0)
  const totalNet   = wages.reduce((s,w) => s + parseFloat(w.net_amount||0), 0)
  const totalDays  = wages.filter(w=>w.worker?.rate_type==='daily')
                          .reduce((s,w) => s + parseFloat(w.days_worked||0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Wages Payment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {wages.length} transactions · automatically recorded in accounting
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
            <p className="text-xs text-gray-400 mb-1">Total Net Wages</p>
            <p className="text-lg font-semibold text-gray-900">{formatRupiah(totalNet)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Days Worked</p>
            <p className="text-lg font-semibold text-gray-900">{totalDays} days</p>
          </div>
        </div>
      )}

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
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Position</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Detail</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Gross Wages</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Deductions</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Net Wages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {wages.map(wage => (
                <tr key={wage.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(wage.payment_date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {wage.worker?.full_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="gray">
                      {WORKER_ROLE[wage.worker?.role] || '-'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {wage.project_id ? projectMap[wage.project_id] : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {wage.days_worked
                      ? `${parseFloat(wage.days_worked)} hari × ${formatRupiah(wage.rate_snapshot)}`
                      : wage.unit_count
                      ? `${parseFloat(wage.unit_count)} unit × ${formatRupiah(wage.rate_snapshot)}`
                      : `Lump Sum ${formatRupiah(wage.rate_snapshot)}`
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatRupiah(wage.gross_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {parseFloat(wage.deduction) > 0
                      ? <span className="text-red-500">- {formatRupiah(wage.deduction)}</span>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatRupiah(wage.net_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total ({wages.length} transactions)
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-700">
                  {formatRupiah(totalGross)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-red-500">
                  - {formatRupiah(totalGross - totalNet)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">
                  {formatRupiah(totalNet)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pay Wages"
        size="md"
      >
        <WageForm
          key={modalOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
          workers={workers}
          projects={projects}
        />
      </Modal>
    </div>
  )
}