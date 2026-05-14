import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ledgerApi } from '../api/ledger'
import { projectsApi } from '../api/projects'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import { formatRupiah, formatDate, parseCurrency } from '../utils/format'
import {
  TrendingUp, TrendingDown, Wallet,
  Trash2, ArrowDownCircle, ArrowUpCircle, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash',     label: 'Tunai' },
  { value: 'transfer', label: 'Transfer Bank' },
  { value: 'qris',     label: 'QRIS' },
  { value: 'other',    label: 'Lainnya' },
]

const QRIS_FEE_RATE = 0.003

// ─── Form Income ───────────────────────────────────────────
function IncomeForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    entry_date: '',
    description: '',
    received_from: '',
    gross_amount: '',
    payment_method: 'transfer',
    is_qris: false,
    project_payment_id: '',
    notes: '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const gross     = parseFloat(parseCurrency(form.gross_amount)) || 0
  const qrisFee   = form.is_qris ? Math.round(gross * QRIS_FEE_RATE) : 0
  const netAmount = gross - qrisFee

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      entry_type: 'income',
      gross_amount: gross,
      is_qris: form.is_qris,
      project_payment_id: form.project_payment_id ? parseInt(form.project_payment_id) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Income Details
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date *"
            type="date"
            value={form.entry_date}
            onChange={e => set('entry_date', e.target.value)}
            required
          />
          <Input
            label="Received From *"
            value={form.received_from}
            onChange={e => set('received_from', e.target.value)}
            placeholder="contoh: Pak Budi — Villa Bali"
            required
          />
          <Input
            label="Description *"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="contoh: Pembayaran DP Proyek Villa"
            className="col-span-2"
            required
          />
          <Select
            label="Payment Method"
            value={form.payment_method}
            onChange={e => {
              set('payment_method', e.target.value)
              set('is_qris', e.target.value === 'qris')
            }}
          >
            {PAYMENT_METHOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <CurrencyInput
            label="Gross Amount *"
            value={form.gross_amount}
            onChange={val => set('gross_amount', val)}
            placeholder="0"
          />
        </div>
      </div>

      {/* QRIS Info */}
      {form.is_qris && gross > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
            <AlertCircle size={14} /> QRIS Fee 0.3%
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount sent to client</span>
            <span className="font-medium">{formatRupiah(gross)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">QRIS Fee (0.3%)</span>
            <span className="font-medium text-red-500">- {formatRupiah(qrisFee)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-amber-200 pt-1.5">
            <span className="text-gray-800">Amount received in bank</span>
            <span className="text-emerald-700">{formatRupiah(netAmount)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <input
          type="text"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="optional"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          Save Income
        </Button>
      </div>
    </form>
  )
}

// ─── Form Expense ──────────────────────────────────────────
function ExpenseForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    entry_date: '',
    description: '',
    paid_to: '',
    gross_expense: '',
    discount_received: '',
    payment_method: 'cash',
    notes: '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const gross    = parseFloat(parseCurrency(form.gross_expense)) || 0
  const discount = parseFloat(parseCurrency(form.discount_received)) || 0
  const net      = gross - discount

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      entry_type: 'expense',
      gross_expense: gross,
      discount_received: discount,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Expense Details
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date *"
            type="date"
            value={form.entry_date}
            onChange={e => set('entry_date', e.target.value)}
            required
          />
          <Input
            label="Paid To"
            value={form.paid_to}
            onChange={e => set('paid_to', e.target.value)}
            placeholder="e.g., TB Makmur / Pak Ahmad"
          />
          <Input
            label="Description *"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="e.g., Beli material proyek Villa"
            className="col-span-2"
            required
          />
          <Select
            label="Payment Method"
            value={form.payment_method}
            onChange={e => set('payment_method', e.target.value)}
          >
            {PAYMENT_METHOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <CurrencyInput
            label="Gross Expense"
            value={form.gross_expense}
            onChange={val => set('gross_expense', val)}
            placeholder="0"
          />
          <CurrencyInput
            label="Discount Received"
            value={form.discount_received}
            onChange={val => set('discount_received', val)}
            placeholder="0"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="optional"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      {gross > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Gross Expense</span>
            <span className="font-medium">{formatRupiah(gross)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount Received</span>
              <span className="font-medium text-emerald-600">- {formatRupiah(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
            <span className="text-gray-800">Amount paid out</span>
            <span className="text-red-600">{formatRupiah(net)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          Save Expense
        </Button>
      </div>
    </form>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function Ledger() {
  const qc = useQueryClient()
  const [modalType, setModalType] = useState(null) // 'income' | 'expense'
  const [filterType, setFilterType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = {}
  if (filterType) params.entry_type = filterType
  if (dateFrom)   params.date_from = dateFrom
  if (dateTo)     params.date_to = dateTo

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ledger', filterType, dateFrom, dateTo],
    queryFn: () => ledgerApi.getAll(params),
  })

  const { data: summary } = useQuery({
    queryKey: ['ledger-summary', dateFrom, dateTo],
    queryFn: () => ledgerApi.getSummary(
      dateFrom || dateTo ? { date_from: dateFrom, date_to: dateTo } : {}
    ),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ledger'] })
    qc.invalidateQueries({ queryKey: ['ledger-summary'] })
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
  }

  const incomeMutation = useMutation({
    mutationFn: ledgerApi.createIncome,
    onSuccess: () => { invalidate(); setModalType(null); toast.success('Pemasukan dicatat!') },
    onError: (e) => toast.error(e.message),
  })

  const expenseMutation = useMutation({
    mutationFn: ledgerApi.createExpense,
    onSuccess: () => { invalidate(); setModalType(null); toast.success('Pengeluaran dicatat!') },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: ledgerApi.delete,
    onSuccess: () => { invalidate(); toast.success('Entri dihapus.') },
    onError: (e) => toast.error(e.message),
  })

  const handleDelete = (id) => {
    if (confirm('Yakin hapus entri ini?')) deleteMutation.mutate(id)
  }

  const methodLabel = {
    cash: 'Tunai', transfer: 'Transfer',
    qris: 'QRIS', other: 'Lainnya'
  }

  const totalIncome  = summary?.total_income  || 0
  const totalExpense = summary?.total_expense  || 0
  const netBalance   = summary?.net_balance    || 0
  const totalDiscount= summary?.total_discount_received || 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Income & Expense Tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setModalType('expense')}
          >
            <TrendingDown size={16} className="text-red-500" />
            Record Expense
          </Button>
          <Button
            variant="primary"
            onClick={() => setModalType('income')}
          >
            <TrendingUp size={16} />
            Record Income
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={16} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">Total Income</span>
          </div>
          <p className="text-lg font-bold text-emerald-700">{formatRupiah(totalIncome)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-red-600">Total Expense</span>
          </div>
          <p className="text-lg font-bold text-red-600">{formatRupiah(totalExpense)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${netBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className={netBalance >= 0 ? 'text-blue-600' : 'text-orange-500'} />
            <span className={`text-xs font-medium ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              Net Balance
            </span>
          </div>
          <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {formatRupiah(netBalance)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Total Discount Received</span>
          </div>
          <p className="text-lg font-bold text-gray-700">{formatRupiah(totalDiscount)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { label: 'All', value: '' },
            { label: 'Income', value: 'income' },
            { label: 'Expense', value: 'expense' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilterType(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === f.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">From</span>
          <input type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-xs text-gray-400">s/d</span>
          <input type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Wallet size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">There are no bookkeeping entries yet.</p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">From / To</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Method</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">Gross</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">Net</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Type</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(entry => {
                  const isIncome = entry.entry_type === 'income'
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{entry.description}</div>
                        {entry.notes && (
                          <div className="text-xs text-gray-400 italic">{entry.notes}</div>
                        )}
                        {entry.is_qris && (
                          <div className="text-xs text-amber-600">
                            QRIS fee: {formatRupiah(entry.qris_fee_amount)}
                          </div>
                        )}
                        {!isIncome && parseFloat(entry.discount_received) > 0 && (
                          <div className="text-xs text-emerald-600">
                            Discount: {formatRupiah(entry.discount_received)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isIncome ? entry.received_from : entry.paid_to || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {methodLabel[entry.payment_method] || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isIncome
                          ? <span className="text-sm text-gray-700">{formatRupiah(entry.gross_amount)}</span>
                          : <span className="text-sm text-gray-700">{formatRupiah(entry.gross_expense)}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isIncome
                          ? <span className="text-sm font-semibold text-emerald-700">+ {formatRupiah(entry.net_amount)}</span>
                          : <span className="text-sm font-semibold text-red-600">- {formatRupiah(entry.net_expense)}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={isIncome ? 'green' : 'red'}>
                          {isIncome ? 'Income' : 'Expense'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Running Total Footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Total ({entries.length} entri)
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    {formatRupiah(
                      entries.reduce((s, e) =>
                        s + parseFloat(e.entry_type === 'income' ? e.gross_amount || 0 : e.gross_expense || 0), 0)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {netBalance >= 0
                      ? <span className="text-emerald-700">+ {formatRupiah(netBalance)}</span>
                      : <span className="text-red-600">{formatRupiah(netBalance)}</span>
                    }
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Income */}
      <Modal
        open={modalType === 'income'}
        onClose={() => setModalType(null)}
        title="Record Income"
        size="md"
      >
        <IncomeForm
          key="income"
          onSubmit={(data) => incomeMutation.mutate(data)}
          loading={incomeMutation.isPending}
          projects={projects}
        />
      </Modal>

      {/* Modal Expense */}
      <Modal
        open={modalType === 'expense'}
        onClose={() => setModalType(null)}
        title="Record Expense"
        size="md"
      >
        <ExpenseForm
          key="expense"
          onSubmit={(data) => expenseMutation.mutate(data)}
          loading={expenseMutation.isPending}
        />
      </Modal>
    </div>
  )
}