import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { projectsApi } from "../api/projects";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import {
  formatRupiah,
  formatDate,
  toInputDate,
  parseCurrency,
} from "../utils/format";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Receipt,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";

const UNIT_OPTIONS = [
  "pcs",
  "m²",
  "m³",
  "m",
  "sak",
  "batang",
  "lembar",
  "roll",
  "set",
  "unit",
  "kg",
  "liter",
  "dus",
  "lonjor",
  "lainnya",
];
const PAID_BY_OPTIONS = [
  { value: "architect", label: "Arsitek (Saya)" },
  { value: "owner", label: "Pemilik Proyek" },
  { value: "other", label: "Lainnya" },
];
const RECEIPT_TYPE_OPTIONS = [
  { value: "physical", label: "Physical" },
  { value: "digital", label: "Digital" },
  { value: "both", label: "Both" },
];
const paidByLabel = {
  architect: "Arsitek",
  owner: "Pemilik",
  other: "Lainnya",
};
const receiptLabel = {
  physical: "Physical",
  digital: "Digital",
  both: "Both",
};

let _keyCounter = 0;
const emptyItem = () => ({
  _key: ++_keyCounter,
  catalog_item_id: null,
  item_name: "",
  quantity: "",
  unit: "pcs",
  unit_price: "",
  discount_per_unit: "",
});

// ─── Item Lookup Modal ─────────────────────────────────────
function ItemLookupModal({ open, onClose, onSelect, catalog }) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  const filtered = catalog.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.item_code || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || c.category === filterCat
    return matchSearch && matchCat
  })

  const categories = [...new Set(catalog.map(c => c.category).filter(Boolean))]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Select Item from Catalog</h3>
            <p className="text-xs text-gray-400 mt-0.5">{catalog.length} items available</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search item name or code..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Item not found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 w-28">Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Item Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-28">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-20">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => { onSelect(item); onClose() }}
                    className="hover:bg-emerald-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-2.5">
                      {item.item_code
                        ? <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.item_code}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{item.category || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{item.default_unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {filtered.length} of {catalog.length} items
          </span>
          <p className="text-xs text-gray-400">Click row to select</p>
        </div>
      </div>
    </div>
  )
}

// ─── Item Row (table row inside form) ─────────────────────
function ItemRow({ item, index, onChange, onRemove, catalog }) {
  const [lookupOpen, setLookupOpen] = useState(false)

  const qty      = parseFloat(item.quantity) || 0
  const price    = parseFloat(parseCurrency(item.unit_price)) || 0
  const discount = parseFloat(parseCurrency(item.discount_per_unit)) || 0
  const gross    = qty * price
  const net      = qty * (price - discount)
  const profit   = qty * discount

  const handleSelect = (catalogItem) => {
    onChange(index, 'catalog_item_id', catalogItem.id)
    onChange(index, 'item_name', catalogItem.name)
    onChange(index, 'unit', catalogItem.default_unit || 'pcs')
  }

  const inputCls = 'w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all'

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors group">
        {/* # */}
        <td className="px-3 py-2 text-center text-xs text-gray-400 w-8 align-middle">
          {index + 1}
        </td>

        {/* Nama Barang + Lookup Button */}
        <td className="px-2 py-1.5 align-middle">
          <div className="flex gap-1">
            <input
              type="text"
              value={item.item_name}
              onChange={e => {
                onChange(index, 'item_name', e.target.value)
                onChange(index, 'catalog_item_id', null)
              }}
              placeholder="Nama barang..."
              required
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setLookupOpen(true)}
              title="Pilih dari katalog"
              className="shrink-0 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 text-gray-500 transition-all"
            >
              <Search size={13} />
            </button>
          </div>
          {/* Tampilkan kode jika dari katalog */}
          {item.catalog_item_id && (() => {
            const cat = catalog.find(c => c.id === item.catalog_item_id)
            return cat?.item_code
              ? <span className="text-xs text-emerald-600 font-mono pl-0.5">{cat.item_code}</span>
              : null
          })()}
        </td>

        {/* Qty */}
        <td className="px-2 py-1.5 w-28 align-middle">
          <input
            type="text" inputMode="decimal"
            value={item.quantity}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9.,]/g,'').replace(',','.')
              onChange(index,'quantity',val)
            }}
            onWheel={e => e.target.blur()}
            placeholder="0"
            className={`${inputCls} text-right`}
          />
        </td>

        {/* UOM */}
        <td className="px-2 py-1.5 w-24 align-middle">
          <select value={item.unit} onChange={e => onChange(index,'unit',e.target.value)} className={inputCls}>
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </td>

        {/* Harga Satuan */}
        <td className="px-2 py-1.5 w-36 align-middle">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rp</span>
            <input
              type="text" inputMode="numeric"
              value={item.unit_price ? new Intl.NumberFormat('id-ID').format(parseCurrency(item.unit_price)) : ''}
              onChange={e => onChange(index,'unit_price', e.target.value.replace(/\D/g,''))}
              onWheel={e => e.target.blur()}
              placeholder="0"
              className={`${inputCls} pl-7 text-right`}
            />
          </div>
        </td>

        {/* Diskon/Sat */}
        <td className="px-2 py-1.5 w-32 align-middle">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rp</span>
            <input
              type="text" inputMode="numeric"
              value={item.discount_per_unit ? new Intl.NumberFormat('id-ID').format(parseCurrency(item.discount_per_unit)) : ''}
              onChange={e => onChange(index,'discount_per_unit', e.target.value.replace(/\D/g,''))}
              onWheel={e => e.target.blur()}
              placeholder="0"
              className={`${inputCls} pl-7 text-right`}
            />
          </div>
        </td>

        {/* Subtotal Bon */}
        <td className="px-3 py-2 w-32 text-right align-middle">
          <span className="text-xs text-gray-600">{gross > 0 ? formatRupiah(gross) : '—'}</span>
        </td>

        {/* Dibayarkan */}
        <td className="px-3 py-2 w-36 text-right align-middle">
          <span className="text-sm font-semibold text-gray-900">{net > 0 ? formatRupiah(net) : '—'}</span>
          {profit > 0 && (
            <div className="text-xs text-emerald-600">+{formatRupiah(profit)}</div>
          )}
        </td>

        {/* Hapus */}
        <td className="px-2 py-1.5 w-8 text-center align-middle">
          <button type="button" onClick={() => onRemove(index)}
            className="text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
            <X size={14}/>
          </button>
        </td>
      </tr>

      {/* Lookup Modal per baris */}
      <ItemLookupModal
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onSelect={handleSelect}
        catalog={catalog}
      />
    </>
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
          catalog_item_id:   it.catalog_item_id || null,
          item_name:         it.item_name,
          quantity:          String(parseFloat(it.quantity)),
          unit:              it.unit || 'pcs',
          unit_price:        it.unit_price        ? String(Math.round(parseFloat(it.unit_price)))        : '',
          discount_per_unit: it.discount_per_unit ? String(Math.round(parseFloat(it.discount_per_unit))) : '',
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

  const grandGross = items.reduce((s,it) =>
    s + (parseFloat(it.quantity)||0) * (parseFloat(parseCurrency(it.unit_price))||0), 0)
  const grandNet = items.reduce((s,it) => {
    const qty   = parseFloat(it.quantity)||0
    const price = parseFloat(parseCurrency(it.unit_price))||0
    const disc  = parseFloat(parseCurrency(it.discount_per_unit))||0
    return s + qty*(price-disc)
  }, 0)
  const grandDiscount = grandGross - grandNet
  const totalQty = items.reduce((s,it) => s + (parseFloat(it.quantity)||0), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...header,
      project_id:  header.project_id  ? parseInt(header.project_id)  : null,
      supplier_id: header.supplier_id ? parseInt(header.supplier_id) : null,
      is_paid:     header.is_paid  === 'true',
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

  const fieldLabel = 'text-sm font-medium text-gray-700'
  const fieldInput = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all w-full'

  const selectedSupplier = suppliers.find(s => s.id === parseInt(header.supplier_id))
  const selectedProject  = projects.find(p => p.id === parseInt(header.project_id))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* PO Number badge — hanya tampil saat edit */}
      {initial && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <FileText size={14} className="text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            Purchase Order No.
          </span>
          <span className="font-mono font-bold text-emerald-800">
            PO-{String(initial.id).padStart(5,'0')}
          </span>
          <span className="ml-auto text-xs text-emerald-500">
            {formatDate(initial.purchase_date)}
          </span>
        </div>
      )}

      {/* ── HEADER INFO ── */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Purchase Information
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Supplier</label>
            <select value={header.supplier_id} onChange={e=>setH('supplier_id',e.target.value)} className={fieldInput}>
              <option value="">-- Select Supplier --</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.store_name}</option>)}
            </select>
            {selectedSupplier?.phone && (
              <span className="text-xs text-gray-400 pl-1">{selectedSupplier.phone}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Project</label>
            <select value={header.project_id} onChange={e=>setH('project_id',e.target.value)} className={fieldInput}>
              <option value="">-- Select Project --</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            {selectedProject?.location && (
              <span className="text-xs text-gray-400 pl-1">{selectedProject.location}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Purchase Date *</label>
            <input type="date" value={header.purchase_date}
              onChange={e=>setH('purchase_date',e.target.value)}
              required className={fieldInput}/>
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Payment Status</label>
            <select value={header.is_paid} onChange={e=>setH('is_paid',e.target.value)} className={fieldInput}>
              <option value="false">Not Paid</option>
              <option value="true">Paid</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Paid By</label>
            <select value={header.paid_by} onChange={e=>setH('paid_by',e.target.value)} className={fieldInput}>
              {PAID_BY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Receipt / Invoice</label>
            <div className="flex gap-2">
              <select value={header.has_receipt} onChange={e=>setH('has_receipt',e.target.value)} className={fieldInput}>
                <option value="false">Not Available</option>
                <option value="true">Available</option>
              </select>
              {header.has_receipt === 'true' && (
                <select value={header.receipt_type} onChange={e=>setH('receipt_type',e.target.value)} className={fieldInput}>
                  {RECEIPT_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="col-span-3 flex flex-col gap-1">
            <label className={fieldLabel}>Notes</label>
            <input type="text" value={header.notes}
              onChange={e=>setH('notes',e.target.value)}
              placeholder="additional notes (optional)"
              className={fieldInput}/>
          </div>
        </div>
      </div>

      {/* ── ORDER LINES ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Order Lines
            <span className="ml-2 normal-case font-normal text-gray-300">
              {items.length} lines · total qty {totalQty}
            </span>
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={addItem}>
            <Plus size={14}/> Add Line
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 w-8">#</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500">
                    Item Name
                    <span className="ml-1 text-gray-300 font-normal normal-case">(type to search catalog)</span>
                  </th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-28">Qty</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-gray-500 w-24">UOM</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-36">Unit Price</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-32">Discount</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-32">Subtotal</th>
                  <th className="px-2 py-2.5 text-right text-xs font-medium text-gray-500 w-36">Paid</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item,i) => (
                  <ItemRow
                    key={item._key} item={item} index={i}
                    onChange={changeItem} onRemove={removeItem} catalog={catalog}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Total */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-end justify-end gap-8">
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">Total Lines</div>
                <div className="text-sm font-medium text-gray-600">{items.length} item</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">Total Invoice Amount</div>
                <div className="text-sm font-semibold text-gray-700">{formatRupiah(grandGross)}</div>
              </div>
              {grandDiscount > 0 && (
                <div className="text-right">
                  <div className="text-xs text-emerald-500 mb-0.5">Discount Profit</div>
                  <div className="text-sm font-semibold text-emerald-600">+ {formatRupiah(grandDiscount)}</div>
                </div>
              )}
              <div className="text-right border-l border-gray-300 pl-8">
                <div className="text-xs text-gray-400 mb-0.5">Total Paid</div>
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
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterPaid, setFilterPaid] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", filterProject, filterPaid],
    queryFn: () => {
      const p = {};
      if (filterProject) p.project_id = filterProject;
      if (filterPaid !== "") p.is_paid = filterPaid === "true";
      return materialsApi.getPurchaseOrders(p);
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: materialsApi.getSuppliers,
  });
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog"],
    queryFn: materialsApi.getCatalog,
  });

  const inv = () => qc.invalidateQueries({ queryKey: ["purchase-orders"] });

  const createMutation = useMutation({
    mutationFn: materialsApi.createPurchaseOrder,
    onSuccess: () => {
      inv();
      setModalOpen(false);
      toast.success("Purchase Order disimpan!");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialsApi.updatePurchaseOrder(id, data),
    onSuccess: () => {
      inv();
      setModalOpen(false);
      setEditData(null);
      toast.success("Purchase Order diupdate!");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: materialsApi.deletePurchaseOrder,
    onSuccess: () => {
      inv();
      toast.success("Purchase Order dihapus.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data });
    else createMutation.mutate(data);
  };
  const handleEdit = async (order) => {
    const fresh = await materialsApi.getPurchaseOrder(order.id);
    setEditData(fresh);
    setModalOpen(true);
  };
  const handleDelete = (id) => {
    if (confirm("Yakin hapus Purchase Order ini?")) deleteMutation.mutate(id);
  };

  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const totalGross = orders.reduce(
    (s, o) => s + parseFloat(o.total_gross || 0),
    0,
  );
  const totalNet = orders.reduce((s, o) => s + parseFloat(o.total_net || 0), 0);
  const totalDiscount = orders.reduce(
    (s, o) => s + parseFloat(o.total_discount || 0),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Purchase Orders
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} purchase orders ·{" "}
            {orders.filter((o) => !o.is_paid).length} not paid
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditData(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add Purchase Order
        </Button>
      </div>

      {/* Summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Invoices Amount</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatRupiah(totalGross)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Paid</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatRupiah(totalNet)}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-600 mb-1">
              Total Discount Profit
            </p>
            <p className="text-lg font-semibold text-emerald-700">
              {formatRupiah(totalDiscount)}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {[
            { l: "All", v: "" },
            { l: "Not Paid", v: "false" },
            { l: "Paid", v: "true" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterPaid(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterPaid === f.v
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Package size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No purchase orders found.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExp = expandedId === order.id;
            const supplier = supplierMap[order.supplier_id];
            const project = projectMap[order.project_id];

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                {/* ── List Row ── */}
                <div className="flex items-stretch divide-x divide-gray-100">
                  {/* PO Number */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-27.5 bg-gray-50">
                    <span className="text-xs text-gray-400 font-medium mb-0.5">
                      PO No.
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-700">
                      PO-{String(order.id).padStart(5, "0")}
                    </span>
                  </div>

                  {/* Supplier */}
                  <div className="flex flex-col justify-center px-4 py-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <Truck size={11} /> Supplier
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {supplier?.store_name || (
                        <span className="text-gray-300 italic">-</span>
                      )}
                    </span>
                  </div>

                  {/* Project */}
                  <div className="flex flex-col justify-center px-4 py-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <Building2 size={11} /> Project
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {project?.project_name || (
                        <span className="text-gray-300 italic">-</span>
                      )}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-30">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <CalendarDays size={11} /> Date
                    </span>
                    <span className="text-sm text-gray-700">
                      {formatDate(order.purchase_date)}
                    </span>
                  </div>

                  {/* Paid By */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-27.5">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <CreditCard size={11} /> Paid By
                    </span>
                    <span className="text-sm text-gray-700">
                      {paidByLabel[order.paid_by] || "-"}
                    </span>
                  </div>

                  {/* Receipt */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-27.5">
                    <span className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                      <FileText size={11} /> Receipt
                    </span>
                    <span className="text-sm text-gray-700">
                      {order.has_receipt ? (
                        <span className="flex items-center gap-1">
                          <Receipt size={12} />
                          {receiptLabel[order.receipt_type]}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-22.5">
                    <span className="text-xs text-gray-400 mb-1">Status</span>
                    <Badge color={order.is_paid ? "green" : "red"}>
                      {order.is_paid ? "Paid" : "Not Paid"}
                    </Badge>
                  </div>

                  {/* Invoice Total */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-32.5 text-right">
                    <span className="text-xs text-gray-400 mb-0.5">
                      Invoice Total
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {formatRupiah(order.total_gross)}
                    </span>
                    {parseFloat(order.total_discount) > 0 && (
                      <span className="text-xs text-emerald-600">
                        -{formatRupiah(order.total_discount)}
                      </span>
                    )}
                  </div>

                  {/* Paid Amount */}
                  <div className="flex flex-col justify-center px-4 py-3 min-w-32.5 text-right bg-gray-50">
                    <span className="text-xs text-gray-400 mb-0.5">
                      Paid Amount
                    </span>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatRupiah(order.total_net)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 px-3">
                    <button
                      onClick={() => handleEdit(order)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExp ? null : order.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                      title={isExp ? "Close" : "View Items"}
                    >
                      {isExp ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Order Lines ── */}
                {isExp && (
                  <div className="border-t border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500 w-8">
                            #
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">
                            Item Name
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-20">
                            Quantity
                          </th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-16">
                            Unit
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">
                            Unit Price
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-28">
                            Discount/Unit
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">
                            Invoice Subtotal
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-32">
                            Paid Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.items?.map((item, i) => (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                              {i + 1}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-gray-800">
                              {item.item_name}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">
                              {parseFloat(item.quantity)}
                            </td>
                            <td className="px-3 py-2.5 text-gray-500">
                              {item.unit}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">
                              {formatRupiah(item.unit_price)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {parseFloat(item.discount_per_unit) > 0 ? (
                                <span className="text-emerald-600 font-medium">
                                  {formatRupiah(item.discount_per_unit)}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              {formatRupiah(item.subtotal_gross)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                              {formatRupiah(item.subtotal_net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td
                            colSpan={6}
                            className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            Total
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-700">
                            {formatRupiah(order.total_gross)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {formatRupiah(order.total_net)}
                          </td>
                        </tr>
                        {parseFloat(order.total_discount) > 0 && (
                          <tr className="bg-emerald-50">
                            <td
                              colSpan={7}
                              className="px-4 py-2 text-right text-xs text-emerald-600"
                            >
                              Total Discount Profit from supplier
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
                        <span className="text-xs text-amber-600 font-medium">
                          Notes:{" "}
                        </span>
                        <span className="text-xs text-amber-800 italic">
                          {order.notes}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditData(null);
        }}
        title={
          editData
            ? `Edit PO-${String(editData.id).padStart(5, "0")}`
            : "Add Purchase Order"
        }
        size="xl"
      >
        <PurchaseOrderForm
          key={editData?.id ?? "new"}
          initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          projects={projects}
          suppliers={suppliers}
          catalog={catalog}
        />
      </Modal>
    </div>
  );
}
