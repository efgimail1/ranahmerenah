import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { materialsApi } from '../api/materials'
import { projectsApi } from '../api/projects'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select, CurrencyInput } from '../components/ui/Input'
import { formatRupiah, formatDate, toInputDate, parseCurrency } from '../utils/format'
import {
  Plus, Pencil, Trash2, Package, Receipt,
  ChevronDown, ChevronUp, X, Building2, CalendarDays,
  CreditCard, FileText, Truck
} from 'lucide-react'
import toast from 'react-hot-toast'

const UNIT_OPTIONS = [
  'pcs','m²','m³','m','sak','batang','lembar',
  'roll','set','unit','kg','liter','dus','lonjor','lainnya'
]
const PAID_BY_OPTIONS = [
  { value: 'architect', label: 'Arsitek (Saya)' },
  { value: 'owner',     label: 'Pemilik Proyek' },
  { value: 'other',     label: 'Lainnya' },
]
const RECEIPT_TYPE_OPTIONS = [
  { value: 'physical', label: 'Bon Fisik' },
  { value: 'digital',  label: 'Foto Digital' },
  { value: 'both',     label: 'Keduanya' },
]
const paidByLabel   = { architect:'Arsitek', owner:'Pemilik', other:'Lainnya' }
const receiptLabel  = { physical:'Bon Fisik', digital:'Digital', both:'Fisik & Digital' }

let _keyCounter = 0
const emptyItem = () => ({
  _key: ++_keyCounter,
  catalog_item_id: null,
  item_name: '', quantity: '', unit: 'pcs',
  unit_price: '', discount_per_unit: '',
})

// ─── Item Row (table row inside form) ─────────────────────
function ItemRow({ item, index, onChange, onRemove, catalog }) {
  const qty      = parseFloat(item.quantity) || 0
  const price    = parseFloat(parseCurrency(item.unit_price)) || 0
  const discount = parseFloat(parseCurrency(item.discount_per_unit)) || 0
  const gross    = qty * price
  const net      = qty * (price - discount)
  const profit   = qty * discount

  const handleCatalogSelect = (id) => {
    if (!id) { onChange(index, 'catalog_item_id', null); return }
    const found = catalog.find(c => c.id === parseInt(id))
    if (found) {
      onChange(index, 'catalog_item_id', found.id)
      onChange(index, 'item_name', found.name)
      onChange(index, 'unit', found.default_unit || 'pcs')
    }
  }

  const cellCls = 'px-2 py-1.5'
  const inputCls = 'w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all'

  return (
    <tr className="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors group">
      <td className={`${cellCls} text-center text-xs text-gray-400 w-8`}>{index + 1}</td>

      <td className={`${cellCls} w-40`}>
        <select
          value={item.catalog_item_id || ''}
          onChange={e => handleCatalogSelect(e.target.value)}
          className={inputCls}
        >
          <option value="">-- katalog / manual --</option>
          {catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>

      <td className={cellCls}>
        <input type="text" value={item.item_name} required
          onChange={e => onChange(index, 'item_name', e.target.value)}
          placeholder="Nama barang *"
          className={inputCls}
        />
      </td>

      <td className={`${cellCls} w-24`}>
        <input
          type="text" inputMode="decimal"
          value={item.quantity}
          onChange={e => {
            const val = e.target.value.replace(/[^0-9.,]/g,'').replace(',','.')
            onChange(index, 'quantity', val)
          }}
          onWheel={e => e.target.blur()}
          placeholder="0"
          className={`${inputCls} text-right`}
        />
      </td>

      <td className={`${cellCls} w-24`}>
        <select value={item.unit} onChange={e => onChange(index,'unit',e.target.value)} className={inputCls}>
          {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>

      <td className={`${cellCls} w-36`}>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rp</span>
          <input type="text" inputMode="numeric"
            value={item.unit_price ? new Intl.NumberFormat('id-ID').format(parseCurrency(item.unit_price)) : ''}
            onChange={e => onChange(index,'unit_price', e.target.value.replace(/\D/g,''))}
            onWheel={e => e.target.blur()}
            placeholder="0"
            className={`${inputCls} pl-7 text-right`}
          />
        </div>
      </td>

      <td className={`${cellCls} w-32`}>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rp</span>
          <input type="text" inputMode="numeric"
            value={item.discount_per_unit ? new Intl.NumberFormat('id-ID').format(parseCurrency(item.discount_per_unit)) : ''}
            onChange={e => onChange(index,'discount_per_unit', e.target.value.replace(/\D/g,''))}
            onWheel={e => e.target.blur()}
            placeholder="0"
            className={`${inputCls} pl-7 text-right`}
          />
        </div>
      </td>

      <td className={`${cellCls} w-32 text-right`}>
        <span className="text-xs font-medium text-gray-700">{gross > 0 ? formatRupiah(gross) : '-'}</span>
      </td>

      <td className={`${cellCls} w-36 text-right`}>
        <span className="text-sm font-semibold text-gray-900">{net > 0 ? formatRupiah(net) : '-'}</span>
        {profit > 0 && (
          <div className="text-xs text-emerald-600 font-medium">+{formatRupiah(profit)}</div>
        )}
      </td>

      <td className={`${cellCls} w-8 text-center`}>
        <button type="button" onClick={() => onRemove(index)}
          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
          <X size={14} />
        </button>
      </td>
    </tr>
  )
}

// ─── Purchase Order Form ───────────────────────────────────
function PurchaseOrderForm({ initial, onSubmit, loading, projects, suppliers, catalog }) {
  const emptyHeader = {
    project_id:'', supplier_id:'', purchase_date:'',
    is_paid:'false', paid_by:'architect',
    has_receipt:'false', receipt_type:'physical', notes:'',
  }
  const [header, setHeader] = useState(initial ? {
    project_id:    initial.project_id   || '',
    supplier_id:   initial.supplier_id  || '',
    purchase_date: toInputDate(initial.purchase_date),
    is_paid:       String(initial.is_paid),
    paid_by:       initial.paid_by      || 'architect',
    has_receipt:   String(initial.has_receipt),
    receipt_type:  initial.receipt_type || 'physical',
    notes:         initial.notes        || '',
  } : emptyHeader)

  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map(it => ({
          _key: ++_keyCounter,
          catalog_item_id:  it.catalog_item_id || null,
          item_name:        it.item_name,
          quantity:         String(parseFloat(it.quantity)),
          unit:             it.unit || 'pcs',
          unit_price:       it.unit_price       ? String(Math.round(parseFloat(it.unit_price)))       : '',
          discount_per_unit:it.discount_per_unit? String(Math.round(parseFloat(it.discount_per_unit))): '',
        }))
      : [emptyItem()]
  )

  const setH = (f,v) => setHeader(p => ({...p,[f]:v}))
  const changeItem = (i,f,v) => setItems(p => p.map((it,idx) => idx===i ? {...it,[f]:v} : it))
  const addItem    = () => setItems(p => [...p, emptyItem()])
  const removeItem = (i) => {
    if (items.length === 1) return toast.error('Minimal 1 barang')
    setItems(p => p.filter((_,idx) => idx !== i))
  }

  const grandGross = items.reduce((s,it) => {
    return s + (parseFloat(it.quantity)||0) * (parseFloat(parseCurrency(it.unit_price))||0)
  }, 0)
  const grandNet = items.reduce((s,it) => {
    const qty   = parseFloat(it.quantity)||0
    const price = parseFloat(parseCurrency(it.unit_price))||0
    const disc  = parseFloat(parseCurrency(it.discount_per_unit))||0
    return s + qty*(price-disc)
  }, 0)
  const grandDiscount = grandGross - grandNet

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...header,
      project_id:  header.project_id  ? parseInt(header.project_id)  : null,
      supplier_id: header.supplier_id ? parseInt(header.supplier_id) : null,
      is_paid:     header.is_paid === 'true',
      has_receipt: header.has_receipt === 'true',
      items: items.map(it => ({
        catalog_item_id:   it.catalog_item_id || null,
        item_name:         it.item_name,
        quantity:          parseFloat(it.quantity)||0,
        unit:              it.unit,
        unit_price:        parseFloat(parseCurrency(it.unit_price))||0,
        discount_per_unit: parseFloat(parseCurrency(it.discount_per_unit))||0,
      }))
    })
  }

  const sectionLabel = 'text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3'
  const fieldLabel   = 'text-sm font-medium text-gray-700'
  const fieldInput   = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all w-full'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── HEADER ── */}
      <div>
        <h4 className={sectionLabel}>Informasi Pembelian</h4>
        <div className="grid grid-cols-3 gap-3">
          {/* Supplier */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Supplier / Toko</label>
            <select value={header.supplier_id} onChange={e => setH('supplier_id',e.target.value)} className={fieldInput}>
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.store_name}</option>)}
            </select>
          </div>
          {/* Proyek */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Proyek</label>
            <select value={header.project_id} onChange={e => setH('project_id',e.target.value)} className={fieldInput}>
              <option value="">-- Pilih Proyek --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
          {/* Tanggal */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Tanggal Beli *</label>
            <input type="date" value={header.purchase_date}
              onChange={e => setH('purchase_date',e.target.value)}
              required className={fieldInput} />
          </div>

          {/* Status Bayar */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Status Pembayaran</label>
            <select value={header.is_paid} onChange={e => setH('is_paid',e.target.value)} className={fieldInput}>
              <option value="false">Belum Dibayar</option>
              <option value="true">Sudah Dibayar</option>
            </select>
          </div>
          {/* Dibayar oleh */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Dibayar Oleh</label>
            <select value={header.paid_by} onChange={e => setH('paid_by',e.target.value)} className={fieldInput}>
              {PAID_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Bon */}
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Bon / Kwitansi</label>
            <div className="flex gap-2">
              <select value={header.has_receipt} onChange={e => setH('has_receipt',e.target.value)} className={fieldInput}>
                <option value="false">Tidak Ada</option>
                <option value="true">Ada</option>
              </select>
              {header.has_receipt === 'true' && (
                <select value={header.receipt_type} onChange={e => setH('receipt_type',e.target.value)} className={fieldInput}>
                  {RECEIPT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Catatan */}
          <div className="col-span-3 flex flex-col gap-1">
            <label className={fieldLabel}>Catatan</label>
            <input type="text" value={header.notes}
              onChange={e => setH('notes',e.target.value)}
              placeholder="catatan tambahan (opsional)"
              className={fieldInput} />
          </div>
        </div>
      </div>

      {/* ── ORDER LINES ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={sectionLabel}>Daftar Barang ({items.length} item)</h4>
          <Button type="button" variant="ghost" size="sm" onClick={addItem}>
            <Plus size={14} /> Tambah Baris
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 w-8">#</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500 w-40">Dari Katalog</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">Nama Barang</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-24">Qty</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500 w-24">Satuan</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-36">Harga Satuan</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-32">Diskon/Sat</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-32">Subtotal Bon</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-36">Dibayarkan</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item,i) => (
                  <ItemRow key={item._key} item={item} index={i}
                    onChange={changeItem} onRemove={removeItem} catalog={catalog} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Total */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex justify-end gap-8 items-end">
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">Total Harga Bon</div>
                <div className="text-sm font-semibold text-gray-700">{formatRupiah(grandGross)}</div>
              </div>
              {grandDiscount > 0 && (
                <div className="text-right">
                  <div className="text-xs text-emerald-500 mb-0.5">Keuntungan Diskon</div>
                  <div className="text-sm font-semibold text-emerald-600">+ {formatRupiah(grandDiscount)}</div>
                </div>
              )}
              <div className="text-right border-l border-gray-300 pl-8">
                <div className="text-xs text-gray-400 mb-0.5">Total Dibayarkan</div>
                <div className="text-base font-bold text-emerald-700">{formatRupiah(grandNet)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? 'Simpan Perubahan' : 'Simpan Purchase Order'}
        </Button>
      </div>
    </form>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function Materials() {
  const qc = useQueryClient()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editData,     setEditData]     = useState(null)
  const [expandedId,   setExpandedId]   = useState(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterPaid,   setFilterPaid]   = useState('')

  const { data: orders=[], isLoading } = useQuery({
    queryKey: ['purchase-orders', filterProject, filterPaid],
    queryFn: () => {
      const p = {}
      if (filterProject) p.project_id = filterProject
      if (filterPaid !== '') p.is_paid = filterPaid === 'true'
      return materialsApi.getPurchaseOrders(p)
    },
  })
  const { data: projects=[]  } = useQuery({ queryKey:['projects'],  queryFn:()=>projectsApi.getAll() })
  const { data: suppliers=[] } = useQuery({ queryKey:['suppliers'], queryFn:materialsApi.getSuppliers })
  const { data: catalog=[]   } = useQuery({ queryKey:['catalog'],   queryFn:materialsApi.getCatalog })

  const inv = () => qc.invalidateQueries({ queryKey:['purchase-orders'] })

  const createMutation = useMutation({
    mutationFn: materialsApi.createPurchaseOrder,
    onSuccess: () => { inv(); setModalOpen(false); toast.success('Purchase Order disimpan!') },
    onError:   (e) => toast.error(e.message),
  })
  const updateMutation = useMutation({
    mutationFn: ({id,data}) => materialsApi.updatePurchaseOrder(id,data),
    onSuccess: () => { inv(); setModalOpen(false); setEditData(null); toast.success('Purchase Order diupdate!') },
    onError:   (e) => toast.error(e.message),
  })
  const deleteMutation = useMutation({
    mutationFn: materialsApi.deletePurchaseOrder,
    onSuccess: () => { inv(); toast.success('Purchase Order dihapus.') },
    onError:   (e) => toast.error(e.message),
  })

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({id:editData.id, data})
    else createMutation.mutate(data)
  }
  const handleEdit = async (order) => {
    const fresh = await materialsApi.getPurchaseOrder(order.id)
    setEditData(fresh)
    setModalOpen(true)
  }
  const handleDelete = (id) => {
    if (confirm('Yakin hapus Purchase Order ini?')) deleteMutation.mutate(id)
  }

  const supplierMap = Object.fromEntries(suppliers.map(s=>[s.id,s]))
  const projectMap  = Object.fromEntries(projects.map(p=>[p.id,p]))

  const totalGross    = orders.reduce((s,o)=>s+parseFloat(o.total_gross||0),0)
  const totalNet      = orders.reduce((s,o)=>s+parseFloat(o.total_net||0),0)
  const totalDiscount = orders.reduce((s,o)=>s+parseFloat(o.total_discount||0),0)

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pembelian Material</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} purchase order · {orders.filter(o=>!o.is_paid).length} belum dibayar
          </p>
        </div>
        <Button variant="primary" onClick={()=>{ setEditData(null); setModalOpen(true) }}>
          <Plus size={16}/> Tambah Purchase Order
        </Button>
      </div>

      {/* Summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Harga Bon</p>
            <p className="text-lg font-semibold text-gray-900">{formatRupiah(totalGross)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Dibayarkan</p>
            <p className="text-lg font-semibold text-gray-900">{formatRupiah(totalNet)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-600 mb-1">Total Keuntungan Diskon</p>
            <p className="text-lg font-semibold text-emerald-700">{formatRupiah(totalDiscount)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48">
          <option value="">Semua Proyek</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {[{l:'Semua',v:''},{l:'Belum Bayar',v:'false'},{l:'Sudah Bayar',v:'true'}].map(f=>(
            <button key={f.v} onClick={()=>setFilterPaid(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterPaid===f.v
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent"/>
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Package size={32} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-sm text-gray-400">Belum ada Purchase Order.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const isExp     = expandedId === order.id
            const supplier  = supplierMap[order.supplier_id]
            const project   = projectMap[order.project_id]

            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">

                {/* ── List Row ── */}
                <div className="flex items-stretch divide-x divide-gray-100">

                  {/* PO Number */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[110px] bg-gray-50">
                    <span className="text-xs text-gray-400 font-medium mb-0.5">PO No.</span>
                    <span className="text-sm font-mono font-bold text-emerald-700">
                      PO-{String(order.id).padStart(5,'0')}
                    </span>
                  </div>

                  {/* Supplier */}
                  <div className="flex flex-col justify-center px-4 py-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <Truck size={11}/> Supplier
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {supplier?.store_name || <span className="text-gray-300 italic">-</span>}
                    </span>
                  </div>

                  {/* Proyek */}
                  <div className="flex flex-col justify-center px-4 py-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <Building2 size={11}/> Proyek
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {project?.project_name || <span className="text-gray-300 italic">-</span>}
                    </span>
                  </div>

                  {/* Tanggal */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[120px]">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <CalendarDays size={11}/> Tanggal
                    </span>
                    <span className="text-sm text-gray-700">{formatDate(order.purchase_date)}</span>
                  </div>

                  {/* Dibayar oleh */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[110px]">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <CreditCard size={11}/> Dibayar Oleh
                    </span>
                    <span className="text-sm text-gray-700">{paidByLabel[order.paid_by]||'-'}</span>
                  </div>

                  {/* Bon */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[110px]">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <FileText size={11}/> Bon
                    </span>
                    <span className="text-sm text-gray-700">
                      {order.has_receipt
                        ? <span className="flex items-center gap-1"><Receipt size={12}/>{receiptLabel[order.receipt_type]}</span>
                        : <span className="text-gray-300">-</span>}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[90px]">
                    <span className="text-xs text-gray-400 mb-1">Status</span>
                    <Badge color={order.is_paid?'green':'red'}>
                      {order.is_paid?'Lunas':'Hutang'}
                    </Badge>
                  </div>

                  {/* Total Bon */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[130px] text-right">
                    <span className="text-xs text-gray-400 mb-0.5">Total Bon</span>
                    <span className="text-sm font-semibold text-gray-800">{formatRupiah(order.total_gross)}</span>
                    {parseFloat(order.total_discount)>0 && (
                      <span className="text-xs text-emerald-600">-{formatRupiah(order.total_discount)}</span>
                    )}
                  </div>

                  {/* Dibayarkan */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-[130px] text-right bg-gray-50">
                    <span className="text-xs text-gray-400 mb-0.5">Dibayarkan</span>
                    <span className="text-sm font-bold text-emerald-700">{formatRupiah(order.total_net)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 px-3">
                    <button onClick={()=>handleEdit(order)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                      <Pencil size={14}/>
                    </button>
                    <button onClick={()=>handleDelete(order.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Hapus">
                      <Trash2 size={14}/>
                    </button>
                    <button onClick={()=>setExpandedId(isExp ? null : order.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                      title={isExp?'Tutup':'Lihat Barang'}>
                      {isExp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                  </div>
                </div>

                {/* ── Order Lines ── */}
                {isExp && (
                  <div className="border-t border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 w-8">#</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Nama Barang</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-20">Qty</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-16">Satuan</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">Harga Satuan</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-28">Diskon/Sat</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">Subtotal Bon</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">Dibayarkan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.items?.map((item,i) => (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 text-center text-xs text-gray-400">{i+1}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-800">{item.item_name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{parseFloat(item.quantity)}</td>
                            <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{formatRupiah(item.unit_price)}</td>
                            <td className="px-4 py-2.5 text-right">
                              {parseFloat(item.discount_per_unit)>0
                                ? <span className="text-emerald-600 font-medium">{formatRupiah(item.discount_per_unit)}</span>
                                : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">{formatRupiah(item.subtotal_gross)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatRupiah(item.subtotal_net)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={6} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Total
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                            {formatRupiah(order.total_gross)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {formatRupiah(order.total_net)}
                          </td>
                        </tr>
                        {parseFloat(order.total_discount)>0 && (
                          <tr className="bg-emerald-50">
                            <td colSpan={7} className="px-4 py-2 text-right text-xs text-emerald-600">
                              Keuntungan diskon dari supplier
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-emerald-700">
                              + {formatRupiah(order.total_discount)}
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                    {order.notes && (
                      <div className="px-4 py-2.5 border-t border-gray-100 bg-amber-50">
                        <span className="text-xs text-amber-600 font-medium">Catatan: </span>
                        <span className="text-xs text-amber-800 italic">{order.notes}</span>
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
        onClose={()=>{ setModalOpen(false); setEditData(null) }}
        title={editData
          ? `Edit PO-${String(editData.id).padStart(5,'0')}`
          : 'Tambah Purchase Order'}
        size="xl"
      >
        <PurchaseOrderForm
          key={editData?.id ?? 'new'}
          initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          projects={projects}
          suppliers={suppliers}
          catalog={catalog}
        />
      </Modal>
    </div>
  )
}