import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "../api/materials";
import { ledgerApi } from "../api/ledger";
import { subProjectsApi } from "../api/subProjects";
import { formatRupiah, formatDate, BANK_OPTIONS } from "../utils/format";
import { AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function POPaymentForm({ order, remaining, onPaymentSaved, suppliers }) {
  const qc = useQueryClient();

  const [payForm, setPayForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    paid_by: "",
    bank_account: "",
    payment_method: "transfer",
    notes: "",
  });
  const [usePettyCash, setUsePettyCash] = useState(false);
  const [selectedPcId, setSelectedPcId] = useState("");

  const setPF = (k, v) => setPayForm((p) => ({ ...p, [k]: v }));

  // Query kas tukang yang masih open untuk sub project ini
  const { data: pettyCashOptions = [] } = useQuery({
    queryKey: ["petty-cash-open", order.sub_project_id],
    queryFn: () => subProjectsApi.getPettyCash(order.sub_project_id, "open"),
    enabled: !!order.sub_project_id,
  });

  const addPayment = useMutation({
    mutationFn: async (data) => {
      const supplier = suppliers?.find((s) => s.id === order.supplier_id);
      const poLabel = `PO-${String(order.id).padStart(5, "0")}`;
      const suppName = supplier?.store_name || "Supplier";
      const isPettyCash = !!data.petty_cash_id;

      // 1. Buat ledger entry expense
      const ledgerEntry = await ledgerApi.createExpense({
        entry_date: data.payment_date,
        entry_type: "expense",
        description: `${poLabel} · ${suppName}`,
        paid_to: data.paid_by || suppName,
        gross_expense: data.amount,
        discount_received: 0,
        payment_method: isPettyCash ? "cash" : (data.payment_method || "transfer"),
        bank_account: isPettyCash ? null : (data.bank_account || null),
        project_id: order.project_id || null,
        sub_project_id: order.sub_project_id || null,
        purchase_order_id: order.id,
        petty_cash_id: data.petty_cash_id || null,
        source: "po_payment",
        notes: isPettyCash
          ? `[Kas Tukang]${data.notes ? ` ${data.notes}` : ""}`
          : data.notes || null,
      });

      // 2. Buat PO payment record dengan ledger_entry_id dan petty_cash_id
      const payment = await materialsApi.addPOPayment(order.id, {
        payment_date: data.payment_date,
        amount: data.amount,
        paid_by: data.paid_by || null,
        bank_account: isPettyCash ? null : (data.bank_account || null),
        payment_method: isPettyCash ? "cash" : (data.payment_method || "transfer"),
        notes: data.notes || null,
        ledger_entry_id: ledgerEntry.id,
        petty_cash_id: data.petty_cash_id || null,
      });

      return payment;
    },
    onSuccess: () => {
      // Reset form
      setPayForm({
        payment_date: new Date().toISOString().split("T")[0],
        amount: "",
        paid_by: "",
        bank_account: "",
        payment_method: "transfer",
        notes: "",
      });
      setUsePettyCash(false);
      setSelectedPcId("");

      // Invalidate petty cash supaya saldo sisa terupdate
      if (order.sub_project_id) {
        qc.invalidateQueries({ queryKey: ["petty-cash-open", order.sub_project_id] });
        qc.invalidateQueries({ queryKey: ["petty-cash", order.sub_project_id] });
      }

      onPaymentSaved?.();
      toast.success("Pembayaran dicatat & masuk ledger!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const amt = parseFloat(String(payForm.amount).replace(/\D/g, "")) || 0;
    if (!amt) return toast.error("Jumlah pembayaran harus diisi");
    if (!payForm.payment_date) return toast.error("Tanggal harus diisi");
    if (usePettyCash && !selectedPcId) return toast.error("Pilih kas tukang yang dipakai");

    // Validasi sisa kas tukang
    if (usePettyCash && selectedPcId) {
      const pc = pettyCashOptions.find((p) => p.id === parseInt(selectedPcId));
      if (pc && amt > parseFloat(pc.remaining || 0)) {
        return toast.error(
          `Jumlah melebihi sisa kas tukang (${formatRupiah(pc.remaining)})`,
        );
      }
    }

    addPayment.mutate({
      ...payForm,
      amount: amt,
      petty_cash_id: usePettyCash ? parseInt(selectedPcId) : null,
    });
  };

  const fI =
    "text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full";

  // Hitung preview sisa kas tukang
  const selectedPc = usePettyCash && selectedPcId
    ? pettyCashOptions.find((p) => p.id === parseInt(selectedPcId))
    : null;
  const payAmt = parseFloat(String(payForm.amount).replace(/\D/g, "")) || 0;
  const sisaKasPreview = selectedPc
    ? parseFloat(selectedPc.remaining || 0) - payAmt
    : null;

  if (remaining <= 0) {
    return (
      <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100">
        <p className="text-xs text-emerald-600 font-medium text-center">
          ✓ PO ini sudah lunas
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-blue-50/30 space-y-3">
      {/* Header */}
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        + Catat Pembayaran
        <span className="ml-2 text-blue-500 normal-case font-normal">
          Sisa {formatRupiah(remaining)}
        </span>
      </div>

      {/* Toggle: bayar pakai kas tukang */}
      {order.sub_project_id && pettyCashOptions.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-100 rounded-lg">
          <input
            type="checkbox"
            id={`use-petty-cash-${order.id}`}
            checked={usePettyCash}
            onChange={(e) => {
              setUsePettyCash(e.target.checked);
              if (!e.target.checked) setSelectedPcId("");
            }}
            className="rounded border-gray-300 text-purple-600"
          />
          <label
            htmlFor={`use-petty-cash-${order.id}`}
            className="text-xs font-medium text-purple-700 cursor-pointer"
          >
            💵 Bayar pakai Kas Tukang
          </label>
          {usePettyCash && (
            <select
              value={selectedPcId}
              onChange={(e) => setSelectedPcId(e.target.value)}
              className="ml-1 text-xs border border-purple-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 flex-1"
            >
              <option value="">-- Pilih Kas --</option>
              {pettyCashOptions.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.given_to || "Tukang"} · {formatDate(pc.cash_date)} ·
                  sisa {formatRupiah(pc.remaining)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-6 gap-2 items-end">
        <div>
          <div className="text-xs text-gray-400 mb-1">Tanggal *</div>
          <input
            type="date"
            value={payForm.payment_date}
            onChange={(e) => setPF("payment_date", e.target.value)}
            className={fI}
          />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Jumlah *</div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={
                payForm.amount
                  ? new Intl.NumberFormat("id-ID").format(
                      String(payForm.amount).replace(/\D/g, ""),
                    )
                  : ""
              }
              onChange={(e) => setPF("amount", e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className={`${fI} pl-7`}
            />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Dibayar Oleh</div>
          <input
            type="text"
            value={payForm.paid_by}
            onChange={(e) => setPF("paid_by", e.target.value)}
            placeholder="Nama / perusahaan"
            className={fI}
          />
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Bank</div>
          {usePettyCash ? (
            <div className={`${fI} bg-gray-100 text-gray-400 flex items-center`}>
              💵 Kas Tukang
            </div>
          ) : (
            <select
              value={payForm.bank_account}
              onChange={(e) => setPF("bank_account", e.target.value)}
              className={fI}
            >
              <option value="">-- Bank --</option>
              {BANK_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Catatan</div>
          <input
            type="text"
            value={payForm.notes}
            onChange={(e) => setPF("notes", e.target.value)}
            placeholder="optional"
            className={fI}
          />
        </div>
        <div>
          <button
            onClick={handleSubmit}
            disabled={addPayment.isPending || (usePettyCash && !selectedPcId)}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {addPayment.isPending ? "..." : "Simpan"}
          </button>
        </div>
      </div>

      {/* Preview sisa kas tukang */}
      {selectedPc && payAmt > 0 && (
        <div
          className={`p-2 rounded-lg text-xs flex items-center gap-1.5 ${
            sisaKasPreview < 0
              ? "bg-red-50 border border-red-100 text-red-600"
              : "bg-purple-50 border border-purple-100 text-purple-600"
          }`}
        >
          <AlertCircle size={11} className="shrink-0" />
          {sisaKasPreview < 0
            ? `Jumlah melebihi sisa kas tukang (kurang ${formatRupiah(Math.abs(sisaKasPreview))})`
            : `Sisa kas tukang setelah ini: ${formatRupiah(sisaKasPreview)}`}
        </div>
      )}
    </div>
  );
}
