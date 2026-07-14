import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { projectsApi } from "../api/projects";
import { subProjectsApi } from "../api/subProjects";
import { ledgerApi } from "../api/ledger";
import { baseURL } from "../api/client";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import POPaymentForm from "./POPaymentForm";
import SupplierAgingReport from "./SupplierAgingReport";
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
  Layers,
  AlertCircle,
  BarChart3,
  ShoppingCart,
} from "lucide-react";
import toast from "react-hot-toast";

const UNIT_OPTIONS = [
  "pcs",
  "m²",
  "m³",
  "m",
  "sak",
  "btg",
  "lbr",
  "rol",
  "set",
  "unit",
  "kg",
  "liter",
  "dus",
  "lonjor",
  "klg",
  "pak",
  "truck",
  "trip",
  "engkel",
  "lainnya",
];

const RECEIPT_TYPE_OPTIONS = [
  { value: "physical", label: "Physical" },
  { value: "digital", label: "Digital" },
  { value: "both", label: "Both" },
];

const receiptLabel = { physical: "Physical", digital: "Digital", both: "Both" };

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

// ─── Supplier Lookup Modal ──────────────────────────────────
function SupplierLookupModal({ open, onClose, onSelect, suppliers }) {
  const [search, setSearch] = useState("");

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    return (
      s.store_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Pilih Supplier
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {suppliers.length} supplier tersedia
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau no. telepon supplier..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Supplier tidak ditemukan.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSelect(s);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-emerald-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-emerald-700">
                      {s.store_name}
                    </div>
                    {s.phone && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {s.phone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400">
            {filtered.length} dari {suppliers.length} supplier · klik untuk
            memilih
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Item Lookup Modal ──────────────────────────────────────
function ItemLookupModal({ open, onClose, onSelect, catalog }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const filtered = catalog.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.item_code || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!filterCat || c.category === filterCat);
  });
  const categories = [
    ...new Set(catalog.map((c) => c.category).filter(Boolean)),
  ];

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Pilih dari Katalog
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {catalog.length} item tersedia
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama item..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36"
            >
              <option value="">Semua</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Item tidak ditemukan.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-emerald-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-emerald-700">
                      {item.name}
                    </div>
                    {item.category && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.category}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 ml-4">
                    {item.default_unit}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400">
            {filtered.length} dari {catalog.length} item · klik untuk memilih
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Item Row ───────────────────────────────────────────────
function ItemRow({ item, index, onChange, onRemove, catalog }) {
  const [lookupOpen, setLookupOpen] = useState(false);
  const qtyInputRef = useRef(null);
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(parseCurrency(item.unit_price)) || 0;
  const discount = parseFloat(parseCurrency(item.discount_per_unit)) || 0;
  const gross = qty * price;
  const net = qty * (price - discount);
  const profit = qty * discount;

  const handleSelect = (catalogItem) => {
    onChange(index, "catalog_item_id", catalogItem.id);
    onChange(index, "item_name", catalogItem.name);
    onChange(index, "unit", catalogItem.default_unit || "pcs");
    // Focus ke qty setelah pilih dari katalog
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const inputCls =
    "w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all";

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors group">
        <td className="px-3 py-2 text-center text-xs text-gray-400 w-8 align-middle">
          {index + 1}
        </td>
        <td className="px-2 py-1.5 align-middle">
          <div className="flex gap-1">
            <input
              type="text"
              value={item.item_name}
              onChange={(e) => {
                onChange(index, "item_name", e.target.value);
                onChange(index, "catalog_item_id", null);
              }}
              placeholder="Nama barang..."
              required
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setLookupOpen(true)}
              title="Pilih dari katalog"
              data-item-search
              className="shrink-0 px-2 py-1.5 ..."
            >
              <Search size={13} />
            </button>
          </div>
        </td>
        <td className="px-2 py-1.5 w-28 align-middle">
          <input
            ref={qtyInputRef}
            type="text"
            inputMode="decimal"
            value={item.quantity}
            onChange={(e) =>
              onChange(
                index,
                "quantity",
                e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."),
              )
            }
            onWheel={(e) => e.target.blur()}
            placeholder="0"
            className={`${inputCls} text-right`}
          />
        </td>
        <td className="px-2 py-1.5 w-24 align-middle">
          <select
            value={item.unit}
            onChange={(e) => onChange(index, "unit", e.target.value)}
            className={inputCls}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1.5 w-40 align-middle">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={
                item.unit_price
                  ? new Intl.NumberFormat("id-ID").format(
                      parseCurrency(item.unit_price),
                    )
                  : ""
              }
              onChange={(e) =>
                onChange(index, "unit_price", e.target.value.replace(/\D/g, ""))
              }
              onWheel={(e) => e.target.blur()}
              placeholder="0"
              className={`${inputCls} pl-7 text-right`}
            />
          </div>
        </td>
        <td className="px-2 py-1.5 w-36 align-middle">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={
                item.discount_per_unit
                  ? new Intl.NumberFormat("id-ID").format(
                      parseCurrency(item.discount_per_unit),
                    )
                  : ""
              }
              onChange={(e) =>
                onChange(
                  index,
                  "discount_per_unit",
                  e.target.value.replace(/\D/g, ""),
                )
              }
              onWheel={(e) => e.target.blur()}
              placeholder="0"
              className={`${inputCls} pl-7 text-right`}
            />
          </div>
        </td>
        <td className="px-3 py-2 w-32 text-right align-middle">
          <span className="text-xs text-gray-500">
            {gross > 0 ? formatRupiah(gross) : "—"}
          </span>
        </td>
        <td className="px-3 py-2 w-36 text-right align-middle">
          <span className="text-sm font-semibold text-gray-900">
            {net > 0 ? formatRupiah(net) : "—"}
          </span>
          {profit > 0 && (
            <div className="text-xs text-emerald-600">
              +{formatRupiah(profit)}
            </div>
          )}
        </td>
        <td className="px-2 py-1.5 w-8 text-center align-middle">
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        </td>
      </tr>
      <ItemLookupModal
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onSelect={handleSelect}
        catalog={catalog}
      />
    </>
  );
}

// ─── Purchase Order Form (Full Screen) ─────────────────────
function PurchaseOrderForm({
  initial,
  onSubmit,
  loading,
  projects,
  suppliers,
  catalog,
}) {
  const emptyHeader = {
    project_id: "",
    sub_project_id: "",
    supplier_id: "",
    purchase_date: "",
    is_paid: "false",
    ordered_by: "",
    has_receipt: "false",
    receipt_type: "physical",
    receipt_image_url: "",
    receipt_image_name: "",
    notes: "",
  };

  const [header, setHeader] = useState(
    initial
      ? {
          project_id: initial.project_id || "",
          sub_project_id: initial.sub_project_id || "",
          supplier_id: initial.supplier_id || "",
          purchase_date: toInputDate(initial.purchase_date),
          is_paid: String(initial.is_paid),
          ordered_by: initial.ordered_by || "",
          has_receipt: String(initial.has_receipt),
          receipt_type: initial.receipt_type || "physical",
          receipt_image_url: initial.receipt_image_url || "",
          receipt_image_name: "",
          notes: initial.notes || "",
        }
      : emptyHeader,
  );

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);

  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((it) => ({
          _key: ++_keyCounter,
          catalog_item_id: it.catalog_item_id || null,
          item_name: it.item_name,
          quantity: String(parseFloat(it.quantity)),
          unit: it.unit || "pcs",
          unit_price: it.unit_price
            ? String(Math.round(parseFloat(it.unit_price)))
            : "",
          discount_per_unit: it.discount_per_unit
            ? String(Math.round(parseFloat(it.discount_per_unit)))
            : "",
        }))
      : [emptyItem()],
  );

  const setH = (f, v) => setHeader((p) => ({ ...p, [f]: v }));
  const changeItem = (i, f, v) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [f]: v } : it)));

  const addItem = () => {
    setItems((p) => [...p, emptyItem()]);
    setTimeout(() => {
      const rows = document.querySelectorAll("[data-item-search]");
      rows[rows.length - 1]?.focus();
    }, 50);
  };
  const removeItem = (i) => {
    if (items.length === 1) return toast.error("Minimal 1 barang");
    setItems((p) => p.filter((_, idx) => idx !== i));
  };

  // Contractor sub project logic
  const selectedProject = projects.find(
    (p) => p.id === parseInt(header.project_id),
  );
  const isContractor = selectedProject?.project_type === "contractor";
  const { data: subProjects = [] } = useQuery({
    queryKey: ["sub-projects-po-form", header.project_id],
    queryFn: () => subProjectsApi.getByProject(parseInt(header.project_id)),
    enabled: !!header.project_id && isContractor,
  });
  const selectedSubProject = subProjects.find(
    (sp) => sp.id === parseInt(header.sub_project_id),
  );

  const handleProjectChange = (val) => {
    setH("project_id", val);
    setH("sub_project_id", "");
  };

  // Totals
  const grandGross = items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(parseCurrency(it.unit_price)) || 0;
    return s + qty * price;
  }, 0);
  const grandNet = items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(parseCurrency(it.unit_price)) || 0;
    const disc = parseFloat(parseCurrency(it.discount_per_unit)) || 0;
    return s + qty * (price - disc);
  }, 0);
  const grandDiscount = grandGross - grandNet;
  const totalQty = items.reduce(
    (s, it) => s + (parseFloat(it.quantity) || 0),
    0,
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    // eslint-disable-next-line no-unused-vars
    const { receipt_image_name: _imgName, ...headerData } = header;
    onSubmit({
      ...headerData,
      project_id: header.project_id ? parseInt(header.project_id) : null,
      sub_project_id: header.sub_project_id
        ? parseInt(header.sub_project_id)
        : null,
      supplier_id: header.supplier_id ? parseInt(header.supplier_id) : null,
      is_paid: header.is_paid === "true",
      has_receipt: header.has_receipt === "true",
      items: items.map((it) => ({
        catalog_item_id: it.catalog_item_id || null,
        item_name: it.item_name,
        quantity: parseFloat(it.quantity) || 0,
        unit: it.unit,
        unit_price: parseFloat(parseCurrency(it.unit_price)) || 0,
        discount_per_unit: parseFloat(parseCurrency(it.discount_per_unit)) || 0,
      })),
    });
  };

  const fLabel =
    "text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5 block";
  const fInput =
    "rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all w-full";
  const selectedSupplier = suppliers.find(
    (s) => s.id === parseInt(header.supplier_id),
  );

  const receiptImgSrc = header.receipt_image_url?.startsWith("http")
    ? header.receipt_image_url
    : `${baseURL}${header.receipt_image_url}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full flex flex-col gap-0 max-w-400 mx-auto w-full"
    >
      {/* ── HEADER: grid 12-kolom, bernapas, tanpa overflow horizontal ── */}
      <div className="grid grid-cols-12 gap-4 pb-4 border-b border-gray-100 shrink-0">
        {/* Baris 1 */}
        <div className="col-span-3">
          <label className={fLabel}>Supplier</label>
          <button
            type="button"
            onClick={() => setSupplierLookupOpen(true)}
            className={`${fInput} flex items-center justify-between text-left ${
              !header.supplier_id ? "text-gray-400" : "text-gray-900"
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Search size={13} className="text-gray-300 shrink-0" />
              {selectedSupplier?.store_name || "-- Pilih Supplier --"}
            </span>
          </button>
          {selectedSupplier?.phone && (
            <p className="text-[11px] text-gray-400 mt-1">
              {selectedSupplier.phone}
            </p>
          )}
        </div>

        <div className="col-span-2">
          <label className={fLabel}>Project</label>
          <select
            value={header.project_id}
            onChange={(e) => handleProjectChange(e.target.value)}
            className={fInput}
          >
            <option value="">-- Pilih --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_type === "contractor" ? "🏗 " : ""}
                {p.project_name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          {isContractor ? (
            <>
              <label className={fLabel}>
                Sub Project{" "}
                <span className="text-orange-400 normal-case">kontraktor</span>
              </label>
              <select
                value={header.sub_project_id}
                onChange={(e) => setH("sub_project_id", e.target.value)}
                className={`${fInput} ${!header.sub_project_id ? "border-orange-300 bg-orange-50/30" : ""}`}
              >
                <option value="">-- Pilih --</option>
                {subProjects.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
              {selectedSubProject && (
                <p className="text-[11px] text-gray-400 mt-1">
                  RAB: {formatRupiah(selectedSubProject.rab_value)}
                </p>
              )}
            </>
          ) : (
            <>
              <label className={fLabel}>Purchase Date *</label>
              <input
                type="date"
                value={header.purchase_date}
                onChange={(e) => setH("purchase_date", e.target.value)}
                required
                className={fInput}
              />
            </>
          )}
        </div>

        {isContractor && (
          <div className="col-span-1">
            <label className={fLabel}>Tanggal *</label>
            <input
              type="date"
              value={header.purchase_date}
              onChange={(e) => setH("purchase_date", e.target.value)}
              required
              className={fInput}
            />
          </div>
        )}

        <div className="col-span-2">
          <label className={fLabel}>Payment Status</label>
          <select
            value={header.is_paid}
            onChange={(e) => setH("is_paid", e.target.value)}
            className={fInput}
          >
            <option value="false">🔴 Belum Bayar</option>
            <option value="true">✅ Sudah Bayar</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={fLabel}>Dibeli Oleh</label>
          <input
            type="text"
            value={header.ordered_by}
            onChange={(e) => setH("ordered_by", e.target.value)}
            placeholder="Nama..."
            className={fInput}
          />
        </div>

        {/* Baris 2 */}
        <div className="col-span-2">
          <label className={fLabel}>Receipt / Invoice</label>
          <select
            value={header.has_receipt}
            onChange={(e) => setH("has_receipt", e.target.value)}
            className={fInput}
          >
            <option value="false">Tidak Ada</option>
            <option value="true">Tersedia</option>
          </select>
        </div>

        {header.has_receipt === "true" && (
          <div className="col-span-2">
            <label className={fLabel}>Tipe Bon</label>
            <select
              value={header.receipt_type}
              onChange={(e) => setH("receipt_type", e.target.value)}
              className={fInput}
            >
              {RECEIPT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {header.has_receipt === "true" &&
          (header.receipt_type === "digital" ||
            header.receipt_type === "both") && (
            <div className="col-span-2">
              <label className={fLabel}>Foto Bon</label>
              {header.receipt_image_url ? (
                <div className="relative group inline-flex">
                  <button
                    type="button"
                    onClick={() => setPhotoModalOpen(true)}
                    className="w-16 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
                  >
                    <img
                      src={receiptImgSrc}
                      alt="Foto bon"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setH("receipt_image_url", "");
                      setH("receipt_image_name", "");
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-lg h-10 px-3 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all w-fit">
                  <Receipt size={14} className="text-gray-300" />
                  <span className="text-xs text-gray-400">Upload foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("File terlalu besar, maks 5MB");
                        return;
                      }
                      try {
                        const { url } = await materialsApi.uploadReceipt(file);
                        setH("receipt_image_url", url);
                        setH("receipt_image_name", file.name);
                        toast.success("Foto bon terupload");
                      } catch (err) {
                        toast.error("Gagal upload foto: " + err.message);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )}

        <div className="col-span-4">
          <label className={fLabel}>Notes</label>
          <input
            type="text"
            value={header.notes}
            onChange={(e) => setH("notes", e.target.value)}
            placeholder="Catatan tambahan (opsional)"
            className={fInput}
          />
        </div>

        {/* Summary ringkas — kanan, sejajar baris 2 */}
        <div className="col-span-2 flex items-center justify-end gap-4 pl-4 border-l border-gray-100">
          {initial && (
            <div className="text-right">
              <div className="text-[11px] text-emerald-500 font-semibold">
                PO-{String(initial.id).padStart(5, "0")}
              </div>
              <div className="text-[11px] text-gray-400">
                {formatDate(initial.purchase_date)}
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[11px] text-gray-400">Total Dibayar</div>
            <div className="text-lg font-bold text-emerald-700 leading-tight">
              {formatRupiah(grandNet)}
            </div>
          </div>
        </div>
      </div>

      {/* Status bar: badge + warning, satu baris ringkas */}
      <div className="flex items-center gap-3 py-2.5 shrink-0">
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
            header.is_paid === "true"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {header.is_paid === "true" ? "✓ Paid" : "● Unpaid"}
        </span>
        {grandDiscount > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 whitespace-nowrap">
            Diskon +{formatRupiah(grandDiscount)}
          </span>
        )}
        {header.is_paid === "false" && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
            <AlertCircle size={12} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              Akan masuk ke <strong>Committed Cost</strong> sub project
            </p>
          </div>
        )}
      </div>

      {/* ── ORDER LINES: porsi mayoritas tinggi modal ── */}
      <div className="flex-1 flex flex-col min-h-0 pt-2">
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Order Lines
            <span className="ml-2 normal-case font-normal text-gray-300">
              {items.length} lines · total qty {totalQty}
            </span>
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={addItem}>
            <Plus size={14} /> Add Line
          </Button>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-10">
                    #
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">
                    Item Name
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 w-28">
                    Qty
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 w-24">
                    UOM
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 w-44">
                    Unit Price
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 w-40">
                    Discount/Unit
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 w-36">
                    Subtotal
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 w-40">
                    Paid
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <ItemRow
                    key={item._key}
                    item={item}
                    index={i}
                    onChange={changeItem}
                    onRemove={removeItem}
                    catalog={catalog}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          <div className="border-t border-gray-200 bg-gray-50 px-5 py-3.5 shrink-0">
            <div className="flex items-end justify-end gap-10">
              <div className="text-right">
                <div className="text-xs text-gray-400 mb-0.5">
                  Total Invoice
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  {formatRupiah(grandGross)}
                </div>
              </div>
              {grandDiscount > 0 && (
                <div className="text-right">
                  <div className="text-xs text-emerald-500 mb-0.5">
                    Discount Profit
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">
                    +{formatRupiah(grandDiscount)}
                  </div>
                </div>
              )}
              <div className="text-right border-l border-gray-300 pl-10">
                <div className="text-xs text-gray-400 mb-0.5">
                  Total Dibayar
                </div>
                <div className="text-lg font-bold text-emerald-700">
                  {formatRupiah(grandNet)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 shrink-0">
          <Button type="submit" variant="primary" loading={loading}>
            {initial ? "Simpan Perubahan" : "Simpan Purchase Order"}
          </Button>
        </div>
      </div>

      <SupplierLookupModal
        open={supplierLookupOpen}
        onClose={() => setSupplierLookupOpen(false)}
        onSelect={(s) => setH("supplier_id", String(s.id))}
        suppliers={suppliers}
      />

      {/* ── Modal preview foto bon (full size) ── */}
      {photoModalOpen && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-6"
          onClick={() => setPhotoModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative max-w-2xl max-h-[85vh]">
            <img
              src={receiptImgSrc}
              alt="Foto bon"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <button
              type="button"
              onClick={() => setPhotoModalOpen(false)}
              className="absolute top-2 right-2 bg-white/90 text-gray-700 rounded-full p-1.5 hover:bg-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Expanded PO Detail (tabs: items + payments) ──────────
function ExpandedPODetail({ order, onRefresh, suppliers }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("items");

  const { data: payments = [], refetch } = useQuery({
    queryKey: ["po-payments", order.id],
    queryFn: () => materialsApi.getPOPayments(order.id),
  });

  const delPayment = useMutation({
    mutationFn: async (payId) => {
      // Cari payment yang mau dihapus untuk dapat ledger_entry_id
      const payment = payments.find((p) => p.id === payId);

      // Hapus PO payment
      await materialsApi.deletePOPayment(order.id, payId);

      // Hapus ledger entry kalau ada
      if (payment?.ledger_entry_id) {
        try {
          await ledgerApi.delete(payment.ledger_entry_id);
        } catch {
          // Ledger entry mungkin sudah dihapus manual — ignore
        }
      }
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      onRefresh();
      toast.success("Pembayaran & ledger entry dihapus.");
    },
    onError: (e) => toast.error(e.message),
  });

  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalNet = parseFloat(order.total_net || 0);
  const remaining = totalNet - totalPaid;
  const pctPaid =
    totalNet > 0 ? Math.min(100, (totalPaid / totalNet) * 100) : 0;

  return (
    <div className="border-t border-gray-100">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 bg-gray-50/50 border-b border-gray-100">
        {[
          { key: "items", label: `Order Lines (${order.items?.length || 0})` },
          { key: "payments", label: `Pembayaran (${payments.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-all ${
              tab === t.key
                ? "bg-white text-gray-900 border border-b-white border-gray-200 -mb-px z-10"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        {/* Payment status pill */}
        <div className="ml-auto pr-2 pb-1.5">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              order.payment_status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : order.payment_status === "partial"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-red-100 text-red-600"
            }`}
          >
            {order.payment_status === "paid"
              ? "✓ Lunas"
              : order.payment_status === "partial"
                ? `⋯ Partial — ${formatRupiah(totalPaid)} / ${formatRupiah(totalNet)}`
                : "Belum Dibayar"}
          </span>
        </div>
      </div>

      {/* ── Items tab ── */}
      {tab === "items" && (
        <div className="bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-center px-3 py-2 font-medium text-gray-400 w-8">
                  #
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-400">
                  Item
                </th>
                <th className="text-right px-4 py-2 font-medium text-gray-400 w-16">
                  Qty
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-12">
                  Unit
                </th>
                <th className="text-right px-4 py-2 font-medium text-gray-400 w-28">
                  Harga/Unit
                </th>
                <th className="text-right px-4 py-2 font-medium text-gray-400 w-24">
                  Disc/Unit
                </th>
                <th className="text-right px-4 py-2 font-medium text-gray-400 w-28">
                  Subtotal
                </th>
                <th className="text-right px-4 py-2 font-medium text-gray-400 w-28">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items?.map((item, i) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-center text-gray-400">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {item.item_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {parseFloat(item.quantity)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {formatRupiah(item.unit_price)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {parseFloat(item.discount_per_unit) > 0 ? (
                      <span className="text-emerald-600">
                        {formatRupiah(item.discount_per_unit)}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {formatRupiah(item.subtotal_gross)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                    {formatRupiah(item.subtotal_net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td
                  colSpan={6}
                  className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase"
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
                    Discount Profit
                  </td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-emerald-700">
                    +{formatRupiah(order.total_discount)}
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
          {order.receipt_image_url && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Receipt size={11} /> Foto Bon
              </p>
              <a
                href={
                  order.receipt_image_url?.startsWith("http")
                    ? order.receipt_image_url
                    : `${baseURL}${order.receipt_image_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={
                    order.receipt_image_url?.startsWith("http")
                      ? order.receipt_image_url
                      : `${baseURL}${order.receipt_image_url}`
                  }
                  alt="Foto bon"
                  className="max-h-48 rounded-lg border border-gray-200 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Payments tab ── */}
      {tab === "payments" && (
        <div className="bg-white">
          {/* Progress bar */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>
                Terbayar:{" "}
                <strong className="text-gray-800">
                  {formatRupiah(totalPaid)}
                </strong>
              </span>
              <span>
                Total PO:{" "}
                <strong className="text-gray-800">
                  {formatRupiah(totalNet)}
                </strong>
              </span>
              {remaining > 0 && (
                <span className="text-red-500">
                  Sisa: <strong>{formatRupiah(remaining)}</strong>
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctPaid >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{ width: `${pctPaid}%` }}
              />
            </div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-400 w-24">
                    Tanggal
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400">
                    Dibayar Oleh
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 w-20">
                    Bank
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                    Metode
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-gray-400 w-32">
                    Jumlah
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-400">
                    Catatan
                  </th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">
                      {p.paid_by || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {p.bank_account || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 capitalize">
                      {p.payment_method || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatRupiah(p.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 italic">
                      {p.notes || ""}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => {
                          if (confirm("Hapus pembayaran ini?"))
                            delPayment.mutate(p.id);
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <POPaymentForm
            order={order}
            remaining={remaining}
            suppliers={suppliers}
            onPaymentSaved={() => {
              refetch();
              qc.invalidateQueries({ queryKey: ["purchase-orders"] });
              qc.invalidateQueries({ queryKey: ["ledger"] });
              qc.invalidateQueries({ queryKey: ["ledger-summary"] });
              onRefresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Material Report ─────────────────────────────────────────
function MaterialReport({ projects, suppliers }) {
  const [filterProject, setFilterProject] = useState("");
  const [filterSubProject, setFilterSubProject] = useState("");
  const [filterPaid, setFilterPaid] = useState("");
  const [search, setSearch] = useState("");
  const [expandedItem, setExpandedItem] = useState(null);

  const selectedProject = projects.find(
    (p) => p.id === parseInt(filterProject),
  );
  const isContractor = selectedProject?.project_type === "contractor";

  const { data: subProjects = [] } = useQuery({
    queryKey: ["sub-projects-report", filterProject],
    queryFn: () => subProjectsApi.getByProject(parseInt(filterProject)),
    enabled: !!filterProject && isContractor,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: [
      "purchase-orders-report",
      filterProject,
      filterSubProject,
      filterPaid,
    ],
    queryFn: () => {
      const p = {};
      if (filterProject) p.project_id = filterProject;
      if (filterSubProject) p.sub_project_id = filterSubProject;
      if (filterPaid !== "") p.is_paid = filterPaid === "true";
      return materialsApi.getPurchaseOrders(p);
    },
  });

  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const subProjectMap = Object.fromEntries(
    subProjects.map((sp) => [sp.id, sp]),
  );
  const selectedSubProject = subProjects.find(
    (sp) => sp.id === parseInt(filterSubProject),
  );

  // Aggregate items
  const aggregated = (() => {
    const allItems = orders.flatMap((order) =>
      (order.items || []).map((item) => ({
        ...item,
        order_id: order.id,
        order_date: order.purchase_date,
        order_is_paid: order.is_paid,
        project_id: order.project_id,
        sub_project_id: order.sub_project_id,
        supplier_id: order.supplier_id,
      })),
    );
    const filtered = search
      ? allItems.filter((it) =>
          it.item_name.toLowerCase().includes(search.toLowerCase()),
        )
      : allItems;

    const groups = {};
    filtered.forEach((item) => {
      const key = item.item_name.toLowerCase().trim();
      if (!groups[key]) {
        groups[key] = {
          item_name: item.item_name,
          unit: item.unit,
          total_qty: 0,
          total_gross: 0,
          total_net: 0,
          total_discount: 0,
          lines: [],
        };
      }
      groups[key].total_qty += parseFloat(item.quantity) || 0;
      groups[key].total_gross += parseFloat(item.subtotal_gross) || 0;
      groups[key].total_net += parseFloat(item.subtotal_net) || 0;
      groups[key].total_discount += parseFloat(item.discount_total) || 0;
      groups[key].lines.push(item);
    });
    return Object.values(groups).sort((a, b) => b.total_net - a.total_net);
  })();

  const grandGross = aggregated.reduce((s, g) => s + g.total_gross, 0);
  const grandNet = aggregated.reduce((s, g) => s + g.total_net, 0);
  const grandDiscount = aggregated.reduce((s, g) => s + g.total_discount, 0);
  const totalLines = aggregated.reduce((s, g) => s + g.lines.length, 0);

  return (
    <div className="space-y-4">
      {/* Context label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {filterProject ? (
            <>
              {isContractor && (
                <Building2 size={14} className="text-orange-500" />
              )}
              <span className="text-sm font-semibold text-gray-800">
                {selectedProject?.project_name}
              </span>
              {selectedSubProject && (
                <>
                  <span className="text-gray-300">/</span>
                  <Layers size={12} className="text-orange-400" />
                  <span className="text-sm font-medium text-orange-700">
                    {selectedSubProject.name}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-400">Semua Project</span>
          )}
          <span className="text-xs text-gray-400 ml-2">
            · {aggregated.length} jenis · {totalLines} transaksi
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterProject}
          onChange={(e) => {
            setFilterProject(e.target.value);
            setFilterSubProject("");
          }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
        >
          <option value="">Semua Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_type === "contractor" ? "🏗 " : ""}
              {p.project_name}
            </option>
          ))}
        </select>

        {isContractor && subProjects.length > 0 && (
          <select
            value={filterSubProject}
            onChange={(e) => setFilterSubProject(e.target.value)}
            className="text-sm border border-orange-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 w-48"
          >
            <option value="">Semua Sub Project</option>
            {subProjects.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-1.5">
          {[
            { l: "Semua", v: "" },
            { l: "Paid", v: "true" },
            { l: "Unpaid", v: "false" },
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

        <div className="relative ml-auto">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari material..."
            className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
          />
        </div>
      </div>

      {/* Summary cards */}
      {aggregated.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Jenis Material",
              val: aggregated.length,
              sub: `${totalLines} transaksi PO`,
              cls: "border-gray-200 bg-white",
              valCls: "text-gray-800",
            },
            {
              label: "Total Invoice",
              val: formatRupiah(grandGross),
              cls: "border-gray-200 bg-white",
              valCls: "text-gray-800",
            },
            {
              label: "Total Dibayar",
              val: formatRupiah(grandNet),
              cls: "border-gray-200 bg-white",
              valCls: "text-gray-800",
            },
            {
              label: "Discount Profit",
              val: formatRupiah(grandDiscount),
              cls: "border-emerald-200 bg-emerald-50",
              valCls: "text-emerald-700",
            },
          ].map((c, i) => (
            <div key={i} className={`border rounded-xl p-3 ${c.cls}`}>
              <div
                className={`text-xs mb-1 ${i === 3 ? "text-emerald-600" : "text-gray-400"}`}
              >
                {c.label}
              </div>
              <div className={`text-base font-bold ${c.valCls}`}>{c.val}</div>
              {c.sub && (
                <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : aggregated.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-gray-200 rounded-xl">
          <Package size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Belum ada data material.</p>
          <p className="text-xs text-gray-300 mt-1">
            Pilih project di atas atau buat Purchase Order terlebih dahulu.
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-[2fr_90px_70px_150px_150px_130px_36px] text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <div>Material</div>
            <div className="text-right">Total Qty</div>
            <div className="pl-1">UOM</div>
            <div className="text-right">Total Invoice</div>
            <div className="text-right">Total Dibayar</div>
            <div className="text-right">Discount</div>
            <div></div>
          </div>

          {aggregated.map((group, idx) => {
            const isExp = expandedItem === group.item_name;
            const avgPrice =
              group.total_qty > 0 ? group.total_net / group.total_qty : 0;
            return (
              <div
                key={group.item_name}
                className={idx > 0 ? "border-t border-gray-100" : ""}
              >
                <div
                  className="grid grid-cols-[2fr_90px_70px_150px_150px_130px_36px] items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedItem(isExp ? null : group.item_name)
                  }
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800 capitalize">
                      {group.item_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      avg {formatRupiah(Math.round(avgPrice))}/{group.unit} ·{" "}
                      {group.lines.length} transaksi
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-gray-700">
                    {group.total_qty % 1 === 0
                      ? group.total_qty.toFixed(0)
                      : group.total_qty.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 pl-1">{group.unit}</div>
                  <div className="text-right text-sm text-gray-600">
                    {formatRupiah(group.total_gross)}
                  </div>
                  <div className="text-right text-sm font-bold text-gray-800">
                    {formatRupiah(group.total_net)}
                  </div>
                  <div className="text-right text-sm">
                    {group.total_discount > 0 ? (
                      <span className="text-emerald-600 font-medium">
                        +{formatRupiah(group.total_discount)}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {isExp ? (
                      <ChevronUp size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-6 py-2 font-medium text-gray-400 w-28">
                            PO No.
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-400">
                            Supplier
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-400">
                            Project / Sub
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                            Tanggal
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-20">
                            Qty
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                            Harga/Unit
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-24">
                            Disc/Unit
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                            Subtotal
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-400 w-16">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.lines.map((line, li) => {
                          const supplier = supplierMap[line.supplier_id];
                          const project = projectMap[line.project_id];
                          const subProject = subProjectMap[line.sub_project_id];
                          return (
                            <tr
                              key={li}
                              className="hover:bg-white transition-colors"
                            >
                              <td className="px-6 py-2">
                                <span className="font-mono font-bold text-emerald-700">
                                  PO-{String(line.order_id).padStart(5, "0")}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {supplier?.store_name || "-"}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                <div>{project?.project_name || "-"}</div>
                                {subProject && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Layers
                                      size={9}
                                      className="text-orange-400"
                                    />
                                    <span className="text-orange-600">
                                      {subProject.name}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-500">
                                {formatDate(line.order_date)}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-700">
                                {parseFloat(line.quantity) % 1 === 0
                                  ? parseFloat(line.quantity).toFixed(0)
                                  : parseFloat(line.quantity).toFixed(1)}{" "}
                                {line.unit}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {formatRupiah(line.unit_price)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {parseFloat(line.discount_per_unit) > 0 ? (
                                  <span className="text-emerald-600">
                                    {formatRupiah(line.discount_per_unit)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                {formatRupiah(line.subtotal_net)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full font-medium ${
                                    line.order_is_paid
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {line.order_is_paid ? "Paid" : "Open"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-white">
                          <td
                            colSpan={4}
                            className="px-6 py-2 text-xs font-semibold text-gray-500 uppercase"
                          >
                            Subtotal {group.item_name}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-gray-700">
                            {group.total_qty % 1 === 0
                              ? group.total_qty.toFixed(0)
                              : group.total_qty.toFixed(1)}{" "}
                            {group.unit}
                          </td>
                          <td colSpan={2} className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">
                            {formatRupiah(group.total_net)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="grid grid-cols-[2fr_90px_70px_150px_150px_130px_36px] border-t-2 border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Grand Total ({aggregated.length} jenis material)
            </div>
            <div />
            <div />
            <div className="text-right text-sm font-semibold text-gray-700">
              {formatRupiah(grandGross)}
            </div>
            <div className="text-right text-sm font-bold text-emerald-700">
              {formatRupiah(grandNet)}
            </div>
            <div className="text-right text-sm font-semibold text-emerald-600">
              {grandDiscount > 0 ? `+${formatRupiah(grandDiscount)}` : "-"}
            </div>
            <div />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function Materials() {
  const qc = useQueryClient();
  const [pageTab, setPageTab] = useState("po"); // "po" | "report"
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterSubProject, setFilterSubProject] = useState("");
  const [filterPaid, setFilterPaid] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.getAll,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: materialsApi.getSuppliers,
  });
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog"],
    queryFn: materialsApi.getCatalog,
  });

  const selectedFilterProject = projects.find(
    (p) => p.id === parseInt(filterProject),
  );
  const isContractorFilter =
    selectedFilterProject?.project_type === "contractor";

  const { data: filterSubProjects = [] } = useQuery({
    queryKey: ["sub-projects-filter", filterProject],
    queryFn: () => subProjectsApi.getByProject(parseInt(filterProject)),
    enabled: !!filterProject && isContractorFilter,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", filterProject, filterSubProject, filterPaid],
    queryFn: () => {
      const p = {};
      if (filterProject) p.project_id = filterProject;
      if (filterSubProject) p.sub_project_id = filterSubProject;
      if (filterPaid !== "") p.is_paid = filterPaid === "true";
      return materialsApi.getPurchaseOrders(p);
    },
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

  // Collect unique contractor project IDs from orders
  const contractorProjectIds = [
    ...new Set(
      orders
        .filter(
          (o) =>
            o.sub_project_id &&
            projectMap[o.project_id]?.project_type === "contractor",
        )
        .map((o) => o.project_id),
    ),
  ];

  // Fetch sub projects for all contractor projects that appear in orders
  const { data: allSubProjects = [] } = useQuery({
    queryKey: ["sub-projects-all-in-orders", contractorProjectIds.join(",")],
    queryFn: async () => {
      if (!contractorProjectIds.length) return [];
      const results = await Promise.all(
        contractorProjectIds.map((pid) => subProjectsApi.getByProject(pid)),
      );
      return results.flat();
    },
    enabled: contractorProjectIds.length > 0,
  });

  // Build name map: id → name (from filter dropdown + all fetched sub projects)
  const subProjectNameMap = {};
  filterSubProjects.forEach((sp) => {
    subProjectNameMap[sp.id] = sp.name;
  });
  allSubProjects.forEach((sp) => {
    subProjectNameMap[sp.id] = sp.name;
  });

  const totalGross = orders.reduce(
    (s, o) => s + parseFloat(o.total_gross || 0),
    0,
  );
  const totalNet = orders.reduce((s, o) => s + parseFloat(o.total_net || 0), 0);
  const totalDiscount = orders.reduce(
    (s, o) => s + parseFloat(o.total_discount || 0),
    0,
  );
  const unpaidTotal = orders
    .filter((o) => !o.is_paid)
    .reduce((s, o) => s + parseFloat(o.total_net || 0), 0);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Materials</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pageTab === "po"
              ? `${orders.length} purchase orders · ${orders.filter((o) => !o.is_paid).length} belum dibayar`
              : "Rekapitulasi material per project"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setPageTab("po")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageTab === "po"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ShoppingCart size={13} /> Purchase Orders
            </button>
            <button
              onClick={() => setPageTab("report")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageTab === "report"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <BarChart3 size={13} /> Material Report
            </button>
            <button
              onClick={() => setPageTab("aging")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageTab === "aging"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Receipt size={13} /> Hutang Supplier
            </button>
          </div>
          {pageTab === "po" && (
            <Button
              variant="primary"
              onClick={() => {
                setEditData(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* ── PURCHASE ORDERS TAB ── */}
      {pageTab === "po" && (
        <>
          {/* Summary Cards */}
          {orders.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">
                  Total Invoice Amount
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatRupiah(totalGross)}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Total Paid</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatRupiah(totalNet - unpaidTotal)}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs text-red-500 mb-1">
                  Outstanding (Unpaid)
                </p>
                <p className="text-lg font-semibold text-red-600">
                  {formatRupiah(unpaidTotal)}
                </p>
                <p className="text-xs text-red-400 mt-0.5">
                  {orders.filter((o) => !o.is_paid).length} PO belum lunas
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

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value);
                setFilterSubProject("");
              }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_type === "contractor" ? "🏗 " : ""}
                  {p.project_name}
                </option>
              ))}
            </select>

            {isContractorFilter && filterSubProjects.length > 0 && (
              <select
                value={filterSubProject}
                onChange={(e) => setFilterSubProject(e.target.value)}
                className="text-sm border border-orange-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 w-48"
              >
                <option value="">All Sub Projects</option>
                {filterSubProjects.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            )}

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
                <p className="text-sm text-gray-400">
                  No purchase orders found.
                </p>
              </div>
            </Card>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* Table Header */}
              <div className="grid grid-cols-[100px_1fr_1fr_110px_90px_80px_90px_130px_130px_80px] text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                <div>PO No.</div>
                <div>Supplier</div>
                <div>Project / Sub</div>
                <div>Tanggal</div>
                <div>Order By</div>
                <div>Receipt</div>
                <div className="text-center">Status</div>
                <div className="text-right">Invoice</div>
                <div className="text-right">Dibayar</div>
                <div></div>
              </div>

              {orders.map((order, idx) => {
                const isExp = expandedId === order.id;
                const supplier = supplierMap[order.supplier_id];
                const project = projectMap[order.project_id];
                const isContr = project?.project_type === "contractor";
                const hasDisc = parseFloat(order.total_discount) > 0;

                return (
                  <div
                    key={order.id}
                    className={idx > 0 ? "border-t border-gray-100" : ""}
                  >
                    {/* Row */}
                    <div className="grid grid-cols-[100px_1fr_1fr_110px_90px_80px_90px_130px_130px_80px] items-center px-3 py-3 hover:bg-gray-50 transition-colors">
                      {/* PO No */}
                      <div>
                        <span className="text-sm font-mono font-bold text-emerald-700">
                          PO-{String(order.id).padStart(5, "0")}
                        </span>
                      </div>

                      {/* Supplier */}
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {supplier?.store_name || (
                            <span className="text-gray-300 italic text-xs">
                              -
                            </span>
                          )}
                        </div>
                        {supplier?.phone && (
                          <div className="text-xs text-gray-400">
                            {supplier.phone}
                          </div>
                        )}
                      </div>

                      {/* Project + Sub Project */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          {isContr && (
                            <Building2
                              size={11}
                              className="text-orange-400 shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {project?.project_name || (
                              <span className="text-gray-300 italic text-xs">
                                -
                              </span>
                            )}
                          </span>
                        </div>
                        {order.sub_project_id && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Layers size={10} className="text-orange-400" />
                            <span className="text-xs text-orange-600 font-medium">
                              {subProjectNameMap[order.sub_project_id] ||
                                `Sub #${order.sub_project_id}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      <div className="text-sm text-gray-600">
                        {formatDate(order.purchase_date)}
                      </div>

                      {/* Ordered By */}
                      <div className="text-sm text-gray-600">
                        {order.ordered_by || "-"}
                      </div>

                      {/* Receipt */}
                      <div>
                        {order.has_receipt ? (
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            <Receipt size={12} />
                            {receiptLabel[order.receipt_type]}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            order.payment_status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : order.payment_status === "partial"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-600"
                          }`}
                        >
                          {order.payment_status === "paid"
                            ? "✓ Paid"
                            : order.payment_status === "partial"
                              ? "⋯ Partial"
                              : "Unpaid"}
                        </span>
                        {order.payment_status === "partial" && (
                          <div className="text-xs text-blue-500 mt-0.5">
                            {formatRupiah(order.total_paid)} /{" "}
                            {formatRupiah(order.total_net)}
                          </div>
                        )}
                      </div>

                      {/* Invoice */}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">
                          {formatRupiah(order.total_gross)}
                        </div>
                        {hasDisc && (
                          <div className="text-xs text-emerald-600">
                            -{formatRupiah(order.total_discount)}
                          </div>
                        )}
                      </div>

                      {/* Paid Amount */}
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700">
                          {formatRupiah(order.total_net)}
                        </div>
                        {!order.is_paid && (
                          <div className="text-xs text-red-400">committed</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleEdit(order)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(order.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExp ? null : order.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          {isExp ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: tabbed view — Order Lines + Payments */}
                    {isExp && (
                      <ExpandedPODetail
                        order={order}
                        onRefresh={inv}
                        suppliers={suppliers}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal Full Screen */}
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
            size="full"
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
        </>
      )}

      {/* ── MATERIAL REPORT TAB ── */}
      {pageTab === "report" && (
        <MaterialReport projects={projects} suppliers={suppliers} />
      )}
      {pageTab === "aging" && <SupplierAgingReport />}
    </div>
  );
}
