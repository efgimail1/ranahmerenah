import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { projectsApi } from "../api/projects";
import { subProjectsApi } from "../api/subProjects";
import { formatRupiah, formatDate, BANK_OPTIONS } from "../utils/format";
import {
  ChevronDown,
  ChevronUp,
  Building2,
  Layers,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

export default function SupplierAgingReport() {
  const [filterProject, setFilterProject] = useState("");
  const [filterSubProject, setFilterSubProject] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  const qc = useQueryClient();

  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    paid_by: "",
    bank_account: "",
    notes: "",
  });

  const toggleExpanded = (supplierId) => {
    setExpandedSupplier((prev) => (prev === supplierId ? null : supplierId));
    setSelectedOrderIds(new Set());
  };

  const toggleOrderSelected = (orderId) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const batchPayment = useMutation({
    mutationFn: (data) => materialsApi.createBatchPayment(data),
    onSuccess: (res) => {
      toast.success(
        `${res.payments.length} PO lunas, masuk ledger sebagai 1 entri`,
      );
      qc.invalidateQueries({ queryKey: ["po-aging"] });
      setSelectedOrderIds(new Set());
      setShowBatchModal(false);
      setBatchForm({
        payment_date: new Date().toISOString().split("T")[0],
        paid_by: "",
        bank_account: "",
        notes: "",
      });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Gagal menyimpan pembayaran"),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.getAll,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: materialsApi.getSuppliers,
  });

  const selectedProject = projects.find(
    (p) => p.id === parseInt(filterProject),
  );
  const isContractor = selectedProject?.project_type === "contractor";

  const { data: subProjects = [] } = useQuery({
    queryKey: ["sub-projects-aging", filterProject],
    queryFn: () => subProjectsApi.getByProject(parseInt(filterProject)),
    enabled: !!filterProject && isContractor,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["po-aging", filterProject, filterSubProject],
    queryFn: () => {
      const p = { is_paid: false };
      if (filterProject) p.project_id = filterProject;
      if (filterSubProject) p.sub_project_id = filterSubProject;
      return materialsApi.getPurchaseOrders(p);
    },
  });

  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Fetch sub project names untuk orders yang tampil
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
  const { data: allSubProjects = [] } = useQuery({
    queryKey: ["sub-projects-aging-names", contractorProjectIds.join(",")],
    queryFn: async () => {
      if (!contractorProjectIds.length) return [];
      const results = await Promise.all(
        contractorProjectIds.map((pid) => subProjectsApi.getByProject(pid)),
      );
      return results.flat();
    },
    enabled: contractorProjectIds.length > 0,
  });

  const subProjectNameMap = {};
  subProjects.forEach((sp) => {
    subProjectNameMap[sp.id] = sp.name;
  });
  allSubProjects.forEach((sp) => {
    subProjectNameMap[sp.id] = sp.name;
  });

  // Group by supplier, hitung sisa hutang per PO
  const grouped = (() => {
    const filtered = filterSupplier
      ? orders.filter((o) => String(o.supplier_id) === filterSupplier)
      : orders;

    const map = {};
    filtered.forEach((o) => {
      const sid = o.supplier_id || 0;
      const totalPaid = parseFloat(o.total_paid || 0);
      const totalNet = parseFloat(o.total_net || 0);
      const sisa = Math.max(0, totalNet - totalPaid);

      if (!map[sid]) {
        map[sid] = {
          supplier: supplierMap[sid] || { store_name: "Tanpa Supplier" },
          orders: [],
          total_hutang: 0,
          total_po: 0,
        };
      }
      map[sid].orders.push({ ...o, sisa });
      map[sid].total_hutang += sisa;
      map[sid].total_po += 1;
    });

    return Object.values(map).sort((a, b) => b.total_hutang - a.total_hutang);
  })();

  const grandTotal = grouped.reduce((s, g) => s + g.total_hutang, 0);
  const totalSuppliers = grouped.length;
  const totalPO = grouped.reduce((s, g) => s + g.total_po, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Hutang Supplier</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Purchase order yang belum lunas, dikelompokkan per supplier
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-xs text-red-500 mb-1">Total Hutang</div>
          <div className="text-xl font-bold text-red-600">
            {formatRupiah(grandTotal)}
          </div>
          <div className="text-xs text-red-400 mt-0.5">
            {totalPO} PO belum lunas
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Jumlah Supplier</div>
          <div className="text-xl font-bold text-gray-800">
            {totalSuppliers}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            supplier punya hutang
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-600 mb-1">
            Rata-rata per Supplier
          </div>
          <div className="text-xl font-bold text-amber-700">
            {formatRupiah(totalSuppliers > 0 ? grandTotal / totalSuppliers : 0)}
          </div>
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

        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
        >
          <option value="">Semua Supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.store_name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-sm font-medium text-gray-600">
            Tidak ada hutang supplier!
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Semua purchase order sudah lunas.
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_100px_180px_180px_40px] text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <div>Supplier</div>
            <div className="text-center">Jumlah PO</div>
            <div className="text-right">Total PO</div>
            <div className="text-right">Sisa Hutang</div>
            <div></div>
          </div>

          {grouped.map((group, idx) => {
            const isExp = expandedSupplier === group.supplier?.id;
            const totalPOValue = group.orders.reduce(
              (s, o) => s + parseFloat(o.total_net || 0),
              0,
            );

            return (
              <div
                key={group.supplier?.id || idx}
                className={idx > 0 ? "border-t border-gray-100" : ""}
              >
                {/* Supplier row */}
                <div
                  className="grid grid-cols-[2fr_100px_180px_180px_40px] items-center px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleExpanded(group.supplier?.id)}
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {group.supplier?.store_name}
                    </div>
                    {group.supplier?.phone && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {group.supplier.phone}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {group.total_po} PO
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {formatRupiah(totalPOValue)}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-red-600">
                      {formatRupiah(group.total_hutang)}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    {isExp ? (
                      <ChevronUp size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded: list PO per supplier */}
                {isExp && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-3 py-2 w-8"></th>
                          <th className="text-left px-6 py-2 font-medium text-gray-400 w-28">
                            PO No.
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-400">
                            Project / Sub
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                            Tanggal
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-32">
                            Total PO
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-32">
                            Sudah Dibayar
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-400 w-32">
                            Sisa Hutang
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-400 w-20">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.orders
                          .sort((a, b) => b.sisa - a.sisa)
                          .map((o) => {
                            const project = projectMap[o.project_id];
                            const isContr =
                              project?.project_type === "contractor";
                            const totalPaid = parseFloat(o.total_paid || 0);

                            return (
                              <tr
                                key={o.id}
                                className="hover:bg-white transition-colors"
                              >
                                <td className="px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderIds.has(o.id)}
                                    onChange={() => toggleOrderSelected(o.id)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="px-6 py-2.5">
                                  <span className="font-mono font-bold text-emerald-700">
                                    PO-{String(o.id).padStart(5, "0")}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    {isContr && (
                                      <Building2
                                        size={10}
                                        className="text-orange-400 shrink-0"
                                      />
                                    )}
                                    <span className="text-gray-700 font-medium">
                                      {project?.project_name || "-"}
                                    </span>
                                  </div>
                                  {o.sub_project_id && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Layers
                                        size={9}
                                        className="text-orange-400"
                                      />
                                      <span className="text-orange-600">
                                        {subProjectNameMap[o.sub_project_id] ||
                                          `Sub #${o.sub_project_id}`}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-500">
                                  {formatDate(o.purchase_date)}
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600">
                                  {formatRupiah(o.total_net)}
                                </td>
                                <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">
                                  {totalPaid > 0 ? (
                                    formatRupiah(totalPaid)
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold text-red-600">
                                  {formatRupiah(o.sisa)}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full font-medium text-xs ${
                                      o.payment_status === "partial"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-red-100 text-red-600"
                                    }`}
                                  >
                                    {o.payment_status === "partial"
                                      ? "⋯ Partial"
                                      : "Unpaid"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-white">
                          <td />
                          <td
                            colSpan={3}
                            className="px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase"
                          >
                            Total {group.supplier?.store_name}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-700">
                            {formatRupiah(totalPOValue)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">
                            {formatRupiah(totalPOValue - group.total_hutang)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-red-600">
                            {formatRupiah(group.total_hutang)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                    {selectedOrderIds.size > 0 && (
                      <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border-t border-emerald-100">
                        <div className="text-xs text-emerald-700">
                          <span className="font-semibold">
                            {selectedOrderIds.size} PO dipilih
                          </span>{" "}
                          · Total{" "}
                          <span className="font-bold">
                            {formatRupiah(
                              group.orders
                                .filter((o) => selectedOrderIds.has(o.id))
                                .reduce((s, o) => s + o.sisa, 0),
                            )}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowBatchModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Wallet size={13} />
                          Bayar Sekaligus
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className="grid grid-cols-[2fr_100px_180px_180px_40px] border-t-2 border-gray-200 bg-red-50 px-4 py-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Grand Total ({totalSuppliers} supplier · {totalPO} PO)
            </div>
            <div />
            <div className="text-right text-sm font-semibold text-gray-700">
              {formatRupiah(
                grouped.reduce(
                  (s, g) =>
                    s +
                    g.orders.reduce(
                      (ss, o) => ss + parseFloat(o.total_net || 0),
                      0,
                    ),
                  0,
                ),
              )}
            </div>
            <div className="text-right text-sm font-bold text-red-600">
              {formatRupiah(grandTotal)}
            </div>
            <div />
          </div>
        </div>
      )}
      {showBatchModal &&
        (() => {
          const currentGroup = grouped.find(
            (g) => g.supplier?.id === expandedSupplier,
          );
          const selectedOrders = (currentGroup?.orders || []).filter((o) =>
            selectedOrderIds.has(o.id),
          );
          const batchTotal = selectedOrders.reduce((s, o) => s + o.sisa, 0);

          const fI =
            "text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full";

          const handleSubmit = () => {
            if (!batchForm.payment_date)
              return toast.error("Tanggal bayar harus diisi");
            batchPayment.mutate({
              order_ids: selectedOrders.map((o) => o.id),
              payment_date: batchForm.payment_date,
              paid_by: batchForm.paid_by || null,
              bank_account: batchForm.bank_account || null,
              payment_method: "transfer",
              notes: batchForm.notes || null,
            });
          };

          return (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Bayar Sekaligus — {currentGroup?.supplier?.store_name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedOrders.length} PO akan ditandai lunas & dicatat
                    sebagai 1 entri ledger
                  </p>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                    {selectedOrders.map((o) => (
                      <div
                        key={o.id}
                        className="flex justify-between text-xs text-gray-600"
                      >
                        <span className="font-mono">
                          PO-{String(o.id).padStart(5, "0")}
                        </span>
                        <span>{formatRupiah(o.sisa)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Total Bayar
                    </span>
                    <span className="text-base font-bold text-emerald-700">
                      {formatRupiah(batchTotal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Tanggal Bayar *
                      </div>
                      <input
                        type="date"
                        value={batchForm.payment_date}
                        onChange={(e) =>
                          setBatchForm((f) => ({
                            ...f,
                            payment_date: e.target.value,
                          }))
                        }
                        className={fI}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Bank</div>
                      <select
                        value={batchForm.bank_account}
                        onChange={(e) =>
                          setBatchForm((f) => ({
                            ...f,
                            bank_account: e.target.value,
                          }))
                        }
                        className={fI}
                      >
                        <option value="">-- Bank --</option>
                        {BANK_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      Dibayar Oleh
                    </div>
                    <input
                      type="text"
                      value={batchForm.paid_by}
                      onChange={(e) =>
                        setBatchForm((f) => ({ ...f, paid_by: e.target.value }))
                      }
                      placeholder="Nama / perusahaan"
                      className={fI}
                    />
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">Catatan</div>
                    <input
                      type="text"
                      value={batchForm.notes}
                      onChange={(e) =>
                        setBatchForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      placeholder="optional"
                      className={fI}
                    />
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => setShowBatchModal(false)}
                    className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={batchPayment.isPending}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {batchPayment.isPending
                      ? "Menyimpan..."
                      : `Bayar ${formatRupiah(batchTotal)}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
