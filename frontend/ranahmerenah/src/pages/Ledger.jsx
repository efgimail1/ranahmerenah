import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ledgerApi } from "../api/ledger";
import { projectsApi } from "../api/projects";
import { subProjectsApi } from "../api/subprojects";
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
  BANK_OPTIONS,
} from "../utils/format";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Pencil,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "qris", label: "QRIS" },
  { value: "other", label: "Other" },
];
const QRIS_FEE_RATE = 0.003;
const methodLabel = {
  cash: "Cash",
  transfer: "Transfer",
  qris: "QRIS",
  other: "Other",
};

// ─── Income Form ───────────────────────────────────────────
function IncomeForm({
  initial,
  onSubmit,
  loading,
  projects,
  isLinked = false,
}) {
  const [form, setForm] = useState(
    initial
      ? {
          entry_date: toInputDate(initial.entry_date),
          description: initial.description || "",
          received_from: initial.received_from || "",
          gross_amount: initial.gross_amount
            ? String(Math.round(parseFloat(initial.gross_amount)))
            : "",
          payment_method: initial.payment_method || "transfer",
          bank_account: initial.bank_account || "",
          project_id: initial.project_id || "",
          project_payment_id: initial.project_payment_id || "",
          is_qris: initial.is_qris || false,
          notes: initial.notes || "",
        }
      : {
          entry_date: "",
          description: "",
          received_from: "",
          gross_amount: "",
          payment_method: "transfer",
          bank_account: "",
          project_id: "",
          project_payment_id: "",
          is_qris: false,
          notes: "",
        },
  );

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const gross = parseFloat(parseCurrency(form.gross_amount)) || 0;
  const qrisFee = form.is_qris ? Math.round(gross * QRIS_FEE_RATE) : 0;
  const netAmount = gross - qrisFee;

  // Load payment terms dari project yang dipilih
  const selectedProject = projects.find(
    (p) => p.id === parseInt(form.project_id),
  );
  const paymentTerms = selectedProject?.payments || [];

  // Auto-fill amount dari payment term yang dipilih
  const handleTermSelect = (termId) => {
    set("project_payment_id", termId);
    if (termId) {
      const term = paymentTerms.find((t) => t.id === parseInt(termId));
      if (term) {
        const remaining = Math.max(
          (parseFloat(term.amount) || 0) - (parseFloat(term.amount_paid) || 0),
          0,
        );
        // Auto-fill description jika belum diisi
        if (!form.description) {
          set("description", `Payment — ${term.term_label || "Term"}`);
        }
        // Auto-fill amount dengan sisa yang belum dibayar
        if (remaining > 0) {
          set("gross_amount", String(Math.round(remaining)));
        }
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      entry_type: "income",
      gross_amount: gross,
      is_qris: form.is_qris,
      project_id: form.project_id ? parseInt(form.project_id) : null,
      project_payment_id: form.project_payment_id
        ? parseInt(form.project_payment_id)
        : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Income Details
      </h4>

      {isLinked && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-semibold mb-0.5">Limited editing</p>
            <p>
              This entry is linked to a payment term. Amount and date cannot be
              changed. To change the amount, void this entry and create a new
              one.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Date *"
          type="date"
          value={form.entry_date}
          onChange={(e) => set("entry_date", e.target.value)}
          required
          disabled={isLinked}
        />

        <Input
          label="Received From *"
          value={form.received_from}
          onChange={(e) => set("received_from", e.target.value)}
          placeholder="e.g. Mr. Budi"
          required
          disabled={isLinked}
        />

        <Input
          label="Description *"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Down Payment — Villa Project"
          className="col-span-2"
          required
        />

        <Select
          label="Payment Method"
          value={form.payment_method}
          onChange={(e) => {
            set("payment_method", e.target.value);
            set("is_qris", e.target.value === "qris");
          }}
          disabled={isLinked}
        >
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          label="Bank Account"
          value={form.bank_account}
          onChange={(e) => set("bank_account", e.target.value)}
          disabled={isLinked}
        >
          <option value="">-- Select Bank --</option>
          {BANK_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>

        {/* Project — ketika berubah, reset payment term */}
        <Select
          label="Project"
          value={form.project_id}
          onChange={(e) => {
            set("project_id", e.target.value);
            set("project_payment_id", ""); // reset term saat project berubah
          }}
          disabled={isLinked}
        >
          <option value="">-- Select Project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </Select>

        {/* Payment Term — hanya muncul jika project dipilih */}
        {form.project_id && !isLinked && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Payment Term
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <select
              value={form.project_payment_id}
              onChange={(e) => handleTermSelect(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            >
              <option value="">-- No specific term --</option>
              {paymentTerms.map((t) => {
                const amtPaid = parseFloat(t.amount_paid || 0);
                const termAmt = parseFloat(t.amount || 0);
                const remaining = Math.max(termAmt - amtPaid, 0);
                const isPaid = t.status === "paid";
                return (
                  <option key={t.id} value={t.id} disabled={isPaid}>
                    {t.term_label || `Term ${t.id}`}
                    {" — "}
                    {isPaid
                      ? "✓ Paid"
                      : `Remaining: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(remaining)}`}
                  </option>
                );
              })}
            </select>

            {/* Info box jika term dipilih */}
            {form.project_payment_id &&
              (() => {
                const term = paymentTerms.find(
                  (t) => t.id === parseInt(form.project_payment_id),
                );
                if (!term) return null;
                const amtPaid = parseFloat(term.amount_paid || 0);
                const termAmt = parseFloat(term.amount || 0);
                const remaining = Math.max(termAmt - amtPaid, 0);
                return (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1 mt-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Term Amount</span>
                      <span className="font-medium">
                        {formatRupiah(termAmt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Already Paid</span>
                      <span className="font-medium text-emerald-600">
                        {formatRupiah(amtPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-emerald-200 pt-1">
                      <span className="text-gray-700">Remaining</span>
                      <span className="text-emerald-700">
                        {formatRupiah(remaining)}
                      </span>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Kalau project dipilih tapi tidak ada terms */}
        {form.project_id && !isLinked && paymentTerms.length === 0 && (
          <div className="flex items-center">
            <p className="text-xs text-gray-400 italic">
              No payment terms configured for this project.
            </p>
          </div>
        )}

        <CurrencyInput
          label="Gross Amount *"
          value={form.gross_amount}
          onChange={(v) => set("gross_amount", v)}
          placeholder="0"
          disabled={isLinked}
        />

        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="optional"
          className="col-span-2"
        />
      </div>

      {form.is_qris && gross > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
            <AlertCircle size={14} /> QRIS Deduction 0.3%
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount sent by client</span>
            <span className="font-medium">{formatRupiah(gross)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">QRIS fee (0.3%)</span>
            <span className="font-medium text-red-500">
              - {formatRupiah(qrisFee)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t border-amber-200 pt-1.5">
            <span className="text-gray-800">Net amount received</span>
            <span className="text-emerald-700">{formatRupiah(netAmount)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? "Save Changes" : "Save Income"}
        </Button>
      </div>
    </form>
  );
}

// ─── Expense Form ──────────────────────────────────────────
function ExpenseForm({ initial, onSubmit, loading, projects }) {
  const [form, setForm] = useState(
    initial
      ? {
          entry_date: toInputDate(initial.entry_date),
          description: initial.description || "",
          paid_to: initial.paid_to || "",
          gross_expense: initial.gross_expense
            ? String(Math.round(parseFloat(initial.gross_expense)))
            : "",
          discount_received: initial.discount_received
            ? String(Math.round(parseFloat(initial.discount_received)))
            : "",
          payment_method: initial.payment_method || "cash",
          bank_account: initial.bank_account || "",
          project_id: initial.project_id || "",
          sub_project_id: initial.sub_project_id || "",
          notes: initial.notes || "",
        }
      : {
          entry_date: "",
          description: "",
          paid_to: "",
          gross_expense: "",
          discount_received: "",
          payment_method: "cash",
          bank_account: "",
          project_id: "",
          sub_project_id: "",
          notes: "",
        },
  );

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const gross = parseFloat(parseCurrency(form.gross_expense)) || 0;
  const discount = parseFloat(parseCurrency(form.discount_received)) || 0;
  const net = gross - discount;

  const selectedProject = projects.find(
    (p) => p.id === parseInt(form.project_id),
  );
  const isContractor = selectedProject?.project_type === "contractor";

  const { data: subProjects = [] } = useQuery({
    queryKey: ["sub-projects-ledger-form", form.project_id],
    queryFn: () => subProjectsApi.getByProject(parseInt(form.project_id)),
    enabled: !!form.project_id && isContractor,
  });

  const handleProjectChange = (val) => {
    set("project_id", val);
    set("sub_project_id", ""); // reset sub project saat project berubah
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      entry_type: "expense",
      gross_expense: gross,
      discount_received: discount,
      project_id: form.project_id ? parseInt(form.project_id) : null,
      sub_project_id: form.sub_project_id
        ? parseInt(form.sub_project_id)
        : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Expense Details
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Date *"
          type="date"
          value={form.entry_date}
          onChange={(e) => set("entry_date", e.target.value)}
          required
        />
        <Input
          label="Paid To"
          value={form.paid_to}
          onChange={(e) => set("paid_to", e.target.value)}
          placeholder="e.g. TB Makmur / Mr. Ahmad"
        />
        <Input
          label="Description *"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Material purchase — Villa project"
          className="col-span-2"
          required
        />
        <Select
          label="Payment Method"
          value={form.payment_method}
          onChange={(e) => set("payment_method", e.target.value)}
        >
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          label="Bank Account"
          value={form.bank_account}
          onChange={(e) => set("bank_account", e.target.value)}
        >
          <option value="">-- Select Bank --</option>
          {BANK_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select
          label="Project"
          value={form.project_id}
          onChange={(e) => handleProjectChange(e.target.value)}
        >
          <option value="">-- Select Project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_type === "contractor" ? "🏗 " : ""}
              {p.project_name}
            </option>
          ))}
        </Select>

        {isContractor && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Sub Project
              <span className="text-orange-400 font-normal ml-1">
                kontraktor
              </span>
            </label>
            <select
              value={form.sub_project_id}
              onChange={(e) => set("sub_project_id", e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all ${
                !form.sub_project_id
                  ? "border-orange-300 bg-orange-50/30"
                  : "border-gray-300"
              }`}
            >
              <option value="">-- Select Sub Project --</option>
              {subProjects.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
            {subProjects.length === 0 && (
              <p className="text-xs text-amber-500">
                Belum ada sub project untuk project ini.
              </p>
            )}
          </div>
        )}
        <CurrencyInput
          label="Gross Amount (before discount)"
          value={form.gross_expense}
          onChange={(v) => set("gross_expense", v)}
          placeholder="0"
        />
        <CurrencyInput
          label="Discount Received"
          value={form.discount_received}
          onChange={(v) => set("discount_received", v)}
          placeholder="0"
        />
        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="optional"
          className="col-span-2"
        />
      </div>

      {gross > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount before discount</span>
            <span className="font-medium">{formatRupiah(gross)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount received</span>
              <span className="font-medium text-emerald-600">
                - {formatRupiah(discount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
            <span className="text-gray-800">Net amount paid</span>
            <span className="text-red-600">{formatRupiah(net)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" variant="primary" loading={loading}>
          {initial ? "Save Changes" : "Save Expense"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function Ledger() {
  const qc = useQueryClient();
  const [modalType, setModalType] = useState(null); // 'income'|'expense'|'edit'
  const [editEntry, setEditEntry] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSubProject, setFilterSubProject] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = {};
  if (filterType) params.entry_type = filterType;
  if (filterProject) params.project_id = filterProject;
  if (filterSubProject) params.sub_project_id = filterSubProject;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["ledger", filterType, filterProject, filterSubProject, dateFrom, dateTo],
    queryFn: () => ledgerApi.getAll(params),
  });

  const { data: summary } = useQuery({
    queryKey: ["ledger-summary", filterProject, filterSubProject, dateFrom, dateTo],
    queryFn: () =>
      ledgerApi.getSummary(
        filterProject || filterSubProject || dateFrom || dateTo
          ? {
              project_id: filterProject || undefined,
              sub_project_id: filterSubProject || undefined,
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined,
            }
          : {},
      ),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const selectedFilterProject = projects.find(
  (p) => p.id === parseInt(filterProject),
);
const isContractorFilter =
  selectedFilterProject?.project_type === "contractor";

const { data: filterSubProjects = [] } = useQuery({
  queryKey: ["sub-projects-ledger-filter", filterProject],
  queryFn: () => subProjectsApi.getByProject(parseInt(filterProject)),
  enabled: !!filterProject && isContractorFilter,
});

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["ledger"] });
    qc.invalidateQueries({ queryKey: ["ledger-summary"] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  const incomeMutation = useMutation({
    mutationFn: ledgerApi.createIncome,
    onSuccess: () => {
      inv();
      setModalType(null);
      toast.success("Income recorded!");
    },
    onError: (e) => toast.error(e.message),
  });

  const expenseMutation = useMutation({
    mutationFn: ledgerApi.createExpense,
    onSuccess: () => {
      inv();
      setModalType(null);
      toast.success("Expense recorded!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ledgerApi.update(id, data),
    onSuccess: () => {
      inv();
      setModalType(null);
      setEditEntry(null);
      toast.success("Entry updated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ledgerApi.delete,
    onSuccess: () => {
      inv();
      toast.success("Entry deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  const voidMutation = useMutation({
    mutationFn: (entry) => ledgerApi.delete(entry.id),
    onSuccess: () => {
      inv();
      toast.success("Payment voided. Term status has been reset.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleVoid = (entry) => {
    const amt = formatRupiah(entry.net_amount);
    if (
      confirm(
        `Void this payment of ${amt}?\n\n` +
          `This will remove the income entry and reset the payment term status.\n\n` +
          `Are you sure?`,
      )
    ) {
      voidMutation.mutate(entry);
    }
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setModalType("edit");
  };

  const handleEditSubmit = (data) => {
    updateMutation.mutate({ id: editEntry.id, data });
  };

  const projectMap = Object.fromEntries(
    projects.map((p) => [p.id, p.project_name]),
  );

  // Collect unique contractor project IDs from entries to build sub project name map
const contractorProjectIds = [
  ...new Set(
    entries
      .filter(
        (e) =>
          e.sub_project_id &&
          projects.find((p) => p.id === e.project_id)?.project_type ===
            "contractor",
      )
      .map((e) => e.project_id),
  ),
];

const { data: allSubProjects = [] } = useQuery({
  queryKey: ["sub-projects-all-in-ledger", contractorProjectIds.join(",")],
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
filterSubProjects.forEach((sp) => {
  subProjectNameMap[sp.id] = sp.name;
});
allSubProjects.forEach((sp) => {
  subProjectNameMap[sp.id] = sp.name;
});

  const totalIncome = summary?.total_income || 0;
  const totalExpense = summary?.total_expense || 0;
  const netBalance = summary?.net_balance || 0;
  const totalDiscount = summary?.total_discount_received || 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Income & expense tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModalType("expense")}>
            <TrendingDown size={16} className="text-red-500" /> Record Expense
          </Button>
          <Button variant="primary" onClick={() => setModalType("income")}>
            <TrendingUp size={16} /> Record Income
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={16} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">
              Total Income
            </span>
          </div>
          <p className="text-lg font-bold text-emerald-700">
            {formatRupiah(totalIncome)}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={16} className="text-red-500" />
            <span className="text-xs font-medium text-red-600">
              Total Expense
            </span>
          </div>
          <p className="text-lg font-bold text-red-600">
            {formatRupiah(totalExpense)}
          </p>
        </div>
        <div
          className={`border rounded-xl p-4 ${netBalance >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet
              size={16}
              className={netBalance >= 0 ? "text-blue-600" : "text-orange-500"}
            />
            <span
              className={`text-xs font-medium ${netBalance >= 0 ? "text-blue-600" : "text-orange-600"}`}
            >
              Net Balance
            </span>
          </div>
          <p
            className={`text-lg font-bold ${netBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}
          >
            {formatRupiah(netBalance)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500">
              Total Discount Received
            </span>
          </div>
          <p className="text-lg font-bold text-gray-700">
            {formatRupiah(totalDiscount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { l: "All", v: "" },
            { l: "Income", v: "income" },
            { l: "Expense", v: "expense" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilterType(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === f.v
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        <select
  value={filterProject}
  onChange={(e) => {
    setFilterProject(e.target.value);
    setFilterSubProject("");
  }}
  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
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
    className="text-sm border border-orange-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 w-44"
  >
    <option value="">All Sub Projects</option>
    {filterSubProjects.map((sp) => (
      <option key={sp.id} value={sp.id}>
        {sp.name}
      </option>
    ))}
  </select>
)}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-emerald-600 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Wallet size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No ledger entries yet.</p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    From / To
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">
                    Method
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                    Bank
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
  Project
</th>
<th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
  Sub Project
</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                    Gross
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">
                    Net
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">
                    Type
                  </th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => {
                  const isIncome = entry.entry_type === "income";
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(entry.entry_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {entry.description}
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-gray-400 italic">
                            {entry.notes}
                          </div>
                        )}
                        {entry.is_qris && (
                          <div className="text-xs text-amber-600">
                            QRIS fee: {formatRupiah(entry.qris_fee_amount)}
                          </div>
                        )}
                        {!isIncome &&
                          parseFloat(entry.discount_received || 0) > 0 && (
                            <div className="text-xs text-emerald-600">
                              Discount: {formatRupiah(entry.discount_received)}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {isIncome ? entry.received_from : entry.paid_to || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {methodLabel[entry.payment_method] || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {entry.bank_account ? (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 rounded px-1.5 py-0.5">
                            {entry.bank_account}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
  {entry.project_id
    ? projectMap[entry.project_id] || "-"
    : "-"}
</td>
<td className="px-4 py-3 text-xs text-orange-600">
  {entry.sub_project_id
    ? subProjectNameMap[entry.sub_project_id] || `Sub #${entry.sub_project_id}`
    : "-"}
</td>
                      <td className="px-4 py-3 text-right text-gray-700 text-xs">
                        {formatRupiah(
                          isIncome ? entry.gross_amount : entry.gross_expense,
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isIncome ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            + {formatRupiah(entry.net_amount)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-red-600">
                            - {formatRupiah(entry.net_expense)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={isIncome ? "green" : "red"}>
                          {isIncome ? "Income" : "Expense"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(entry)}
                            title="Edit"
                            className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Pencil size={13} />
                          </button>

                          {/* Void button — untuk entry yang linked ke payment term */}
                          {entry.project_payment_id && (
                            <button
                              onClick={() => handleVoid(entry)}
                              title="Void this payment"
                              className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}

                          {/* Delete — hanya untuk entry yang tidak linked ke payment term */}
                          {!entry.project_payment_id && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to delete this entry?",
                                  )
                                )
                                  deleteMutation.mutate(entry.id);
                              }}
                              title="Delete"
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td
                    colSpan={7}
                    className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    Total ({entries.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                    {formatRupiah(
                      entries.reduce(
                        (s, e) =>
                          s +
                          parseFloat(
                            e.entry_type === "income"
                              ? e.gross_amount || 0
                              : e.gross_expense || 0,
                          ),
                        0,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {netBalance >= 0 ? (
                      <span className="text-emerald-700">
                        + {formatRupiah(netBalance)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        {formatRupiah(netBalance)}
                      </span>
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <Modal
        open={modalType === "income"}
        onClose={() => setModalType(null)}
        title="Record Income"
        size="md"
      >
        <IncomeForm
          key="income"
          onSubmit={(d) => incomeMutation.mutate(d)}
          loading={incomeMutation.isPending}
          projects={projects}
        />
      </Modal>

      <Modal
        open={modalType === "expense"}
        onClose={() => setModalType(null)}
        title="Record Expense"
        size="md"
      >
        <ExpenseForm
          key="expense"
          onSubmit={(d) => expenseMutation.mutate(d)}
          loading={expenseMutation.isPending}
          projects={projects}
        />
      </Modal>

      <Modal
        open={modalType === "edit" && !!editEntry}
        onClose={() => {
          setModalType(null);
          setEditEntry(null);
        }}
        title="Edit Entry"
        size="md"
      >
        {editEntry?.entry_type === "income" ? (
          <IncomeForm
            key={editEntry?.id}
            initial={editEntry}
            onSubmit={handleEditSubmit}
            loading={updateMutation.isPending}
            projects={projects}
            isLinked={!!editEntry?.project_payment_id}
          />
        ) : (
          <ExpenseForm
            key={editEntry?.id}
            initial={editEntry}
            onSubmit={handleEditSubmit}
            loading={updateMutation.isPending}
            projects={projects}
            isLinked={!!editEntry?.project_payment_id}
          />
        )}
      </Modal>
    </div>
  );
}
