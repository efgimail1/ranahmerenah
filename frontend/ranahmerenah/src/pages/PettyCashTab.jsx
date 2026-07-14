import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subProjectsApi } from "../api/subProjects";
import Button from "../components/ui/Button";
import Input, { Select } from "../components/ui/Input";
import { formatRupiah, formatDate, BANK_OPTIONS } from "../utils/format";
import { Save, Trash2, X, AlertCircle, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

export default function PettyCashTab({ subProjectId, projectId }) {
  const qc = useQueryClient();

  const emptyForm = {
    cash_date: "",
    amount: "",
    given_to: "",
    given_by: "",
    bank_account: "",
    notes: "",
  };

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [settleModal, setSettleModal] = useState(null);
  const [settleDate, setSettleDate] = useState("");
  const [settleBank, setSettleBank] = useState("");
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["petty-cash", subProjectId],
    queryFn: () => subProjectsApi.getPettyCash(subProjectId),
    enabled: !!subProjectId,
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["petty-cash", subProjectId] });
    qc.invalidateQueries({ queryKey: ["petty-cash-open", subProjectId] });
  };

  const createMutation = useMutation({
    mutationFn: (data) =>
      subProjectsApi.createPettyCash(subProjectId, {
        ...data,
        project_id: projectId, // ← tambah ini
      }),
    onSuccess: () => {
      inv();
      setForm(emptyForm);
      toast.success("Kas tukang dicatat!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (pcId) => subProjectsApi.deletePettyCash(subProjectId, pcId),
    onSuccess: () => {
      inv();
      toast.success("Kas dihapus.");
    },
    onError: (e) => toast.error(e.message),
  });

  const settleMutation = useMutation({
    mutationFn: ({ pcId, data }) =>
      subProjectsApi.settlePettyCash(subProjectId, pcId, data),
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      qc.invalidateQueries({ queryKey: ["sub-project", subProjectId] });
      setSettleModal(null);
      setSettleDate("");
      setSettleBank("");
      toast.success("Kas di-settle. Sisa masuk ledger sebagai income!");
    },
    onError: (e) => toast.error(e.message),
  });

  const open = records.filter((r) => r.status === "open");
  const settled = records.filter((r) => r.status === "settled");
  const totalOpen = open.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalUsed = open.reduce((s, r) => s + parseFloat(r.total_used || 0), 0);
  const totalRemaining = open.reduce(
    (s, r) => s + parseFloat(r.remaining || 0),
    0,
  );

  const handleSave = () => {
    const amt = parseFloat(String(form.amount).replace(/\D/g, "")) || 0;
    if (!form.cash_date) return toast.error("Tanggal harus diisi");
    if (!amt) return toast.error("Jumlah harus diisi");
    createMutation.mutate({
      cash_date: form.cash_date,
      amount: amt,
      given_to: form.given_to || null,
      given_by: form.given_by || null,
      bank_account: form.bank_account || null,
      notes: form.notes || null,
    });
  };

  const handleSettle = () => {
    if (!settleDate) return toast.error("Tanggal settlement harus diisi");
    settleMutation.mutate({
      pcId: settleModal.id,
      data: {
        settlement_date: settleDate,
        refund_to_bank_account: settleBank || null,
      },
    });
  };

  const iCls =
    "text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 w-full";

  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex gap-2 p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
        <AlertCircle size={12} className="text-purple-400 mt-0.5 shrink-0" />
        <p className="text-xs text-purple-600">
          Kas tukang <strong>tidak langsung masuk ledger</strong> saat
          dicairkan. Begitu dipakai bayar PO (pilih "Bayar pakai Kas Tukang" di
          tab Pembayaran PO), baru masuk sebagai expense. Sisa yang dikembalikan
          saat settle otomatis masuk ledger sebagai income.
        </p>
      </div>

      {/* Summary cards */}
      {open.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
            <div className="text-xs text-purple-500 mb-1">Total Dicairkan</div>
            <div className="text-sm font-bold text-purple-700">
              {formatRupiah(totalOpen)}
            </div>
            <div className="text-xs text-purple-400">
              {open.length} pos open
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-xs text-blue-500 mb-1">Terpakai (PO)</div>
            <div className="text-sm font-bold text-blue-700">
              {formatRupiah(totalUsed)}
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-xs text-emerald-500 mb-1">
              Sisa di Tangan Tukang
            </div>
            <div className="text-sm font-bold text-emerald-700">
              {formatRupiah(totalRemaining)}
            </div>
          </div>
        </div>
      )}

      {/* Open table */}
      <div className="border border-purple-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50 border-b border-purple-200">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-purple-600" />
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
              Kas Tukang — Open
            </span>
            {totalRemaining > 0 && (
              <span className="text-xs text-purple-500">
                · {formatRupiah(totalRemaining)} belum terpakai
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((s) => !s);
              setForm(emptyForm);
            }}
            className="text-xs px-2.5 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-all"
          >
            {showForm ? "Batal" : "+ Tambah Kas"}
          </button>
        </div>

        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                Tanggal
              </th>
              <th className="text-right px-3 py-2 font-medium text-gray-400 w-32">
                Dicairkan
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                Diberikan Ke
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                Dari
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-20">
                Bank
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-400">
                Catatan
              </th>
              <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                Terpakai
              </th>
              <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                Sisa
              </th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {/* Input row */}
            {showForm && (
              <tr className="bg-purple-50/40 border-b border-purple-100">
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={form.cash_date}
                    onChange={(e) => setF("cash_date", e.target.value)}
                    className={iCls}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        form.amount
                          ? new Intl.NumberFormat("id-ID").format(
                              String(form.amount).replace(/\D/g, ""),
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setF("amount", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="0"
                      className={`${iCls} pl-7 text-right`}
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={form.given_to}
                    onChange={(e) => setF("given_to", e.target.value)}
                    placeholder="Nama tukang"
                    className={iCls}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={form.given_by}
                    onChange={(e) => setF("given_by", e.target.value)}
                    placeholder="Nama pemberi"
                    className={iCls}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={form.bank_account}
                    onChange={(e) => setF("bank_account", e.target.value)}
                    className={iCls}
                  >
                    <option value="">-- Bank --</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setF("notes", e.target.value)}
                    placeholder="optional"
                    className={iCls}
                  />
                </td>
                <td colSpan={2} className="px-3 py-2 text-center text-gray-300">
                  —
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={createMutation.isPending}
                    className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-all"
                    title="Simpan"
                  >
                    <Save size={13} />
                  </button>
                </td>
              </tr>
            )}

            {open.length === 0 && !showForm && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-gray-400 italic"
                >
                  Belum ada kas tukang. Klik "+ Tambah Kas" untuk mencatat.
                </td>
              </tr>
            )}

            {open.map((r) => {
              const used = parseFloat(r.total_used || 0);
              const remaining = parseFloat(r.remaining || 0);
              const pct =
                parseFloat(r.amount) > 0
                  ? Math.min((used / parseFloat(r.amount)) * 100, 100)
                  : 0;
              return (
                <tr key={r.id} className="hover:bg-gray-50 group">
                  <td className="px-3 py-2.5 text-gray-600">
                    {formatDate(r.cash_date)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-purple-700">
                    {formatRupiah(r.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 font-medium">
                    {r.given_to || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {r.given_by || "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.bank_account ? (
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                        {r.bank_account}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 italic">
                    {r.notes || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-medium text-blue-600">
                      {used > 0 ? (
                        formatRupiah(used)
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </div>
                    {used > 0 && (
                      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden w-16 ml-auto">
                        <div
                          className="h-full bg-blue-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                    {formatRupiah(remaining)}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setSettleModal(r);
                          setSettleDate("");
                          setSettleBank(r.bank_account || "");
                        }}
                        className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 whitespace-nowrap"
                      >
                        Settle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (used > 0) {
                            toast.error(
                              "Tidak bisa hapus — sudah dipakai untuk PO",
                              { duration: 4000 },
                            );
                            return;
                          }
                          if (confirm("Hapus kas tukang ini?"))
                            deleteMutation.mutate(r.id);
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {open.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-purple-200 bg-purple-50">
                <td className="px-3 py-2 text-xs font-semibold text-purple-700">
                  Total ({open.length} pos)
                </td>
                <td className="px-3 py-2 text-right font-bold text-purple-700">
                  {formatRupiah(totalOpen)}
                </td>
                <td colSpan={3} />
                <td className="px-3 py-2 text-right font-semibold text-blue-600">
                  {formatRupiah(totalUsed)}
                </td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700">
                  {formatRupiah(totalRemaining)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Settled history */}
      {settled.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <CheckCircle size={13} className="text-emerald-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Riwayat Kas (Settled)
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                  Tgl Cair
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                  Dicairkan
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                  Ke
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                  Terpakai
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-400 w-28">
                  Dikembalikan
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                  Tgl Settle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {settled.map((r) => {
                const used = parseFloat(r.total_used || 0);
                const refunded = parseFloat(r.amount || 0) - used;
                return (
                  <tr key={r.id} className="opacity-60 hover:opacity-100">
                    <td className="px-3 py-2.5 text-gray-600">
                      {formatDate(r.cash_date)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-600">
                      {formatRupiah(r.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {r.given_to || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-blue-500 font-medium">
                      {formatRupiah(used)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">
                      {refunded > 0 ? (
                        formatRupiah(refunded)
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {r.settlement_date ? formatDate(r.settlement_date) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Settle modal */}
      {settleModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSettleModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Settle Kas Tukang
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {settleModal.given_to || "Tukang"} ·{" "}
                  {formatDate(settleModal.cash_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kas Dicairkan</span>
                  <span className="font-semibold">
                    {formatRupiah(settleModal.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Terpakai (PO)</span>
                  <span className="font-semibold text-blue-600">
                    {formatRupiah(settleModal.total_used || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5">
                  <span className="text-gray-700">Sisa dikembalikan</span>
                  <span className="text-emerald-600">
                    {formatRupiah(settleModal.remaining || 0)}
                  </span>
                </div>
              </div>

              <Input
                label="Tanggal Settlement *"
                type="date"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
              />

              {parseFloat(settleModal.remaining || 0) > 0 && (
                <>
                  <Select
                    label="Bank Tujuan Refund"
                    value={settleBank}
                    onChange={(e) => setSettleBank(e.target.value)}
                  >
                    <option value="">-- Select Bank --</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                  <div className="flex gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                    <AlertCircle
                      size={12}
                      className="text-amber-500 mt-0.5 shrink-0"
                    />
                    <p className="text-xs text-amber-700">
                      Sisa{" "}
                      <strong>{formatRupiah(settleModal.remaining)}</strong>{" "}
                      akan otomatis dicatat sebagai <strong>income</strong> di
                      Ledger.
                    </p>
                  </div>
                </>
              )}

              {parseFloat(settleModal.remaining || 0) === 0 && (
                <div className="flex gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <CheckCircle
                    size={12}
                    className="text-emerald-500 mt-0.5 shrink-0"
                  />
                  <p className="text-xs text-emerald-700">
                    Kas terpakai habis pas — tidak ada sisa yang perlu
                    dikembalikan.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSettleModal(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={settleMutation.isPending}
                  onClick={handleSettle}
                >
                  Settle & Tutup
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
