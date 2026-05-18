import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { workersApi } from "../api/workers";
import { ledgerApi } from "../api/ledger";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Input, { Select, CurrencyInput } from "../components/ui/Input";
import {
  formatRupiah,
  formatDate,
  toInputDate,
  parseCurrency,
  PROJECT_STATUS,
  RATE_TYPE,
  BANK_OPTIONS,
} from "../utils/format";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Circle,
  X,
  HardHat,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Constants ─────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "foreman", label: "Mandor" },
  { value: "carpenter", label: "Tukang Kayu" },
  { value: "helper", label: "Kenek" },
  { value: "furniture_maker", label: "Tukang Meubel" },
  { value: "bricklayer", label: "Tukang Batu" },
  { value: "painter", label: "Tukang Cat" },
  { value: "electrician", label: "Elektrisi" },
  { value: "plumber", label: "Tukang Ledeng" },
  { value: "other", label: "Lainnya" },
];

const RATE_OPTIONS = [
  { value: "daily", label: "Per Day" },
  { value: "per_unit", label: "Per Unit" },
  { value: "fixed", label: "Fixed / Lump Sum" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "qris", label: "QRIS" },
  { value: "other", label: "Other" },
];

const QRIS_FEE = 0.003;

// ─── Parse helpers ─────────────────────────────────────────
function parseHeader(p) {
  if (!p)
    return {
      client_name: "",
      client_phone: "",
      project_name: "",
      location: "",
      received_date: "",
      start_date: "",
      end_date: "",
      rab_value: "",
      architect_fee: "",
      status: "pending",
      notes: "",
    };
  return {
    client_name: p.client_name || "",
    client_phone: p.client_phone || "",
    project_name: p.project_name || "",
    location: p.location || "",
    received_date: toInputDate(p.received_date),
    start_date: toInputDate(p.start_date),
    end_date: toInputDate(p.end_date),
    rab_value: p.rab_value ? String(Math.round(parseFloat(p.rab_value))) : "",
    architect_fee: p.architect_fee
      ? String(Math.round(parseFloat(p.architect_fee)))
      : "",
    status: p.status || "pending",
    notes: p.notes || "",
  };
}

function parsePayments(p) {
  if (!p?.payments?.length) return [];
  return p.payments.map((pay) => ({
    id: pay.id,
    term_type: pay.term_type || "dp",
    term_label: pay.term_label || "",
    percentage: pay.percentage ? String(parseFloat(pay.percentage)) : "",
    amount: pay.amount ? String(Math.round(parseFloat(pay.amount))) : "",
    due_date: toInputDate(pay.due_date),
    paid_date: toInputDate(pay.paid_date),
    amount_paid: pay.amount_paid
      ? String(Math.round(parseFloat(pay.amount_paid)))
      : "0",
    status: pay.status || "unpaid",
    notes: pay.notes || "",
  }));
}

// ─── Tab: Payment Terms — Table Style ─────────────────────
function TabPayments({
  payments,
  setPayments,
  setDeletedPaymentIds,
  architectFee,
  projectId,
  onDataRefresh,
}) {
  const qc = useQueryClient();
  const [recordFor, setRecordFor] = useState(null);
  const [payForm, setPayForm] = useState({
    entry_date: "",
    gross_amount: "",
    payment_method: "transfer",
    bank_account: "",
    description: "",
    notes: "",
  });

  const [savingTermIdx, setSavingTermIdx] = useState(null);

  const saveSingleTerm = async (i, pay) => {
    // Validasi
    if (!pay.term_type) return toast.error("Term type is required");
    if (!pay.amount && !pay.percentage)
      return toast.error("Amount or percentage is required");

    setSavingTermIdx(i);
    try {
      const payload = {
        term_type: pay.term_type,
        term_label: pay.term_label || null,
        percentage: pay.percentage ? parseFloat(pay.percentage) : null,
        amount: pay.amount ? parseFloat(parseCurrency(pay.amount)) : null,
        due_date: pay.due_date || null,
        paid_date: pay.paid_date || null,
        status: pay.status || "unpaid",
        notes: pay.notes || null,
      };

      const saved = await projectsApi.addPayment(projectId, payload);

      // Update baris di state dengan data dari backend (sekarang punya id)
      setPayments((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                id: saved.id,
                amount_paid: saved.amount_paid
                  ? String(Math.round(parseFloat(saved.amount_paid)))
                  : "0",
                status: saved.status || "unpaid",
              }
            : it,
        ),
      );

      toast.success("Payment term saved!");
      if (onDataRefresh) await onDataRefresh();
    } catch (e) {
      toast.error(e.message || "Failed to save term");
    } finally {
      setSavingTermIdx(null);
    }
  };

  const addRow = () =>
    setPayments((p) => [
      ...p,
      {
        term_type: "dp",
        term_label: "",
        percentage: "",
        amount: "",
        due_date: "",
        paid_date: "",
        amount_paid: "0",
        status: "unpaid",
        notes: "",
      },
    ]);

  const set = (i, f, v) =>
    setPayments((p) =>
      p.map((it, idx) => (idx === i ? { ...it, [f]: v } : it)),
    );

  // BARU — block jika sudah ada pembayaran
const remove = (i) => {
  const pay = payments[i]

  // Baris baru yang belum disimpan — boleh hapus langsung
  if (!pay.id) {
    setPayments((p) => p.filter((_, idx) => idx !== i))
    return
  }

  const amtPaid = parseFloat(pay.amount_paid || 0)

  // Sudah ada pembayaran — tidak boleh hapus
  if (amtPaid > 0) {
    toast.error(
      `Cannot delete "${pay.term_label || 'this term'}" — it has received payments of ${formatRupiah(amtPaid)}. Reverse the payment in Ledger first.`,
      { duration: 5000 }
    )
    return
  }

  // Belum ada pembayaran — konfirmasi lalu hapus
  if (confirm(`Delete payment term "${pay.term_label || 'this term'}"?`)) {
    setDeletedPaymentIds((prev) => [...prev, pay.id])
    setPayments((p) => p.filter((_, idx) => idx !== i))
  }
}

  const handlePct = (i, pct) => {
    set(i, "percentage", pct);
    const fee = parseFloat(parseCurrency(architectFee)) || 0;
    if (fee > 0 && pct) {
      const amt = Math.round(((parseFloat(pct) || 0) / 100) * fee);
      set(i, "amount", String(amt));
    }
  };

  // Record payment
  const setPay = (f, v) => setPayForm((p) => ({ ...p, [f]: v }));
  const gross_pay = parseFloat(parseCurrency(payForm.gross_amount)) || 0;
  const isQris = payForm.payment_method === "qris";
  const qris_fee = isQris ? Math.round(gross_pay * QRIS_FEE) : 0;
  const net_pay = gross_pay - qris_fee;

  const recordMutation = useMutation({
    mutationFn: (data) => ledgerApi.createIncome(data),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["ledger-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setRecordFor(null);
      setPayForm({
        entry_date: "",
        gross_amount: "",
        payment_method: "transfer",
        bank_account: "",
        description: "",
        notes: "",
      });
      toast.success("Payment recorded!");

      // ← KUNCI: refresh data project lalu update payments state
      if (onDataRefresh) {
        const fresh = await onDataRefresh();
        if (fresh?.payments) {
          setPayments(parsePayments(fresh));
        }
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRecord = () => {
    if (!payForm.entry_date) return toast.error("Payment date is required");
    if (!gross_pay) return toast.error("Amount is required");
    recordMutation.mutate({
      entry_date: payForm.entry_date,
      entry_type: "income",
      description:
        payForm.description || `Payment — ${recordFor.term_label || "Term"}`,
      received_from: "",
      gross_amount: gross_pay,
      payment_method: payForm.payment_method,
      bank_account: payForm.bank_account || null,
      is_qris: isQris,
      project_payment_id: recordFor.id,
      project_id: projectId || null,
      notes: payForm.notes || null,
    });
  };

  const totalPct = payments.reduce(
    (s, p) => s + (parseFloat(p.percentage) || 0),
    0,
  );
  const totalAmt = payments.reduce(
    (s, p) => s + (parseFloat(parseCurrency(p.amount)) || 0),
    0,
  );
  const totalPaid = payments.reduce(
    (s, p) => s + (parseFloat(p.amount_paid) || 0),
    0,
  );

  const inputCls =
    "w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Payment Terms
          </h4>
          <span
            className={`text-xs font-medium ${totalPct === 100 ? "text-emerald-600" : "text-amber-600"}`}
          >
            {totalPct}% allocated
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          <Plus size={14} /> Add Term
        </Button>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg">
          <CreditCard size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">
            No payment terms. Click "+ Add Term" to add.
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-8">
                    #
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                    Type
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-32">
                    Label
                  </th>
                  <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-16">
                    %
                  </th>
                  <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-36">
                    Amount
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-32">
                    Due Date
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-32">
                    Paid Date
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-24">
                    Status
                  </th>
                  <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                    Amount Paid
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500">
                    Notes
                  </th>
                  <th className="w-20 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay, i) => {
                  const termAmt = parseFloat(parseCurrency(pay.amount)) || 0;
                  const amtPaid = parseFloat(pay.amount_paid) || 0;
                  const remaining = Math.max(termAmt - amtPaid, 0);
                  const paidPct =
                    termAmt > 0 ? Math.min((amtPaid / termAmt) * 100, 100) : 0;
                  const rowBg =
                    pay.status === "paid"
                      ? "bg-emerald-50"
                      : pay.status === "partial"
                        ? "bg-amber-50"
                        : "";

                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors group ${rowBg}`}
                    >
                      <td className="px-3 py-2 text-center text-xs text-gray-400">
                        {i + 1}
                      </td>

                      <td className="px-2 py-1.5">
                        <select
                          value={pay.term_type}
                          onChange={(e) => set(i, "term_type", e.target.value)}
                          className={inputCls}
                        >
                          <option value="dp">Down Payment</option>
                          <option value="termin">Progress</option>
                          <option value="final">Final</option>
                        </select>
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={pay.term_label}
                          onChange={(e) => set(i, "term_label", e.target.value)}
                          placeholder="e.g. DP, Term 1"
                          className={inputCls}
                        />
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pay.percentage}
                          onChange={(e) => handlePct(i, e.target.value)}
                          placeholder="0"
                          onWheel={(e) => e.target.blur()}
                          className={`${inputCls} text-right`}
                        />
                      </td>

                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              pay.amount
                                ? new Intl.NumberFormat("id-ID").format(
                                    parseCurrency(pay.amount),
                                  )
                                : ""
                            }
                            onChange={(e) =>
                              set(
                                i,
                                "amount",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            placeholder="0"
                            className={`${inputCls} pl-7 text-right`}
                          />
                        </div>
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={pay.due_date}
                          onChange={(e) => set(i, "due_date", e.target.value)}
                          className={inputCls}
                        />
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={pay.paid_date}
                          onChange={(e) => set(i, "paid_date", e.target.value)}
                          className={inputCls}
                        />
                      </td>

                      <td className="px-2 py-1.5">
                        <select
                          value={pay.status || "unpaid"}
                          onChange={(e) => set(i, "status", e.target.value)}
                          className={inputCls}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>

                      <td className="px-2 py-2 text-right">
                        <div>
                          <span
                            className={`text-xs font-semibold ${amtPaid > 0 ? "text-emerald-700" : "text-gray-300"}`}
                          >
                            {amtPaid > 0 ? formatRupiah(amtPaid) : "-"}
                          </span>
                          {pay.status === "partial" && (
                            <div className="mt-1">
                              <div className="h-1 bg-gray-200 rounded-full overflow-hidden w-full">
                                <div
                                  className="h-full bg-amber-400 rounded-full"
                                  style={{ width: `${paidPct}%` }}
                                />
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 text-right">
                                -{formatRupiah(remaining)}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={pay.notes}
                          onChange={(e) => set(i, "notes", e.target.value)}
                          placeholder="optional"
                          className={inputCls}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Baris baru (belum punya id) — tampilkan Save & Cancel */}
                          {!pay.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveSingleTerm(i, pay)}
                                disabled={savingTermIdx === i}
                                title="Save term"
                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                              >
                                {savingTermIdx === i ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-emerald-600 border-t-transparent" />
                                ) : (
                                  <Save size={13} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(i)}
                                title="Cancel"
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Baris lama (sudah punya id) — Record Payment & Delete */}
                              {pay.status !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => setRecordFor(pay)}
                                  title="Record payment"
                                  className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <TrendingUp size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => remove(i)}
                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase"
                  >
                    Total ({payments.length} terms)
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right text-xs font-semibold ${totalPct === 100 ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {totalPct}%
                  </td>
                  <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-900">
                    {formatRupiah(totalAmt)}
                  </td>
                  <td colSpan={3}></td>
                  <td className="px-2 py-2.5 text-right text-sm font-semibold text-emerald-700">
                    {formatRupiah(totalPaid)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordFor && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRecordFor(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Record Payment
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {recordFor.term_label || "Term"} ·{" "}
                  {formatRupiah(recordFor.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordFor(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div onSubmit={handleRecord} className="p-5 space-y-4">
              {/* Term summary */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Term Amount</span>
                  <span className="font-medium">
                    {formatRupiah(recordFor.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Paid</span>
                  <span className="font-medium text-emerald-600">
                    {formatRupiah(recordFor.amount_paid || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-200 pt-1">
                  <span>Remaining</span>
                  <span className="text-red-600">
                    {formatRupiah(
                      Math.max(
                        (parseFloat(recordFor.amount) || 0) -
                          (parseFloat(recordFor.amount_paid) || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Payment Date *"
                  type="date"
                  value={payForm.entry_date}
                  onChange={(e) => setPay("entry_date", e.target.value)}
                  required
                />
                <CurrencyInput
                  label="Amount Received *"
                  value={payForm.gross_amount}
                  onChange={(v) => setPay("gross_amount", v)}
                  placeholder="0"
                />
                <Select
                  label="Method"
                  value={payForm.payment_method}
                  onChange={(e) => setPay("payment_method", e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Bank Account"
                  value={payForm.bank_account}
                  onChange={(e) => setPay("bank_account", e.target.value)}
                >
                  <option value="">-- Select Bank --</option>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Description"
                  value={payForm.description}
                  onChange={(e) => setPay("description", e.target.value)}
                  placeholder={`Payment — ${recordFor.term_label || "Term"}`}
                  className="col-span-2"
                />
                <Input
                  label="Notes"
                  value={payForm.notes}
                  onChange={(e) => setPay("notes", e.target.value)}
                  placeholder="optional"
                  className="col-span-2"
                />
              </div>

              {isQris && gross_pay > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-1">
                    <AlertCircle size={12} /> QRIS 0.3% deduction
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Client sends</span>
                    <span>{formatRupiah(gross_pay)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">QRIS fee</span>
                    <span className="text-red-500">
                      -{formatRupiah(qris_fee)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-amber-200 pt-1">
                    <span>Net received</span>
                    <span className="text-emerald-700">
                      {formatRupiah(net_pay)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRecordFor(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={recordMutation.isPending}
                  onClick={handleRecord}
                >
                  Record Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Workers — Table Style ────────────────────────────
function TabWorkers({ project }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    worker_id: "",
    rate_type: "daily",
    rate_amount: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const { data: allWorkers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersApi.getAll({}),
  });

  const {
    data: assignments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["project-assignments", project?.id],
    queryFn: async () => {
      if (!project?.id || !allWorkers.length) return [];
      const result = [];
      for (const w of allWorkers) {
        try {
          const assigns = await workersApi.getAssignments(w.id);
          assigns
            .filter((a) => a.project_id === project.id)
            .forEach((a) => result.push({ ...a, worker: w }));
        } catch {
          // ignore individual worker fetch errors
        }
      }
      return result;
    },
    enabled: !!project?.id && allWorkers.length > 0,
  });

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const assignedIds = assignments.map((a) => a.worker_id);

  const createAssignment = useMutation({
    mutationFn: workersApi.createAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-assignments", project?.id] });
      setShowForm(false);
      setForm({
        worker_id: "",
        rate_type: "daily",
        rate_amount: "",
        start_date: "",
        end_date: "",
        notes: "",
      });
      toast.success("Worker assigned!");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAssignment = useMutation({
    mutationFn: workersApi.deleteAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-assignments", project?.id] });
      toast.success("Worker removed.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.worker_id) return toast.error("Please select a worker");
    if (!form.rate_amount) return toast.error("Please enter rate amount");
    createAssignment.mutate({
      worker_id: parseInt(form.worker_id),
      project_id: project.id,
      rate_type: form.rate_type,
      rate_amount: parseFloat(parseCurrency(form.rate_amount)) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes || null,
      is_active: true,
    });
  };

  const inputCls =
    "w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500";

  if (!project?.id)
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Save the project first to assign workers.
      </div>
    );

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Workers ({assignments.length})
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowForm((s) => !s)}
        >
          <Plus size={14} /> Assign Worker
        </Button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-8">
                  #
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500">
                  Worker
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-32">
                  Role
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                  Wage Type
                </th>
                <th className="text-right px-2 py-2.5 text-xs font-medium text-gray-500 w-32">
                  Rate
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                  Start Date
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                  End Date
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-20">
                  Status
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500">
                  Notes
                </th>
                <th className="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {/* Add Row Form */}
              {showForm && (
                <tr className="bg-emerald-50 border-b border-emerald-200">
                  <td className="px-3 py-2 text-center text-xs text-emerald-400">
                    <Plus size={12} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={form.worker_id}
                      onChange={(e) => set("worker_id", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">-- Select --</option>
                      {allWorkers
                        .filter((w) => w.is_active)
                        .map((w) => (
                          <option
                            key={w.id}
                            value={w.id}
                            disabled={assignedIds.includes(w.id)}
                          >
                            {w.full_name}
                            {assignedIds.includes(w.id) ? " ✓" : ""}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-400 italic">
                    {form.worker_id
                      ? ROLE_OPTIONS.find(
                          (r) =>
                            r.value ===
                            allWorkers.find(
                              (w) => w.id === parseInt(form.worker_id),
                            )?.role,
                        )?.label || "-"
                      : "-"}
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={form.rate_type}
                      onChange={(e) => set("rate_type", e.target.value)}
                      className={inputCls}
                    >
                      {RATE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          form.rate_amount
                            ? new Intl.NumberFormat("id-ID").format(
                                parseCurrency(form.rate_amount),
                              )
                            : ""
                        }
                        onChange={(e) =>
                          set("rate_amount", e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="0"
                        className={`${inputCls} pl-7 text-right`}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => set("start_date", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => set("end_date", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-emerald-600 font-medium">
                    Active
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      placeholder="optional"
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={createAssignment.isPending}
                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-all"
                        title="Save"
                      >
                        <Save size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Existing Rows */}
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent mx-auto" />
                  </td>
                </tr>
              ) : assignments.length === 0 && !showForm ? (
                <tr>
                  <td
                    colSpan={10}
                    className="text-center py-8 text-gray-400 text-sm"
                  >
                    <HardHat size={24} className="mx-auto text-gray-300 mb-2" />
                    No workers assigned. Click "+ Assign Worker" to add.
                  </td>
                </tr>
              ) : (
                assignments.map((a, i) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
                          {a.worker?.full_name
                            ?.split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {a.worker?.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">
                      {ROLE_OPTIONS.find((r) => r.value === a.worker?.role)
                        ?.label || a.worker?.role}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-500">
                      {RATE_TYPE[a.rate_type]}
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm font-semibold text-gray-900">
                      {formatRupiah(a.rate_amount)}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-400">
                      {a.start_date ? formatDate(a.start_date) : "-"}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-400">
                      {a.end_date ? formatDate(a.end_date) : "-"}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge color={a.is_active ? "green" : "gray"}>
                        {a.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-gray-400 italic">
                      {a.notes || "-"}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Remove this worker from project?"))
                            deleteAssignment.mutate(a.id);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Project Detail — Full Screen IFS Style ────────────────
// Uses key={project?.id ?? 'new'} from parent to force remount
// when switching between projects — no useEffect needed
function ProjectDetail({ project, open, onClose, onSave, saving, onRefresh }) {
  const [form, setForm] = useState(() => parseHeader(project));
  const [payments, setPayments] = useState(() => parsePayments(project));
  const [deletedPaymentIds, setDeletedPaymentIds] = useState([]);
  const [activeTab, setActiveTab] = useState("payments");

  if (!open) return null;

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_name) return toast.error("Client name is required");
    if (!form.project_name) return toast.error("Project name is required");
    if (!form.received_date) return toast.error("Received date is required");

    onSave({
      ...form,
      rab_value: parseFloat(parseCurrency(form.rab_value)) || 0,
      architect_fee: parseFloat(parseCurrency(form.architect_fee)) || 0,
      deletedPaymentIds,
      payments: payments.map((p) => ({
        ...p,
        percentage: p.percentage ? parseFloat(p.percentage) : null,
        amount: p.amount ? parseFloat(parseCurrency(p.amount)) : null,
        due_date: p.due_date || null,
        paid_date: p.paid_date || null,
        notes: p.notes || null,
      })),
    });
  };

  const tabs = [
    {
      id: "payments",
      label: "Payment Terms",
      icon: CreditCard,
      count: payments.length,
    },
    { id: "workers", label: "Workers", icon: HardHat },
  ];

  const hLabel =
    "text-xs font-medium text-gray-400 uppercase tracking-wide mb-1";
  const hInput =
    "w-full text-sm text-gray-900 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-emerald-500 pb-0.5";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#f9fafb" }}
    >
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xs"
          >
            Projects
          </button>
          <span className="text-gray-600">›</span>
          <span className="text-white font-medium">
            {project
              ? `PRJ-${String(project.id).padStart(5, "0")} — ${project.project_name}`
              : "New Project"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={saving}
            onClick={() => document.getElementById("proj-form").requestSubmit()}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            ) : (
              <Save size={14} />
            )}
            {project ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </div>

      <form
        id="proj-form"
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Sticky Header */}
        <div className="bg-white border-b border-gray-200 shrink-0">
          {/* Row 1: ID + Status + Stats */}
          <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 border-b border-gray-200">
            {project && (
              <span className="font-mono text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-500">
                PRJ-{String(project.id).padStart(5, "0")}
              </span>
            )}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-gray-400">Status:</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {project && (
              <div className="flex items-center gap-6 text-xs">
                <div className="text-right">
                  <div className="text-gray-400">Collected</div>
                  <div className="font-semibold text-emerald-700">
                    {formatRupiah(project.total_paid)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">Outstanding</div>
                  <div className="font-semibold text-red-500">
                    {formatRupiah(project.total_outstanding)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">Progress</div>
                  <div className="font-semibold text-gray-900">
                    {project.progress_percent}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Client fields */}
          <div className="grid grid-cols-4 divide-x divide-gray-200 border-b border-gray-200">
            <div className="px-4 py-2.5">
              <div className={hLabel}>Client Name *</div>
              <input
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="Client name"
                required
                className={hInput}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Phone</div>
              <input
                value={form.client_phone}
                onChange={(e) => set("client_phone", e.target.value)}
                placeholder="Phone number"
                className={hInput}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Project Name *</div>
              <input
                value={form.project_name}
                onChange={(e) => set("project_name", e.target.value)}
                placeholder="Project name"
                required
                className={hInput}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Location</div>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Location"
                className={hInput}
              />
            </div>
          </div>

          {/* Row 3: Dates + Values */}
          <div className="grid grid-cols-6 divide-x divide-gray-200">
            <div className="px-4 py-2.5">
              <div className={hLabel}>Received Date *</div>
              <input
                type="date"
                value={form.received_date}
                onChange={(e) => set("received_date", e.target.value)}
                required
                className={`${hInput} text-sm`}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Start Date</div>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                className={`${hInput} text-sm`}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Target Completion</div>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                className={`${hInput} text-sm`}
              />
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>RAB Value</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    form.rab_value
                      ? new Intl.NumberFormat("id-ID").format(
                          parseCurrency(form.rab_value),
                        )
                      : ""
                  }
                  onChange={(e) =>
                    set("rab_value", e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className={`${hInput} text-right flex-1`}
                />
              </div>
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Architect Fee</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    form.architect_fee
                      ? new Intl.NumberFormat("id-ID").format(
                          parseCurrency(form.architect_fee),
                        )
                      : ""
                  }
                  onChange={(e) =>
                    set("architect_fee", e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0"
                  className={`${hInput} text-right flex-1`}
                />
              </div>
            </div>
            <div className="px-4 py-2.5">
              <div className={hLabel}>Notes</div>
              <input
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Additional notes"
                className={hInput}
              />
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "payments" && (
            <TabPayments
              payments={payments}
              setPayments={setPayments}
              deletedPaymentIds={deletedPaymentIds}
              setDeletedPaymentIds={setDeletedPaymentIds}
              architectFee={form.architect_fee}
              projectId={project?.id}
              onDataRefresh={onRefresh}
            />
          )}
          {activeTab === "workers" && <TabWorkers project={project} />}
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Projects() {
  const qc = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", filterStatus],
    queryFn: () =>
      projectsApi.getAll(filterStatus ? { status: filterStatus } : {}),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { payments, deletedPaymentIds: _del, ...projectData } = data;
      const project = await projectsApi.create({
        ...projectData,
        payments: [],
      });
      for (const p of payments) await projectsApi.addPayment(project.id, p);
      return project;
    },
    onSuccess: () => {
      invalidate();
      setDetailOpen(false);
      toast.success("Project created!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { payments, deletedPaymentIds, ...projectData } = data;
      await projectsApi.update(id, projectData);
      for (const pid of deletedPaymentIds || [])
        await projectsApi.deletePayment(pid);
      for (const p of payments) {
        if (p.id) {
          // eslint-disable-next-line no-unused-vars
          const { id: pid, amount_paid, ...rest } = p;
          await projectsApi.updatePayment(pid, rest);
        } else {
          await projectsApi.addPayment(id, p);
        }
      }
    },
    onSuccess: () => {
      invalidate();
      setDetailOpen(false);
      setEditData(null);
      toast.success("Project updated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      invalidate();
      toast.success("Project deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = (data) => {
    if (editData) updateMutation.mutate({ id: editData.id, data });
    else createMutation.mutate(data);
  };

  const handleOpen = async (project) => {
    setLoading(true);
    try {
      if (project) {
        const fresh = await projectsApi.getById(project.id);
        setEditData(fresh);
      } else {
        setEditData(null);
      }
      setDetailOpen(true);
    } catch {
      toast.error("Failed to load project data");
    } finally {
      setLoading(false);
    }
  };

  // Refresh project data after recording payment
  // Called by TabPayments after successful payment record
  // BARU — return fresh data
  const handleRefreshProject = async () => {
    if (!editData?.id) return;
    try {
      const fresh = await projectsApi.getById(editData.id);
      setEditData(fresh);
      return fresh; // ← WAJIB: return supaya TabPayments bisa update state
    } catch {
      // ignore
    }
  };

  const filters = [
    { label: "All", value: "" },
    { label: "Pending", value: "pending" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
    { label: "On Hold", value: "on_hold" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {projects.length} projects found
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpen(null)}
          loading={loading}
        >
          <Plus size={16} /> Add Project
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === f.value
                ? "bg-emerald-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">
              No projects yet. Click "Add Project" to get started.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const st = PROJECT_STATUS[p.status] || {};
            const isExp = expandedId === p.id;
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
              >
                <div className="flex items-stretch divide-x divide-gray-100">
                  <div className="flex flex-col justify-center px-4 py-3 min-w-25 bg-gray-50">
                    <span className="text-xs text-gray-400 font-medium mb-0.5">
                      PRJ No.
                    </span>
                    <span className="text-sm font-mono font-bold text-emerald-700">
                      PRJ-{String(p.id).padStart(5, "0")}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-4 py-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">
                        {p.project_name}
                      </span>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.client_name}
                      {p.location ? ` · ${p.location}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center px-4 py-3 min-w-30">
                    <span className="text-xs text-gray-400 mb-0.5">
                      Architect Fee
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatRupiah(p.architect_fee)}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center px-4 py-3 w-36">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="font-medium text-emerald-600">
                        {p.progress_percent}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${p.progress_percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center px-4 py-3 min-w-32 text-right">
                    <span className="text-xs text-gray-400 mb-0.5">
                      Collected
                    </span>
                    <span className="text-sm font-medium text-emerald-700">
                      {formatRupiah(p.total_paid)}
                    </span>
                    <span className="text-xs text-red-400">
                      Outstanding: {formatRupiah(p.total_outstanding)}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 px-3">
                    <button
                      onClick={() => handleOpen(p)}
                      disabled={loading}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Open"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this project?"))
                          deleteMutation.mutate(p.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExp ? null : p.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      {isExp ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Payment Terms */}
                {isExp && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Payment Terms
                      </span>
                      <span className="text-xs text-gray-400">
                        RAB: {formatRupiah(p.rab_value)}
                      </span>
                    </div>
                    {!p.payments?.length ? (
                      <p className="text-xs text-gray-400 italic">
                        No payment terms configured.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {p.payments.map((pay, i) => {
                          const ps = pay.status || "unpaid";
                          const amtPaid = parseFloat(pay.amount_paid || 0);
                          const termAmt = parseFloat(pay.amount || 0);
                          const paidPct =
                            termAmt > 0
                              ? Math.min((amtPaid / termAmt) * 100, 100)
                              : 0;
                          const rowColor = {
                            paid: "bg-emerald-50 border-emerald-200",
                            partial: "bg-amber-50 border-amber-200",
                            unpaid: "bg-white border-gray-200",
                          };
                          return (
                            <div
                              key={pay.id || i}
                              className={`p-3 rounded-lg border ${rowColor[ps]}`}
                            >
                              <div className="flex items-center gap-3">
                                {ps === "paid" ? (
                                  <CheckCircle
                                    size={14}
                                    className="text-emerald-500"
                                  />
                                ) : ps === "partial" ? (
                                  <Clock size={14} className="text-amber-500" />
                                ) : (
                                  <Circle size={14} className="text-gray-300" />
                                )}
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-800">
                                    {pay.term_label || `Term ${i + 1}`}
                                  </span>
                                  {pay.due_date && (
                                    <span className="text-xs text-gray-400 ml-2">
                                      · Due: {formatDate(pay.due_date)}
                                    </span>
                                  )}
                                  {pay.paid_date && (
                                    <span className="text-xs text-gray-400 ml-2">
                                      · Paid: {formatDate(pay.paid_date)}
                                    </span>
                                  )}
                                </div>
                                {pay.percentage && (
                                  <span className="text-xs text-gray-400">
                                    {pay.percentage}%
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatRupiah(pay.amount)}
                                </span>
                                <Badge
                                  color={
                                    ps === "paid"
                                      ? "green"
                                      : ps === "partial"
                                        ? "amber"
                                        : "gray"
                                  }
                                >
                                  {ps === "paid"
                                    ? "Paid"
                                    : ps === "partial"
                                      ? "Partial"
                                      : "Unpaid"}
                                </Badge>
                              </div>
                              {ps === "partial" && termAmt > 0 && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{ width: `${paidPct}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                    <span>Paid: {formatRupiah(amtPaid)}</span>
                                    <span>
                                      Remaining:{" "}
                                      {formatRupiah(termAmt - amtPaid)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Screen Detail */}
      <ProjectDetail
        key={editData?.id ?? "new"}
        open={detailOpen}
        project={editData}
        onClose={() => {
          setDetailOpen(false);
          setEditData(null);
        }}
        onSave={handleSave}
        saving={createMutation.isPending || updateMutation.isPending}
        onRefresh={handleRefreshProject}
      />
    </div>
  );
}
