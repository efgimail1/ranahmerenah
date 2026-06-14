import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { formatRupiah, formatDate } from "../utils/format";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import toast from "react-hot-toast";
import {
  Search, Plus, Pencil, Trash2,  Tag, RefreshCw, Store, FileText, ClipboardList,
  ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";

const UNIT_OPTIONS = [
  "pcs","m²","m³","m","sak","batang","lembar","roll","set","unit",
  "kg","liter","dus","lonjor","truck","kubik","lainnya",
];

// ─── Add / Edit Price Form ──────────────────────────────────
function PriceForm({ initial, suppliers, catalog, onSubmit, loading, onClose }) {
  const [form, setForm] = useState({
    supplier_id:     initial?.supplier_id     || "",
    catalog_item_id: initial?.catalog_item_id || "",
    item_name:       initial?.item_name       || "",
    unit:            initial?.unit            || "pcs",
    price:           initial?.price ? String(Math.round(parseFloat(initial.price))) : "",
    effective_date:  initial?.effective_date  || new Date().toISOString().split("T")[0],
    notes:           initial?.notes           || "",
  });
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCatalogChange = (val) => {
    const item = catalog.find(c => c.id === parseInt(val));
    setF("catalog_item_id", val);
    if (item) { setF("item_name", item.name); setF("unit", item.default_unit || "pcs"); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.supplier_id) return toast.error("Pilih supplier");
    if (!form.item_name)   return toast.error("Nama item harus diisi");
    if (!form.price)       return toast.error("Harga harus diisi");
    onSubmit({
      supplier_id:     parseInt(form.supplier_id),
      catalog_item_id: form.catalog_item_id ? parseInt(form.catalog_item_id) : null,
      item_name:       form.item_name,
      unit:            form.unit,
      price:           parseFloat(String(form.price).replace(/\D/g,"")),
      effective_date:  form.effective_date || null,
      notes:           form.notes || null,
    });
  };

  const fL = "text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block";
  const fI = "rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={fL}>Supplier *</label>
          <select value={form.supplier_id} onChange={e=>setF("supplier_id",e.target.value)} required className={fI}>
            <option value="">-- Pilih Supplier --</option>
            {suppliers.map(s=><option key={s.id} value={s.id}>{s.store_name}</option>)}
          </select>
        </div>
        <div>
          <label className={fL}>Dari Katalog (opsional)</label>
          <select value={form.catalog_item_id} onChange={e=>handleCatalogChange(e.target.value)} className={fI}>
            <option value="">-- Tidak dari katalog --</option>
            {catalog.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={fL}>Nama Item *</label>
          <input type="text" value={form.item_name} onChange={e=>setF("item_name",e.target.value)}
            placeholder="e.g. Pasir Beton" required className={fI}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fL}>Harga *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Rp</span>
              <input type="text" inputMode="numeric"
                value={form.price ? new Intl.NumberFormat("id-ID").format(String(form.price).replace(/\D/g,"")) : ""}
                onChange={e=>setF("price",e.target.value.replace(/\D/g,""))}
                placeholder="0" required className={`${fI} pl-8`}/>
            </div>
          </div>
          <div>
            <label className={fL}>Satuan</label>
            <select value={form.unit} onChange={e=>setF("unit",e.target.value)} className={fI}>
              {UNIT_OPTIONS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={fL}>Tanggal Berlaku</label>
          <input type="date" value={form.effective_date} onChange={e=>setF("effective_date",e.target.value)} className={fI}/>
        </div>
        <div>
          <label className={fL}>Catatan</label>
          <input type="text" value={form.notes} onChange={e=>setF("notes",e.target.value)}
            placeholder="e.g. Per truck isi 5m³" className={fI}/>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? "Simpan Perubahan" : "Tambah Harga"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function PriceComparison() {
  const qc = useQueryClient();
  const [search, setSearch]       = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData]   = useState(null);
  const [expanded, setExpanded]   = useState({}); // { item_key: bool }
  const [viewMode, setViewMode]   = useState("item"); // "item" | "supplier"

  const { data: suppliers = [] } = useQuery({ queryKey:["suppliers"], queryFn: materialsApi.getSuppliers });
  const { data: catalog   = [] } = useQuery({ queryKey:["catalog"],   queryFn: materialsApi.getCatalog });

  // Listed prices (manual quotations)
  const { data: listedPrices = [], isLoadingL, refetch } = useQuery({
    queryKey: ["prices-listed"],
    queryFn:  () => materialsApi.comparePrices({}),
  });

  // Actual prices from ALL purchase orders
  const { data: allOrders = [], isLoadingO } = useQuery({
    queryKey: ["purchase-orders-all-for-prices"],
    queryFn:  () => materialsApi.getPurchaseOrders({}),
  });

  const isLoading = isLoadingL || isLoadingO;

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  // ── Build unified price entries ─────────────────────────
  const unifiedGroups = useMemo(() => {
    // 1. From listed prices → source: "quoted"
    const entries = listedPrices.map(p => ({
      id:          `q-${p.id}`,
      raw_id:      p.id,
      source:      "quoted",
      supplier_id: p.supplier_id,
      supplier_name: p.supplier_name || supplierMap[p.supplier_id]?.store_name || "-",
      item_name:   p.item_name,
      unit:        p.unit,
      price:       parseFloat(p.price),
      net_price:   parseFloat(p.price), // no discount on quoted
      discount:    0,
      date:        p.effective_date,
      notes:       p.notes,
      order_id:    null,
    }));

    // 2. From PO items → source: "actual"
    allOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const netUnit = parseFloat(item.unit_price) - parseFloat(item.discount_per_unit || 0);
        entries.push({
          id:           `a-${item.id}`,
          raw_id:       null,
          source:       "actual",
          supplier_id:  order.supplier_id,
          supplier_name: supplierMap[order.supplier_id]?.store_name || "-",
          item_name:    item.item_name,
          unit:         item.unit,
          price:        parseFloat(item.unit_price),
          net_price:    netUnit,
          discount:     parseFloat(item.discount_per_unit || 0),
          date:         order.purchase_date,
          notes:        null,
          order_id:     order.id,
          is_paid:      order.is_paid,
          qty:          parseFloat(item.quantity),
        });
      });
    });

    // 3. Filter by search
    const filtered = search
      ? entries.filter(e => e.item_name.toLowerCase().includes(search.toLowerCase()))
      : entries;

    // 4. Group by normalized item_name
    const groups = {};
    filtered.forEach(e => {
      const key = e.item_name.toLowerCase().trim();
      if (!groups[key]) groups[key] = { item_name: e.item_name, unit: e.unit, entries: [] };
      groups[key].entries.push(e);
    });

    // 5. For each group, find cheapest net_price per supplier (dedup)
    //    Sort: quoted first then actual, within each by net_price asc
    return Object.values(groups).map(g => {
      // Deduplicate: per supplier, keep all actuals (history) but only latest quoted
      const quotedBySupplier = {};
      const actualEntries    = [];

      g.entries.forEach(e => {
        if (e.source === "quoted") {
          const sid = e.supplier_id;
          if (!quotedBySupplier[sid] || new Date(e.date) > new Date(quotedBySupplier[sid].date)) {
            quotedBySupplier[sid] = e;
          }
        } else {
          actualEntries.push(e);
        }
      });

      const quotedEntries = Object.values(quotedBySupplier);

      // Best net price across all entries for ranking
      const allNetPrices = [...quotedEntries, ...actualEntries].map(e => e.net_price).filter(p => p > 0);
      const minPrice     = Math.min(...allNetPrices);
      const maxPrice     = Math.max(...allNetPrices);

      // Sort: cheapest first
      const sortedQuoted = [...quotedEntries].sort((a,b) => a.net_price - b.net_price);
      const sortedActual = [...actualEntries].sort((a,b) => new Date(b.date) - new Date(a.date));

      // Detect variance alerts: actual > quoted by >5% for same supplier
      const alerts = [];
      actualEntries.forEach(act => {
        const quoted = quotedBySupplier[act.supplier_id];
        if (quoted && act.net_price > quoted.net_price * 1.05) {
          alerts.push({
            supplier: act.supplier_name,
            diff: act.net_price - quoted.net_price,
            pct: ((act.net_price - quoted.net_price) / quoted.net_price * 100).toFixed(1),
          });
        }
      });

      return {
        key:          g.item_name.toLowerCase().trim(),
        item_name:    g.item_name,
        unit:         g.unit,
        quotedEntries: sortedQuoted,
        actualEntries: sortedActual,
        minPrice,
        maxPrice,
        spread:       maxPrice - minPrice,
        alerts:       [...new Map(alerts.map(a => [a.supplier, a])).values()],
        totalEntries: quotedEntries.length + actualEntries.length,
      };
    }).sort((a,b) => b.totalEntries - a.totalEntries || a.item_name.localeCompare(b.item_name));
  }, [listedPrices, allOrders, search, supplierMap]);

  // Mutations
  const inv = () => {
    qc.invalidateQueries({ queryKey: ["prices-listed"] });
    qc.invalidateQueries({ queryKey: ["purchase-orders-all-for-prices"] });
  };
  const createMutation = useMutation({
    mutationFn: ({ supplier_id, ...data }) => materialsApi.addSupplierPrice(supplier_id, { supplier_id, ...data }),
    onSuccess:  () => { inv(); setModalOpen(false); toast.success("Harga ditambahkan!"); },
    onError:    e  => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => materialsApi.updateSupplierPrice(id, data),
    onSuccess:  () => { inv(); setModalOpen(false); setEditData(null); toast.success("Harga diupdate!"); },
    onError:    e  => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: materialsApi.deleteSupplierPrice,
    onSuccess:  () => { inv(); toast.success("Harga dihapus."); },
    onError:    e  => toast.error(e.message),
  });

  const handleSubmit = (data) => {
    if (editData) updateMutation.mutate({ id: editData.raw_id, data });
    else createMutation.mutate(data);
  };

  const toggleExpand = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  // ── Supplier view: aggregate all data per supplier ──────
  const bySupplier = useMemo(() => {
    return suppliers.map(s => {
      const qPrices = listedPrices.filter(p => p.supplier_id === s.id);
      const aPrices = allOrders.flatMap(o =>
        o.supplier_id === s.id
          ? (o.items || []).map(it => ({
              item_name: it.item_name, unit: it.unit,
              net_price: parseFloat(it.unit_price) - parseFloat(it.discount_per_unit || 0),
              date: o.purchase_date, order_id: o.id,
            }))
          : []
      );
      return { supplier: s, quoted: qPrices, actual: aPrices };
    }).filter(s => s.quoted.length > 0 || s.actual.length > 0);
  }, [suppliers, listedPrices, allOrders]);

  const totalItems  = unifiedGroups.length;
  const totalAlerts = unifiedGroups.reduce((s, g) => s + g.alerts.length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Price Comparison</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalItems} jenis material · harga otomatis dari PO + quotation manual
            {totalAlerts > 0 && (
              <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                ⚠ {totalAlerts} harga aktual melebihi quotation
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode("item")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode==="item" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>Per Item</button>
            <button onClick={() => setViewMode("supplier")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode==="supplier" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>Per Supplier</button>
          </div>
          <Button variant="primary" onClick={() => { setEditData(null); setModalOpen(true); }}>
            <Plus size={16}/> Tambah Quotation
          </Button>
        </div>
      </div>

      {/* Search + stats */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama material..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
        </div>
        <button onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["purchase-orders-all-for-prices"] }); }}
          className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-all" title="Refresh">
          <RefreshCw size={15}/>
        </button>
        <div className="flex items-center gap-4 text-xs text-gray-400 ml-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>
            Quotation manual: {listedPrices.length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>
            Dari PO: {allOrders.reduce((s,o)=>s+(o.items?.length||0),0)} transaksi
          </span>
        </div>
      </div>

      {/* ── VIEW: Per Item ── */}
      {viewMode === "item" && (
        isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"/>
          </div>
        ) : unifiedGroups.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
            <Tag size={28} className="mx-auto text-gray-300 mb-3"/>
            <p className="text-sm text-gray-500 font-medium">Belum ada data harga</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Data akan muncul otomatis saat ada Purchase Order, atau tambahkan quotation manual.
            </p>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus size={14}/> Tambah Quotation Manual
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {unifiedGroups.map(group => {
              const isExp = expanded[group.key];
              return (
                <div key={group.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                  {/* ── Item header ── */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpand(group.key)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                        <Tag size={14} className="text-emerald-600"/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 capitalize">{group.item_name}</h3>
                          {group.alerts.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle size={10}/> harga melebihi quotation
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400">{group.unit}</span>
                          {group.quotedEntries.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <ClipboardList size={10}/> {group.quotedEntries.length} quotation
                            </span>
                          )}
                          {group.actualEntries.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <FileText size={10}/> {group.actualEntries.length} PO aktual
                            </span>
                          )}
                          {group.spread > 0 && (
                            <span className="text-xs text-orange-500">
                              selisih {formatRupiah(group.spread)}/{group.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Price range summary */}
                      <div className="text-right">
                        <div className="text-xs text-gray-400 mb-0.5">Harga terbaik – termahal</div>
                        <div className="text-sm font-bold text-gray-800">
                          {group.minPrice === group.maxPrice
                            ? formatRupiah(group.minPrice)
                            : `${formatRupiah(group.minPrice)} – ${formatRupiah(group.maxPrice)}`}
                          <span className="text-xs font-normal text-gray-400 ml-1">/{group.unit}</span>
                        </div>
                      </div>
                      {isExp
                        ? <ChevronUp size={16} className="text-gray-400 shrink-0"/>
                        : <ChevronDown size={16} className="text-gray-400 shrink-0"/>}
                    </div>
                  </div>

                  {/* ── Collapsed summary: best price per supplier ── */}
                  {!isExp && (group.quotedEntries.length > 0 || group.actualEntries.length > 0) && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-50">
                          {/* Show best quoted price per supplier */}
                          {group.quotedEntries.map((e, i) => {
                            const pct = group.minPrice > 0
                              ? ((e.net_price - group.minPrice) / group.minPrice * 100) : 0;
                            const isBest = e.net_price === group.minPrice;
                            // Latest actual from same supplier
                            const latestActual = group.actualEntries
                              .filter(a => a.supplier_id === e.supplier_id)
                              .sort((a,b) => new Date(b.date)-new Date(a.date))[0];
                            const actualDiff = latestActual
                              ? latestActual.net_price - e.net_price : null;

                            return (
                              <tr key={e.id} className={`${isBest ? "bg-emerald-50/40" : ""} hover:bg-gray-50 transition-colors`}>
                                <td className="px-5 py-3 w-8">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isBest ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                                  }`}>{i+1}</div>
                                </td>
                                <td className="px-2 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{e.supplier_name}</span>
                                    {isBest && group.quotedEntries.length > 1 && (
                                      <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">✓ Termurah</span>
                                    )}
                                  </div>
                                  {e.notes && <div className="text-xs text-amber-600 italic mt-0.5">{e.notes}</div>}
                                </td>
                                {/* Quoted price */}
                                <td className="px-4 py-3 text-center w-32">
                                  <div className="text-xs text-blue-500 mb-0.5 font-medium">📋 Harga Penawaran</div>
                                  <div className="font-bold text-gray-800">{formatRupiah(e.net_price)}</div>
                                  {e.date && <div className="text-xs text-gray-400">{formatDate(e.date)}</div>}
                                </td>
                                {/* Latest actual from same supplier */}
                                <td className="px-4 py-3 text-center w-36">
                                  {latestActual ? (
                                    <>
                                      <div className="text-xs text-emerald-600 mb-0.5 font-medium">🧾 PO terakhir</div>
                                      <div className={`font-bold ${actualDiff > 0 ? "text-red-600" : "text-emerald-700"}`}>
                                        {formatRupiah(latestActual.net_price)}
                                      </div>
                                      {actualDiff !== null && Math.abs(actualDiff) > 0 && (
                                        <div className={`text-xs ${actualDiff > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                          {actualDiff > 0
                                            ? `⬆ Rp ${Math.abs(actualDiff).toLocaleString("id-ID")} lebih mahal dari penawaran`
                                            : `⬇ Rp ${Math.abs(actualDiff).toLocaleString("id-ID")} lebih murah dari penawaran`}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-xs text-gray-300 italic">Belum ada PO</div>
                                  )}
                                </td>
                                {/* Spread bar */}
                                <td className="px-4 py-3 w-28">
                                  {group.spread > 0 && (
                                    <div>
                                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${isBest ? "bg-emerald-500" : "bg-amber-400"}`}
                                          style={{ width: `${Math.max(8, 100 - pct * 3)}%` }}
                                        />
                                      </div>
                                      {pct > 0 && (
                                        <div className="text-xs text-gray-400 mt-0.5">
                                          {pct.toFixed(0)}% lebih mahal dari harga termurah
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                {/* Actions */}
                                <td className="px-3 py-3 w-16 text-right">
                                  <div className="flex gap-1 justify-end">
                                    <button onClick={ev => { ev.stopPropagation(); setEditData(e); setModalOpen(true); }}
                                      className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                      <Pencil size={12}/>
                                    </button>
                                    <button onClick={ev => { ev.stopPropagation();
                                      if (confirm(`Hapus quotation ${e.supplier_name} untuk ${e.item_name}?`))
                                        deleteMutation.mutate(e.raw_id);
                                    }}
                                      className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                      <Trash2 size={12}/>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Suppliers with only actual (no quotation) */}
                          {(() => {
                            const quotedSupplierIds = new Set(group.quotedEntries.map(e => e.supplier_id));
                            const actualOnlySuppliers = {};
                            group.actualEntries.forEach(a => {
                              if (!quotedSupplierIds.has(a.supplier_id)) {
                                if (!actualOnlySuppliers[a.supplier_id] ||
                                    new Date(a.date) > new Date(actualOnlySuppliers[a.supplier_id].date))
                                  actualOnlySuppliers[a.supplier_id] = a;
                              }
                            });
                            return Object.values(actualOnlySuppliers).map(a => (
                              <tr key={`ao-${a.supplier_id}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3 w-8">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">—</div>
                                </td>
                                <td className="px-2 py-3">
                                  <span className="font-medium text-gray-700">{a.supplier_name}</span>
                                </td>
                                <td className="px-4 py-3 text-center w-32">
                                  <div className="text-xs text-gray-300 italic">Tidak ada quotation</div>
                                </td>
                                <td className="px-4 py-3 text-center w-36">
                                  <div className="text-xs text-emerald-600 mb-0.5 font-medium">🧾 Dibeli terakhir</div>
                                  <div className="font-bold text-gray-800">{formatRupiah(a.net_price)}</div>
                                  <div className="text-xs text-gray-400">{formatDate(a.date)}</div>
                                </td>
                                <td className="px-4 py-3 w-28"></td>
                                <td className="px-3 py-3 w-16"></td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Expanded: full PO history ── */}
                  {isExp && (
                    <div className="border-t border-gray-100">
                      {/* Quotations */}
                      {group.quotedEntries.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50/50 border-b border-blue-100">
                            <ClipboardList size={12} className="text-blue-500"/>
                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Harga Penawaran Supplier (Quotation)</span>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="border-b border-gray-100">
                              <tr>
                                <th className="text-left px-5 py-2 font-medium text-gray-400 w-8">#</th>
                                <th className="text-left px-2 py-2 font-medium text-gray-400">Supplier</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-400 w-32">Harga</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-400 w-24">Berlaku</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-400">Catatan</th>
                                <th className="w-16"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {group.quotedEntries.map((e, i) => {
                                const isBest = e.net_price === group.minPrice;
                                return (
                                  <tr key={e.id} className={`${isBest?"bg-emerald-50/30":""} hover:bg-gray-50`}>
                                    <td className="px-5 py-2.5">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        isBest?"bg-emerald-500 text-white":"bg-gray-100 text-gray-500"}`}>{i+1}</div>
                                    </td>
                                    <td className="px-2 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-800">{e.supplier_name}</span>
                                        {isBest && <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">✓ Termurah</span>}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                                      {formatRupiah(e.net_price)}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500">{e.date ? formatDate(e.date) : "-"}</td>
                                    <td className="px-4 py-2.5 text-amber-600 italic">{e.notes || ""}</td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex gap-1 justify-end">
                                        <button onClick={() => { setEditData(e); setModalOpen(true); }}
                                          className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={12}/></button>
                                        <button onClick={() => {
                                          if (confirm(`Hapus quotation ini?`)) deleteMutation.mutate(e.raw_id);
                                        }} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12}/></button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Actual PO history */}
                      {group.actualEntries.length > 0 && (
                        <div className={group.quotedEntries.length > 0 ? "border-t border-gray-100" : ""}>
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100">
                            <FileText size={12} className="text-emerald-600"/>
                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                              Harga Aktual dari Purchase Orders
                            </span>
                            <span className="text-xs text-emerald-500 ml-auto">{group.actualEntries.length} transaksi</span>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="border-b border-gray-100">
                              <tr>
                                <th className="text-left px-5 py-2 font-medium text-gray-400 w-28">PO No.</th>
                                <th className="text-left px-2 py-2 font-medium text-gray-400">Supplier</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-400 w-24">Tanggal</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-400 w-28">Harga/Unit</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-400 w-24">Disc/Unit</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-400 w-28">Net/Unit</th>
                                <th className="text-right px-4 py-2 font-medium text-gray-400 w-16">Qty</th>
                                <th className="text-center px-3 py-2 font-medium text-gray-400 w-16">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {group.actualEntries.map((a, ai) => {
                                const quoted = group.quotedEntries.find(q => q.supplier_id === a.supplier_id);
                                const diff   = quoted ? a.net_price - quoted.net_price : null;
                                return (
                                  <tr key={ai} className={`hover:bg-gray-50 transition-colors ${diff > 0 ? "bg-red-50/20":""}`}>
                                    <td className="px-5 py-2.5">
                                      <span className="font-mono font-bold text-emerald-700">
                                        PO-{String(a.order_id).padStart(5,"0")}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2.5 font-medium text-gray-800">{a.supplier_name}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{formatDate(a.date)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-600">{formatRupiah(a.price)}</td>
                                    <td className="px-4 py-2.5 text-right">
                                      {a.discount > 0
                                        ? <span className="text-emerald-600">{formatRupiah(a.discount)}</span>
                                        : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <div className="font-bold text-gray-900">{formatRupiah(a.net_price)}</div>
                                      {diff !== null && Math.abs(diff) > 100 && (
                                        <div className={`text-xs ${diff > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                          {diff > 0
                                            ? `⬆ Rp ${Math.abs(diff).toLocaleString("id-ID")} lebih mahal dari penawaran`
                                            : `⬇ Rp ${Math.abs(diff).toLocaleString("id-ID")} lebih murah dari penawaran`}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-500">
                                      {a.qty%1===0?a.qty.toFixed(0):a.qty.toFixed(1)} {a.unit}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                                        a.is_paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                      }`}>{a.is_paid ? "Paid" : "Open"}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── VIEW: Per Supplier ── */}
      {viewMode === "supplier" && (
        <div className="space-y-3">
          {bySupplier.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl">
              <Store size={24} className="mx-auto text-gray-300 mb-2"/>
              <p className="text-sm text-gray-400">Belum ada data harga supplier.</p>
            </div>
          ) : bySupplier.map(({ supplier, quoted, actual }) => (
            <div key={supplier.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Store size={16} className="text-gray-500"/>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{supplier.store_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {supplier.phone && `${supplier.phone} · `}
                    {quoted.length} quotation · {actual.length} transaksi PO
                  </p>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium text-gray-400">Item</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-400 w-16">Satuan</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-400 w-32">📋 Penawaran</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-400 w-32">🧾 Dibeli Terakhir</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-400 w-36">Selisih Harga</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-400">Catatan</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* Quoted items */}
                  {quoted.map(q => {
                    const latestActual = actual
                      .filter(a => a.item_name.toLowerCase() === q.item_name.toLowerCase())
                      .sort((a,b) => new Date(b.date)-new Date(a.date))[0];
                    const diff = latestActual ? latestActual.net_price - parseFloat(q.price) : null;
                    // Is this cheapest for this item?
                    const allForItem = listedPrices.filter(p =>
                      p.item_name.toLowerCase() === q.item_name.toLowerCase()
                    );
                    const isCheapest = allForItem.every(p => parseFloat(p.price) >= parseFloat(q.price));

                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 capitalize">{q.item_name}</span>
                            {isCheapest && allForItem.length > 1 && (
                              <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ Termurah</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{q.unit}</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-700">{formatRupiah(q.price)}</td>
                        <td className="px-3 py-3 text-right">
                          {latestActual
                            ? <span className={`font-bold ${diff>0?"text-red-600":"text-emerald-700"}`}>
                                {formatRupiah(latestActual.net_price)}
                              </span>
                            : <span className="text-gray-300 italic">Belum ada PO</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {diff !== null && Math.abs(diff) > 100
                            ? <div className={`text-xs font-medium ${diff>0?"text-red-500":"text-emerald-500"}`}>
                                {diff > 0
                                  ? <>⬆ <span className="font-bold">{formatRupiah(Math.abs(diff))}</span> lebih mahal</>
                                  : <>⬇ <span className="font-bold">{formatRupiah(Math.abs(diff))}</span> lebih murah</>}
                                <div className="text-gray-400 font-normal">dari penawaran</div>
                              </div>
                            : <span className="text-gray-300 text-xs">Sesuai penawaran</span>}
                        </td>
                        <td className="px-3 py-3 text-amber-600 italic">{q.notes || ""}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditData(q); setModalOpen(true); }}
                              className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={12}/></button>
                            <button onClick={() => {
                              if (confirm(`Hapus quotation ini?`)) deleteMutation.mutate(q.raw_id);
                            }} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Actual-only items (no quotation for this supplier) */}
                  {(() => {
                    const quotedItems = new Set(quoted.map(q => q.item_name.toLowerCase()));
                    const actualOnly = {};
                    actual.forEach(a => {
                      const k = a.item_name.toLowerCase();
                      if (!quotedItems.has(k)) {
                        if (!actualOnly[k] || new Date(a.date) > new Date(actualOnly[k].date))
                          actualOnly[k] = a;
                      }
                    });
                    return Object.values(actualOnly).map(a => (
                      <tr key={`ao-${a.order_id}-${a.item_name}`} className="hover:bg-gray-50 bg-gray-50/30">
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-600 capitalize">{a.item_name}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{a.unit}</td>
                        <td className="px-3 py-3 text-right text-gray-300 italic">Tidak ada quotation</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-800">{formatRupiah(a.net_price)}</td>
                        <td className="px-3 py-3 text-right text-gray-300">-</td>
                        <td className="px-3 py-3 text-xs text-gray-400">{formatDate(a.date)}</td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null); }}
        title={editData ? "Edit Quotation" : "Tambah Quotation Harga"}
        size="lg"
      >
        <PriceForm
          initial={editData}
          suppliers={suppliers}
          catalog={catalog}
          onSubmit={handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
          onClose={() => { setModalOpen(false); setEditData(null); }}
        />
      </Modal>
    </div>
  );
}
