import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { projectsApi } from "../api/projects";
import { subProjectsApi } from "../api/subProjects";
import { formatRupiah, formatDate } from "../utils/format";
import {
  ChevronDown,
  ChevronUp,
  Building2,
  Layers,
} from "lucide-react";

export default function SupplierAgingReport() {
  const [filterProject, setFilterProject] = useState("");
  const [filterSubProject, setFilterSubProject] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [expandedSupplier, setExpandedSupplier] = useState(null);

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
  subProjects.forEach((sp) => { subProjectNameMap[sp.id] = sp.name; });
  allSubProjects.forEach((sp) => { subProjectNameMap[sp.id] = sp.name; });

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
          <div className="text-xs text-red-400 mt-0.5">{totalPO} PO belum lunas</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Jumlah Supplier</div>
          <div className="text-xl font-bold text-gray-800">{totalSuppliers}</div>
          <div className="text-xs text-gray-400 mt-0.5">supplier punya hutang</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-600 mb-1">Rata-rata per Supplier</div>
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
                  onClick={() =>
                    setExpandedSupplier(isExp ? null : group.supplier?.id)
                  }
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
    </div>
  );
}