import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { materialsApi } from '../api/materials'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Modal from '../components/ui/Modal'
import Input, { Select } from '../components/ui/Input'
import { formatRupiah, formatDate } from '../utils/format'
import { Plus, Pencil, Trash2, Truck, Phone, MapPin, Package, Tag, X } from 'lucide-react'
import toast from 'react-hot-toast'

const UNIT_OPTIONS = [
  'pcs','m²','m³','m','sak','batang','lembar',
  'roll','set','unit','kg','liter','dus','lonjor','lainnya'
]

// ─── Supplier Form ─────────────────────────────────────────
function SupplierForm({ initial, onSubmit, loading }) {
  const [form, setForm] = useState(initial || { store_name:'', address:'', phone:'', contact_person:'', notes:'' })
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Store Name *" value={form.store_name}
          onChange={e => set('store_name', e.target.value)}
          placeholder="e.g. TB Makmur Jaya" className="col-span-2" required />
        <Input label="Phone Number" value={form.phone}
          onChange={e => set('phone', e.target.value)} placeholder="e.g. 08123456789" />
        <Input label="Contact Person" value={form.contact_person}
          onChange={e => set('contact_person', e.target.value)} placeholder="e.g. Mr. Agus" />
        <Input label="Address" value={form.address}
          onChange={e => set('address', e.target.value)}
          placeholder="store address" className="col-span-2" />
        <Input label="Notes" value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="optional" className="col-span-2" />
      </div>
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? 'Save Changes' : 'Save Supplier'}
        </Button>
      </div>
    </form>
  )
}

// ─── Price List Modal ──────────────────────────────────────
function PriceListModal({ supplier, onClose, catalog }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    item_name:'', catalog_item_id:'', unit:'pcs', price:'', effective_date:'', notes:''
  })
  const set = (f,v) => setForm(p => ({...p,[f]:v}))

  const { data: prices=[], isLoading } = useQuery({
    queryKey: ['supplier-prices', supplier.id],
    queryFn: () => materialsApi.getSupplierPrices(supplier.id),
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['supplier-prices', supplier.id] })

  const addMutation = useMutation({
    mutationFn: (data) => materialsApi.addSupplierPrice(supplier.id, data),
    onSuccess: () => { inv(); setAddOpen(false); setForm({item_name:'',catalog_item_id:'',unit:'pcs',price:'',effective_date:'',notes:''}); toast.success('Price added!') },
    onError:   (e) => toast.error(e.message),
  })

  const delMutation = useMutation({
    mutationFn: materialsApi.deleteSupplierPrice,
    onSuccess: () => { inv(); toast.success('Price deleted.') },
    onError:   (e) => toast.error(e.message),
  })

  const handleCatalogSelect = (catId) => {
    set('catalog_item_id', catId)
    const found = catalog.find(c => c.id === parseInt(catId))
    if (found) { set('item_name', found.name); set('unit', found.default_unit || 'pcs') }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    addMutation.mutate({
      supplier_id:     supplier.id,
      catalog_item_id: form.catalog_item_id ? parseInt(form.catalog_item_id) : null,
      item_name:       form.item_name,
      unit:            form.unit,
      price:           parseFloat(String(form.price).replace(/\D/g,'')) || 0,
      effective_date:  form.effective_date || null,
      notes:           form.notes || null,
    })
  }

  return (
    <Modal open={!!supplier} onClose={onClose}
      title={`Price List — ${supplier.store_name}`} size="lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-400">{prices.length} items in price list</p>
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add Price
          </Button>
        </div>

        {/* Add Price Form */}
        {addOpen && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase">Add New Price</span>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Select label="From Catalog" value={form.catalog_item_id}
                  onChange={e => handleCatalogSelect(e.target.value)}>
                  <option value="">-- Select from catalog --</option>
                  {catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Input label="Item Name *" value={form.item_name}
                  onChange={e => set('item_name', e.target.value)}
                  placeholder="or type manually" required />
                <Select label="UOM" value={form.unit}
                  onChange={e => set('unit', e.target.value)}>
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
                    <input type="text" inputMode="numeric"
                      value={form.price ? new Intl.NumberFormat('id-ID').format(String(form.price).replace(/\D/g,'')) : ''}
                      onChange={e => set('price', e.target.value.replace(/\D/g,''))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right" />
                  </div>
                </div>
                <Input label="Effective Date" type="date" value={form.effective_date}
                  onChange={e => set('effective_date', e.target.value)} />
                <Input label="Notes" value={form.notes}
                  onChange={e => set('notes', e.target.value)} placeholder="optional" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" loading={addMutation.isPending}>Save Price</Button>
              </div>
            </form>
          </div>
        )}

        {/* Price Table */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : prices.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No prices yet. Click "Add Price" to start building price list.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Item Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-20">UOM</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">Price</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-28">Effective</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prices.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{p.item_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{p.unit}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatRupiah(p.price)}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {p.effective_date ? formatDate(p.effective_date) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => { if (confirm('Delete this price?')) delMutation.mutate(p.id) }}
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}

// ─── Purchase History Modal ────────────────────────────────
function HistoryModal({ supplier, onClose }) {
  const { data: items=[], isLoading } = useQuery({
    queryKey: ['supplier-items', supplier.id],
    queryFn: () => materialsApi.getSupplierItems(supplier.id),
    enabled: !!supplier,
  })
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.item_name]) acc[item.item_name] = []
    acc[item.item_name].push(item)
    return acc
  }, {})

  return (
    <Modal open={!!supplier} onClose={onClose}
      title={`Purchase History — ${supplier.store_name}`} size="lg">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No purchases from this supplier yet.</div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">{items.length} total purchases</p>
          {Object.entries(grouped).map(([name, list]) => (
            <div key={name} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 flex justify-between">
                <span className="text-sm font-medium text-gray-800">{name}</span>
                <span className="text-xs text-gray-400">{list.length}x purchased</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Date</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Unit Price</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Discount</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-400 font-medium">Net Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {list.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600">{formatDate(item.purchase_date)}</td>
                      <td className="px-4 py-2 text-gray-600">{parseFloat(item.quantity)} {item.unit}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{formatRupiah(item.unit_price)}</td>
                      <td className="px-4 py-2 text-right">
                        {parseFloat(item.discount_per_unit) > 0
                          ? <span className="text-emerald-600">{formatRupiah(item.discount_per_unit)}/unit</span>
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">{formatRupiah(item.subtotal_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function Suppliers() {
  const qc = useQueryClient()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editData,     setEditData]     = useState(null)
  const [viewHistory,  setViewHistory]  = useState(null)
  const [viewPrices,   setViewPrices]   = useState(null)

  const { data: suppliers=[], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: materialsApi.getSuppliers,
  })

  const { data: catalog=[] } = useQuery({
    queryKey: ['catalog'],
    queryFn: materialsApi.getCatalog,
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['suppliers'] })

  const createMutation = useMutation({
    mutationFn: materialsApi.createSupplier,
    onSuccess: () => { inv(); setModalOpen(false); toast.success('Supplier added!') },
    onError:   (e) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialsApi.updateSupplier(id, data),
    onSuccess: () => { inv(); setModalOpen(false); setEditData(null); toast.success('Supplier updated!') },
    onError:   (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: materialsApi.deleteSupplier,
    onSuccess: () => { inv(); toast.success('Supplier deleted.') },
    onError:   (e) => toast.error(e.message),
  })

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data })
    else createMutation.mutate(data)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{suppliers.length} suppliers registered</p>
        </div>
        <Button variant="primary" onClick={() => { setEditData(null); setModalOpen(true) }}>
          <Plus size={16} /> Add Supplier
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Truck size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No suppliers yet. Add one to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map(s => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <Truck size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{s.store_name}</p>
                    {s.contact_person && <p className="text-xs text-gray-400">{s.contact_person}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditData(s); setModalOpen(true) }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => { if (confirm('Are you sure you want to delete this supplier?')) deleteMutation.mutate(s.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {s.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone size={12} /> {s.phone}
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin size={12} /> {s.address}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3">
                <button onClick={() => setViewPrices(s)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  <Tag size={12} /> Price List
                </button>
                <button onClick={() => setViewHistory(s)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Package size={12} /> Purchase History
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditData(null) }}
        title={editData ? 'Edit Supplier' : 'Add Supplier'}>
        <SupplierForm key={editData?.id ?? 'new'} initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending} />
      </Modal>

      {viewPrices && (
        <PriceListModal supplier={viewPrices} onClose={() => setViewPrices(null)} catalog={catalog} />
      )}
      {viewHistory && (
        <HistoryModal supplier={viewHistory} onClose={() => setViewHistory(null)} />
      )}
    </div>
  )
}