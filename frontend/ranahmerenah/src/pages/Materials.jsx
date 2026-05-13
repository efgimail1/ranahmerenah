import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { projectsApi } from "../api/projects";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import Input, { Select, CurrencyInput } from "../components/ui/Input";
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
  ChevronDown,
  ChevronUp,
  X,
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
  { value: "physical", label: "Bon Fisik" },
  { value: "digital", label: "Foto Digital" },
  { value: "both", label: "Keduanya" },
];

// ─── Empty item row ────────────────────────────────────────
// BARU
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

// ─── Item Row Component ────────────────────────────────────
function ItemRow({ item, index, onChange, onRemove, catalog }) {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(parseCurrency(item.unit_price)) || 0;
  const discount = parseFloat(parseCurrency(item.discount_per_unit)) || 0;
  const gross = qty * price;
  const net = qty * (price - discount);
  const profit = qty * discount;

  const handleCatalogSelect = (catalogId) => {
    if (!catalogId) {
      onChange(index, "catalog_item_id", null);
      return;
    }
    const found = catalog.find((c) => c.id === parseInt(catalogId));
    if (found) {
      onChange(index, "catalog_item_id", found.id);
      onChange(index, "item_name", found.name);
      onChange(index, "unit", found.default_unit || "pcs");
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">
          Barang {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Pilih dari katalog */}
        <Select
          label="Pilih dari Katalog"
          value={item.catalog_item_id || ""}
          onChange={(e) => handleCatalogSelect(e.target.value)}
        >
          <option value="">-- Ketik manual / pilih katalog --</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {/* Nama barang */}
        <Input
          label="Nama Barang *"
          value={item.item_name}
          onChange={(e) => onChange(index, "item_name", e.target.value)}
          placeholder="nama barang"
          required
        />

        {/* Qty & Satuan */}
        <Input
  label="Jumlah *"
  type="text"
  inputMode="decimal"
  value={item.quantity}
  onChange={e => {
    // hanya izinkan angka dan koma/titik
    const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.')
    onChange(index, 'quantity', val)
  }}
  onWheel={e => e.target.blur()} // cegah scroll mengubah nilai
  placeholder="0"
  required
/>
        <Select
          label="Satuan"
          value={item.unit}
          onChange={(e) => onChange(index, "unit", e.target.value)}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>

        {/* Harga & Diskon */}
        <CurrencyInput
          label="Harga Satuan (di bon)"
          value={item.unit_price}
          onChange={(val) => onChange(index, "unit_price", val)}
          placeholder="0"
        />
        <CurrencyInput
          label="Diskon per Satuan"
          value={item.discount_per_unit}
          onChange={(val) => onChange(index, "discount_per_unit", val)}
          placeholder="0"
        />
      </div>

      {/* Mini kalkulasi */}
      {qty > 0 && price > 0 && (
        <div className="flex gap-4 pt-2 border-t border-gray-100 text-xs flex-wrap">
          <span className="text-gray-500">
            Subtotal bon:{" "}
            <strong className="text-gray-800">{formatRupiah(gross)}</strong>
          </span>
          {discount > 0 && (
            <>
              <span className="text-gray-500">
                Bayar:{" "}
                <strong className="text-gray-800">{formatRupiah(net)}</strong>
              </span>
              <span className="text-emerald-600 font-medium">
                + diskon: {formatRupiah(profit)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Purchase Order Form ───────────────────────────────────
function PurchaseOrderForm({
  initial,
  onSubmit,
  loading,
  projects,
  suppliers,
  catalog,
}) {
  const empty = {
    project_id: "",
    supplier_id: "",
    purchase_date: "",
    is_paid: false,
    paid_by: "architect",
    has_receipt: false,
    receipt_type: "physical",
    notes: "",
  };

  const [header, setHeader] = useState(
    initial
      ? {
          project_id: initial.project_id || "",
          supplier_id: initial.supplier_id || "",
          purchase_date: toInputDate(initial.purchase_date),
          is_paid: initial.is_paid,
          paid_by: initial.paid_by || "architect",
          has_receipt: initial.has_receipt,
          receipt_type: initial.receipt_type || "physical",
          notes: initial.notes || "",
        }
      : empty,
  );

  // BARU — parseFloat dulu supaya 1.000 jadi 1, bukan string "1.000"
  const [items, setItems] = useState(
    initial?.items?.length
      ? initial.items.map((it) => ({
          _key: ++_keyCounter,
          catalog_item_id: it.catalog_item_id || null,
          item_name: it.item_name,
          quantity: String(parseFloat(it.quantity)), // ← FIX
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

  const changeItem = (i, field, val) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)),
    );
  };

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (i) => {
    if (items.length === 1) return toast.error("Minimal 1 barang");
    setItems((p) => p.filter((_, idx) => idx !== i));
  };

  // grand total preview
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...header,
      project_id: header.project_id ? parseInt(header.project_id) : null,
      supplier_id: header.supplier_id ? parseInt(header.supplier_id) : null,
      is_paid: header.is_paid === true || header.is_paid === "true",
      has_receipt: header.has_receipt === true || header.has_receipt === "true",
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header Nota */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Header Nota
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Proyek"
            value={header.project_id}
            onChange={(e) => setH("project_id", e.target.value)}
          >
            <option value="">-- Pilih Proyek --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </Select>
          <Select
            label="Supplier / Toko"
            value={header.supplier_id}
            onChange={(e) => setH("supplier_id", e.target.value)}
          >
            <option value="">-- Pilih Supplier --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.store_name}
              </option>
            ))}
          </Select>
          <Input
            label="Tanggal Beli *"
            type="date"
            value={header.purchase_date}
            onChange={(e) => setH("purchase_date", e.target.value)}
            required
          />
          <Select
            label="Status Bayar"
            value={header.is_paid}
            onChange={(e) => setH("is_paid", e.target.value)}
          >
            <option value="false">Belum Dibayar</option>
            <option value="true">Sudah Dibayar</option>
          </Select>
          <Select
            label="Dibayar Oleh"
            value={header.paid_by}
            onChange={(e) => setH("paid_by", e.target.value)}
          >
            {PAID_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Ada Bon?"
            value={header.has_receipt}
            onChange={(e) => setH("has_receipt", e.target.value)}
          >
            <option value="false">Tidak Ada</option>
            <option value="true">Ada</option>
          </Select>
          {(header.has_receipt === true || header.has_receipt === "true") && (
            <Select
              label="Tipe Bon"
              value={header.receipt_type}
              onChange={(e) => setH("receipt_type", e.target.value)}
            >
              {RECEIPT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Catatan"
            value={header.notes}
            onChange={(e) => setH("notes", e.target.value)}
            placeholder="opsional"
            className="col-span-2"
          />
        </div>
      </div>

      {/* Daftar Barang */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Daftar Barang ({items.length} item)
          </h4>
          <Button type="button" variant="ghost" size="sm" onClick={addItem}>
            <Plus size={14} /> Tambah Barang
          </Button>
        </div>

        <div className="space-y-3">
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
        </div>

        {/* Grand Total */}
        {grandGross > 0 && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Harga Bon</span>
              <span className="font-medium">{formatRupiah(grandGross)}</span>
            </div>
            {grandDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Diskon (keuntungan)</span>
                <span className="font-medium text-emerald-600">
                  + {formatRupiah(grandDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-emerald-200 pt-1.5">
              <span>Total Dibayarkan</span>
              <span className="text-emerald-700">{formatRupiah(grandNet)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? "Simpan Perubahan" : "Simpan Nota"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Materials() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterPaid, setFilterPaid] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", filterProjectId, filterPaid],
    queryFn: () => {
      const params = {};
      if (filterProjectId) params.project_id = filterProjectId;
      if (filterPaid !== "") params.is_paid = filterPaid === "true";
      return materialsApi.getPurchaseOrders(params);
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

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });

  const createMutation = useMutation({
    mutationFn: materialsApi.createPurchaseOrder,
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      toast.success("Nota pembelian disimpan!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: materialsApi.deletePurchaseOrder,
    onSuccess: () => {
      invalidate();
      toast.success("Nota dihapus.");
    },
    onError: (err) => toast.error(err.message),
  });

  // BARU
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialsApi.updatePurchaseOrder(id, data),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setEditData(null);
      toast.success("Nota berhasil diupdate!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (id) => {
    if (confirm("Yakin hapus nota ini? Semua barang di nota ikut terhapus.")) {
      deleteMutation.mutate(id);
    }
  };

  const supplierMap = Object.fromEntries(
    suppliers.map((s) => [s.id, s.store_name]),
  );
  const projectMap = Object.fromEntries(
    projects.map((p) => [p.id, p.project_name]),
  );

  const totalGross = orders.reduce(
    (s, o) => s + parseFloat(o.total_gross || 0),
    0,
  );
  const totalNet = orders.reduce((s, o) => s + parseFloat(o.total_net || 0), 0);
  const totalDiscount = orders.reduce(
    (s, o) => s + parseFloat(o.total_discount || 0),
    0,
  );

  const paidByLabel = {
    architect: "Arsitek",
    owner: "Pemilik",
    other: "Lainnya",
  };
  const receiptLabel = {
    physical: "Fisik",
    digital: "Digital",
    both: "Fisik & Digital",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Pembelian Material
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {orders.length} nota · {orders.filter((o) => !o.is_paid).length}{" "}
            belum dibayar
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditData(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Tambah Nota
        </Button>
      </div>

      {/* Summary */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Harga Bon</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatRupiah(totalGross)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Dibayarkan</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatRupiah(totalNet)}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-600 mb-1">
              Total Keuntungan Diskon
            </p>
            <p className="text-lg font-semibold text-emerald-700">
              {formatRupiah(totalDiscount)}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="w-48"
        >
          <option value="">Semua Proyek</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </Select>
        <div className="flex gap-1.5">
          {[
            { label: "Semua", value: "" },
            { label: "Belum Bayar", value: "false" },
            { label: "Sudah Bayar", value: "true" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterPaid(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterPaid === f.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Nota */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Package size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">Belum ada nota pembelian.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            return (
              <Card key={order.id} padding={false}>
                {/* Header */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {formatDate(order.purchase_date)}
                      </span>
                      <Badge color={order.is_paid ? "green" : "red"}>
                        {order.is_paid ? "Lunas" : "Hutang"}
                      </Badge>
                      {order.has_receipt && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Receipt size={12} />
                          {receiptLabel[order.receipt_type] || ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      {order.supplier_id && (
                        <span>🏪 {supplierMap[order.supplier_id]}</span>
                      )}
                      {order.project_id && (
                        <span>📁 {projectMap[order.project_id]}</span>
                      )}
                      {order.paid_by && (
                        <span>👤 {paidByLabel[order.paid_by]}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-400">Total Bon</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatRupiah(order.total_gross)}
                    </div>
                    {parseFloat(order.total_discount) > 0 && (
                      <div className="text-xs text-emerald-600">
                        diskon: {formatRupiah(order.total_discount)}
                      </div>
                    )}
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-xs text-gray-400">Dibayarkan</div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatRupiah(order.total_net)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditData(order);
                        setModalOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : order.id)
                      }
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      {isExpanded ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Detail Items */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">
                            Barang
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400">
                            Qty
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                            Harga Satuan
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                            Diskon
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">
                            Subtotal Bon
                          </th>
                          <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">
                            Dibayar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.items.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-white transition-colors"
                          >
                            <td className="px-5 py-2.5 font-medium text-gray-800">
                              {item.item_name}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {parseFloat(item.quantity)} {item.unit}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-600">
                              {formatRupiah(item.unit_price)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {parseFloat(item.discount_per_unit) > 0 ? (
                                <span className="text-emerald-600">
                                  {formatRupiah(item.discount_total)}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              {formatRupiah(item.subtotal_gross)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-semibold text-gray-900">
                              {formatRupiah(item.subtotal_net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
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
        title={editData ? "Edit Nota Pembelian" : "Tambah Nota Pembelian"}
        size="xl"
      >
        <PurchaseOrderForm
          key={editData?.id ?? "new"}
          initial={editData}
          onSubmit={handleSubmit}
          loading={createMutation.isPending}
          projects={projects}
          suppliers={suppliers}
          catalog={catalog}
        />
      </Modal>
    </div>
  );
}
