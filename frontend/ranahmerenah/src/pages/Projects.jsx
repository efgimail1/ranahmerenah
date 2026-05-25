import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { workersApi } from "../api/workers";
import { ledgerApi } from "../api/ledger";
import { timesheetsApi } from "../api/timesheets";
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
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Constants ──────────────────────────────────────────────
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
  { value: "daily", label: "Per Day (Harian)" },
  { value: "per_unit", label: "Per Unit" },
  { value: "fixed", label: "Fixed / Borongan" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "qris", label: "QRIS" },
  { value: "other", label: "Other" },
];

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const QRIS_FEE = 0.003;

// ─── Parse helpers ───────────────────────────────────────────
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

// ─── OvertimeEditor ─────────────────────────────────────────
function OvertimeEditor({ ts, onUpdate }) {
  const [otHours, setOtHours] = useState(
    String(parseFloat(ts.overtime_hours || 0)),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await timesheetsApi.update(ts.id, {
        overtime_hours: parseFloat(otHours) || 0,
      });
      onUpdate();
      toast.success("Lembur diupdate!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center gap-1 w-full px-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-xs text-gray-500">OT (jam):</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="8"
          step="0.5"
          value={otHours}
          onChange={(e) => setOtHours(e.target.value)}
          className="w-12 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded hover:bg-emerald-700"
        >
          {saving ? "..." : "✓"}
        </button>
      </div>
    </div>
  );
}

// ─── TimesheetModal ──────────────────────────────────────────
function TimesheetModal({ assignment, project, onClose }) {
  const qc = useQueryClient();
  const worker = assignment.worker;
  const rate = parseFloat(assignment.rate_amount) || 0;

  const [activeView, setActiveView] = useState("calendar");
  const [selectedIds, setSelectedIds] = useState([]);
  const [payDate, setPayDate] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Month navigation — start from project start month or today
  const initMonth = () => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  };
  const [currentMonth, setCurrentMonth] = useState(initMonth);

  const prevMonth = () =>
    setCurrentMonth((p) =>
      p.month === 0
        ? { year: p.year - 1, month: 11 }
        : { ...p, month: p.month - 1 },
    );
  const nextMonth = () =>
    setCurrentMonth((p) =>
      p.month === 11
        ? { year: p.year + 1, month: 0 }
        : { ...p, month: p.month + 1 },
    );

  const { data: timesheets = [], refetch } = useQuery({
    queryKey: ["timesheets", assignment.id],
    queryFn: () => timesheetsApi.getAll({ assignment_id: assignment.id }),
  });

  const calcPay = (ts) => {
    const regPay = (parseFloat(ts.regular_hours || 8) / 8) * rate;
    const otRate = (rate / 8) * parseFloat(ts.overtime_rate || 1.5);
    const otPay = parseFloat(ts.overtime_hours || 0) * otRate;
    return { regPay, otPay, total: regPay + otPay };
  };

  const unpaidTs = timesheets.filter((ts) => !ts.is_paid);
  const paidTs = timesheets.filter((ts) => ts.is_paid);
  const tsDateMap = Object.fromEntries(
    timesheets.map((ts) => [ts.work_date, ts]),
  );

  // BARU — awal minggu = Minggu (Sun–Sat)
  const groupByWeek = (list) => {
    const weeks = {};
    list.forEach((ts) => {
      // Parse tanggal dengan benar (hindari timezone offset)
      const [y, m, d_] = ts.work_date.split("-").map(Number);
      const d = new Date(y, m - 1, d_); // local time, bukan UTC
      const sun = new Date(d);
      sun.setDate(d.getDate() - d.getDay()); // mundur ke Minggu (day=0)
      // Format manual supaya tidak kena timezone
      const yy = sun.getFullYear();
      const mm = String(sun.getMonth() + 1).padStart(2, "0");
      const dd = String(sun.getDate()).padStart(2, "0");
      const key = `${yy}-${mm}-${dd}`;
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(ts);
    });
    Object.values(weeks).forEach((arr) =>
      arr.sort((a, b) => a.work_date.localeCompare(b.work_date)),
    );
    return weeks;
  };

  const unpaidWeeks = groupByWeek(unpaidTs);
  const paidWeeks = groupByWeek(paidTs);

  const selectedTs = timesheets.filter((ts) => selectedIds.includes(ts.id));
  const selectedTotal = selectedTs.reduce((s, ts) => s + calcPay(ts).total, 0);
  const selectedDays = selectedTs.length;
  const selectedOT = selectedTs.reduce(
    (s, ts) => s + parseFloat(ts.overtime_hours || 0),
    0,
  );

  // Build calendar for current month
  const buildMonthCalendar = () => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++)
      cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const addMutation = useMutation({
    mutationFn: (data) => timesheetsApi.create(data),
    onSuccess: () => {
      refetch();
      toast.success("Hari kerja ditambahkan!");
    },
    onError: (e) => toast.error(e.message || "Tanggal sudah ada"),
  });

  const delMutation = useMutation({
    mutationFn: (id) => timesheetsApi.delete(id),
    onSuccess: () => {
      refetch();
      toast.success("Dihapus.");
    },
    onError: (e) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payDate) throw new Error("Tanggal bayar required");
      if (!selectedIds.length)
        throw new Error("Pilih timesheet yang mau dibayar");

      const wage = await workersApi.createWage({
        assignment_id: assignment.id,
        worker_id: assignment.worker_id,
        project_id: project?.id,
        payment_date: payDate,
        period_start: selectedTs[0]?.work_date,
        period_end: selectedTs[selectedTs.length - 1]?.work_date,
        days_worked: selectedDays,
        rate_snapshot: rate,
        gross_amount: selectedTotal,
        deduction: 0,
        net_amount: selectedTotal,
        notes: payNotes || `${selectedDays} hari kerja`,
      });

      await timesheetsApi.markPaid(selectedIds, Number(wage.id));

      await ledgerApi.createExpense({
        entry_date: payDate,
        entry_type: "expense",
        description: `Upah ${worker?.full_name} — ${selectedDays} hari`,
        paid_to: worker?.full_name || "",
        gross_expense: selectedTotal,
        discount_received: 0,
        payment_method: "cash",
        project_id: project?.id || null,
        notes: payNotes || null,
      });
      return wage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheets", assignment.id] });
      qc.invalidateQueries({ queryKey: ["wages"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setSelectedIds([]);
      setPayDate("");
      setPayNotes("");
      setActiveView("calendar");
      toast.success("Pembayaran berhasil dicatat!");
    },
    onError: (e) => toast.error(e.message),
  });

  const weeks = buildMonthCalendar();

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Timesheet — {worker?.full_name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {ROLE_OPTIONS.find((r) => r.value === worker?.role)?.label} ·
              Rate: {formatRupiah(rate)}/hari · Project: {project?.project_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveView("calendar")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeView === "calendar"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                📅 Timesheet
              </button>
              <button
                type="button"
                onClick={() => setActiveView("payment")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeView === "payment"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                💰 Pembayaran
                {unpaidTs.length > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                    {unpaidTs.length}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── TIMESHEET CALENDAR ── */}
          {activeView === "calendar" && (
            <div className="p-5 space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-700">
                    {timesheets.length}
                  </div>
                  <div className="text-xs text-blue-600">Total Hari Kerja</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {unpaidTs.length}
                  </div>
                  <div className="text-xs text-amber-600">Belum Dibayar</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-700">
                    {paidTs.length}
                  </div>
                  <div className="text-xs text-emerald-600">Sudah Dibayar</div>
                </div>
              </div>

              {/* Month navigator */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-gray-600 hover:text-gray-900 text-lg font-bold"
                >
                  ‹
                </button>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-900">
                    {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                  </div>
                  <div className="text-xs text-gray-400">
                    Klik tanggal untuk tambah · Hover untuk edit lembur / hapus
                  </div>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-gray-600 hover:text-gray-900 text-lg font-bold"
                >
                  ›
                </button>
              </div>

              {/* Calendar grid */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {DAY_LABELS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs font-medium text-gray-500 py-2"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="p-2 space-y-1">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((d, di) => {
                        if (!d) return <div key={di} className="min-h-14" />;

                        // ── Hitung dateStr tanpa timezone ──────────────
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

                        // ── Hitung today tanpa timezone ────────────────
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                        const isToday = dateStr === todayStr;

                        const ts = tsDateMap[dateStr];
                        const hasOT =
                          ts && parseFloat(ts.overtime_hours || 0) > 0;
                        const pay = ts ? calcPay(ts) : null;

                        return (
                          <div
                            key={dateStr}
                            onClick={() => {
                              if (!ts) {
                                addMutation.mutate({
                                  assignment_id: assignment.id,
                                  worker_id: assignment.worker_id,
                                  project_id: project?.id,
                                  work_date: dateStr,
                                  regular_hours: 8,
                                  overtime_hours: 0,
                                  overtime_rate: 1.5,
                                });
                              }
                            }}
                            className={`relative group/cell rounded-lg text-xs flex flex-col items-center justify-center transition-all cursor-pointer min-h-14 ${
                              ts
                                ? ts.is_paid
                                  ? "bg-emerald-100 border-2 border-emerald-300"
                                  : "bg-blue-100 border-2 border-blue-300"
                                : "hover:bg-gray-100 border border-transparent hover:border-gray-200"
                            }`}
                          >
                            {/* Angka tanggal */}
                            <span
                              className={`font-semibold text-sm leading-none ${
                                ts
                                  ? ts.is_paid
                                    ? "text-emerald-700"
                                    : "text-blue-700"
                                  : isToday
                                    ? "text-emerald-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {d.getDate()}
                            </span>

                            {/* Dot kecil hanya untuk sysdate yang kosong */}
                            {isToday && !ts && (
                              <span className="block w-1.5 h-1.5 bg-emerald-500 rounded-full mt-0.5" />
                            )}

                            {/* Info jam & upah untuk hari kerja */}
                            {ts && (
                              <>
                                <span className="text-xs text-gray-500 leading-none mt-0.5">
                                  {parseFloat(ts.regular_hours || 8)}j
                                </span>
                                {hasOT && (
                                  <span className="text-xs text-orange-500 font-medium leading-none">
                                    +{parseFloat(ts.overtime_hours)}OT
                                  </span>
                                )}
                                {!ts.is_paid && pay && (
                                  <span className="text-xs font-medium text-blue-600 leading-none">
                                    {formatRupiah(pay.total).replace(
                                      "Rp\u00a0",
                                      "",
                                    )}
                                  </span>
                                )}
                              </>
                            )}

                            {/* Hover: edit OT or delete */}
                            {ts && !ts.is_paid && (
                              <div className="absolute inset-0 bg-white/95 rounded-lg opacity-0 group-hover/cell:opacity-100 flex flex-col items-center justify-center gap-1 transition-all p-1">
                                <OvertimeEditor ts={ts} onUpdate={refetch} />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    delMutation.mutate(ts.id);
                                  }}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                  Hapus
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-blue-100 border-2 border-blue-300 rounded inline-block" />
                  Belum dibayar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-100 border-2 border-emerald-300 rounded inline-block" />
                  Sudah dibayar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-orange-500 font-bold">OT</span>
                  Ada lembur
                </span>
              </div>

              {/* Unpaid weekly table */}
              {Object.keys(unpaidWeeks).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Belum Dibayar — per Minggu
                  </h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">
                            Minggu
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-500">
                            Hari
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-500">
                            Lembur
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">
                            Total
                          </th>
                          <th className="px-3 py-2 text-center w-24 font-medium text-gray-500">
                            Pilih
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(unpaidWeeks)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([weekStart, wTs]) => {
                            const weekTotal = wTs.reduce(
                              (s, ts) => s + calcPay(ts).total,
                              0,
                            );
                            const weekOT = wTs.reduce(
                              (s, ts) => s + parseFloat(ts.overtime_hours || 0),
                              0,
                            );
                            // Parse weekStart string manual
                            const [wy, wm, wd] = weekStart
                              .split("-")
                              .map(Number);
                            const weekEndDate = new Date(wy, wm - 1, wd + 6);
                            const weekEndStr = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
                            const allSelected = wTs.every((ts) =>
                              selectedIds.includes(ts.id),
                            );
                            const anySelected = wTs.some((ts) =>
                              selectedIds.includes(ts.id),
                            );

                            return (
                              <tr
                                key={weekStart}
                                className={`hover:bg-gray-50 ${anySelected ? "bg-blue-50/50" : ""}`}
                              >
                                <td className="px-3 py-2 text-gray-700 font-medium">
                                  {formatDate(weekStart)} –{" "}
                                  {formatDate(formatDate(weekEndStr))}
                                  <div className="text-gray-400 font-normal mt-0.5">
                                    {wTs
                                      .map(
                                        (ts) =>
                                          DAY_LABELS[
                                            new Date(ts.work_date).getDay()
                                          ],
                                      )
                                      .join(", ")}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center font-medium">
                                  {wTs.length} hari
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {weekOT > 0 ? (
                                    <span className="text-orange-500 font-medium">
                                      {weekOT}j OT
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {formatRupiah(weekTotal)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ids = wTs.map((ts) => ts.id);
                                      if (allSelected) {
                                        setSelectedIds((prev) =>
                                          prev.filter(
                                            (id) => !ids.includes(id),
                                          ),
                                        );
                                      } else {
                                        setSelectedIds((prev) => [
                                          ...new Set([...prev, ...ids]),
                                        ]);
                                      }
                                    }}
                                    className={`text-xs px-2 py-1 rounded-lg transition-all font-medium ${
                                      allSelected
                                        ? "bg-blue-600 text-white"
                                        : anySelected
                                          ? "bg-blue-200 text-blue-800"
                                          : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                                    }`}
                                  >
                                    {allSelected ? "✓ Dipilih" : "Pilih"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      {selectedIds.length > 0 && (
                        <tfoot>
                          <tr className="bg-blue-50 border-t-2 border-blue-200">
                            <td
                              colSpan={3}
                              className="px-3 py-2 text-xs font-semibold text-blue-700"
                            >
                              Dipilih: {selectedDays} hari
                              {selectedOT > 0 && ` + ${selectedOT}j OT`}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-700">
                              {formatRupiah(selectedTotal)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveView("payment")}
                                className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                              >
                                Bayar →
                              </button>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* Paid history */}
              {Object.keys(paidWeeks).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Riwayat Pembayaran
                  </h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">
                            Minggu
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-500">
                            Hari
                          </th>
                          <th className="text-center px-3 py-2 font-medium text-gray-500">
                            Lembur
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.entries(paidWeeks)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([weekStart, wTs]) => {
                            const weekTotal = wTs.reduce(
                              (s, ts) => s + calcPay(ts).total,
                              0,
                            );
                            const weekOT = wTs.reduce(
                              (s, ts) => s + parseFloat(ts.overtime_hours || 0),
                              0,
                            );
                            // Parse weekStart string manual
                            const [wy, wm, wd] = weekStart
                              .split("-")
                              .map(Number);
                            const weekEndDate = new Date(wy, wm - 1, wd + 6);
                            const weekEndStr = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
                            return (
                              <tr key={weekStart} className="opacity-60">
                                <td className="px-3 py-2 text-gray-700">
                                  {formatDate(weekStart)} –{" "}
                                  {formatDate(weekEndStr)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {wTs.length} hari
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {weekOT > 0 ? (
                                    <span className="text-orange-500">
                                      {weekOT}j OT
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                  {formatRupiah(weekTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                          <td
                            colSpan={3}
                            className="px-3 py-2 font-semibold text-emerald-700"
                          >
                            Total Dibayar ({paidTs.length} hari)
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">
                            {formatRupiah(
                              paidTs.reduce(
                                (s, ts) => s + calcPay(ts).total,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PEMBAYARAN ── */}
          {activeView === "payment" && (
            <div className="p-5 space-y-4">
              {selectedIds.length > 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-700 uppercase">
                    Ringkasan Pembayaran
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        Hari Kerja
                      </div>
                      <div className="font-bold text-gray-900 text-lg">
                        {selectedDays}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        Total Lembur
                      </div>
                      <div className="font-bold text-orange-600 text-lg">
                        {selectedOT}j
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        Total Upah
                      </div>
                      <div className="font-bold text-emerald-700 text-lg">
                        {formatRupiah(selectedTotal)}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 border-t border-emerald-200 pt-2">
                    {selectedTs
                      .sort((a, b) => a.work_date.localeCompare(b.work_date))
                      .map((ts) => {
                        const p = calcPay(ts);
                        return (
                          <div
                            key={ts.id}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-gray-600">
                              {formatDate(ts.work_date)}
                              {parseFloat(ts.overtime_hours || 0) > 0 && (
                                <span className="text-orange-500 ml-1">
                                  +{ts.overtime_hours}j OT
                                </span>
                              )}
                            </span>
                            <span className="font-medium">
                              {formatRupiah(p.total)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-400">
                    Belum ada hari dipilih.
                    <br />
                    Pilih dari tab Timesheet → klik "Pilih" di baris minggu.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView("calendar")}
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium underline"
                  >
                    → Ke Timesheet
                  </button>
                </div>
              )}

              {selectedIds.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Tanggal Bayar *"
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                    <Input
                      label="Catatan"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full"
                    loading={payMutation.isPending}
                    disabled={!payDate}
                    onClick={() => payMutation.mutate()}
                  >
                    Proses Pembayaran — {selectedDays} Hari ={" "}
                    {formatRupiah(selectedTotal)}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
                  >
                    Batal pilihan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PayrollRunModal — Bayar semua tukang per minggu ────────
function PayrollRunModal({ project, assignments, onClose }) {
  const qc = useQueryClient();

  // Select week
  const [selectedWeek, setSelectedWeek] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  // Load ALL timesheets for this project (unpaid only)
  const { data: allTimesheets = [], isLoading } = useQuery({
    queryKey: ["timesheets-project", project?.id, "unpaid"],
    queryFn: () =>
      timesheetsApi.getAll({ project_id: project?.id, is_paid: false }),
    enabled: !!project?.id,
  });

  const weekOptions = (() => {
    const weeks = {};
    allTimesheets.forEach((ts) => {
      const [y, m, d_] = ts.work_date.split("-").map(Number);
      const d = new Date(y, m - 1, d_);
      const sun = new Date(d);
      sun.setDate(d.getDate() - d.getDay());
      const yy = sun.getFullYear();
      const mm = String(sun.getMonth() + 1).padStart(2, "0");
      const dd = String(sun.getDate()).padStart(2, "0");
      const key = `${yy}-${mm}-${dd}`;
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(ts);
    });
    return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b));
  })();

  // Timesheets for selected week
  const weekTs = selectedWeek
    ? allTimesheets.filter((ts) => {
        const [y, m, d_] = ts.work_date.split("-").map(Number);
        const d = new Date(y, m - 1, d_);
        const sun = new Date(d);
        sun.setDate(d.getDate() - d.getDay());
        const key = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
        return key === selectedWeek;
      })
    : [];

  // Group by worker
  const byWorker = (() => {
    const map = {};
    weekTs.forEach((ts) => {
      if (!map[ts.worker_id]) map[ts.worker_id] = [];
      map[ts.worker_id].push(ts);
    });
    return map;
  })();

  // Worker attendance state: { workerId: { selected: bool, days: [...], adjustedDays: n } }
  const [workerSel, setWorkerSel] = useState({});

  // Initialize workerSel when week changes
  const initWorkerSel = (wk) => {
    if (!wk) return {};
    const map = {};
    const byW = {};

    allTimesheets
      .filter((ts) => {
        const [y, m, d_] = ts.work_date.split("-").map(Number);
        const d = new Date(y, m - 1, d_);
        const sun = new Date(d);
        sun.setDate(d.getDate() - d.getDay());
        const key = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`;
        return key === wk;
      })
      .forEach((ts) => {
        if (!byW[ts.worker_id]) byW[ts.worker_id] = [];
        byW[ts.worker_id].push(ts);
      });

    Object.keys(byW).forEach((wid) => {
      map[String(wid)] = {
        selected: false, // ← selalu false saat init
        tsIds: byW[wid].map((t) => t.id),
      };
    });
    return map;
  };

  const handleWeekChange = (wk) => {
    setSelectedWeek(wk);
    setWorkerSel(initWorkerSel(wk)); // ← reset penuh setiap ganti minggu
  };

  const toggleWorker = (wid) => {
  setWorkerSel(prev => ({
    ...prev,
    [String(wid)]: { ...prev[String(wid)], selected: !prev[String(wid)]?.selected },
  }));
};

  // Calc pay per worker
  const calcWorkerPay = (wid) => {
    const wTs = byWorker[wid] || [];
    const assignment = assignments.find((a) => a.worker_id === parseInt(wid));
    const rate = parseFloat(assignment?.rate_amount || 0);
    return wTs.reduce((s, ts) => {
      const regPay = (parseFloat(ts.regular_hours || 8) / 8) * rate;
      const otRate = (rate / 8) * parseFloat(ts.overtime_rate || 1.5);
      const otPay = parseFloat(ts.overtime_hours || 0) * otRate;
      return s + regPay + otPay;
    }, 0);
  };

  const selectedWorkers = Object.entries(workerSel).filter(([, v]) => v.selected);
  
  const grandTotal = selectedWorkers.reduce(
    (s, [wid]) => s + calcWorkerPay(wid),
    0,
  );

  const weekEnd = selectedWeek
    ? (() => {
        const [y, m, d_] = selectedWeek.split("-").map(Number);
        const end = new Date(y, m - 1, d_ + 6);
        return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      })()
    : "";

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!payDate) throw new Error("Tanggal bayar required");
      if (!selectedWeek) throw new Error("Pilih minggu dulu");
      if (!selectedWorkers.length) throw new Error("Pilih minimal 1 tukang");

      // Process each selected worker
      for (const [wid, sel] of selectedWorkers) {
        const assignment = assignments.find(
          (a) => a.worker_id === parseInt(wid),
        );
        if (!assignment) continue;

        const workerPay = calcWorkerPay(wid);
        const wTs = byWorker[wid] || [];
        const worker = assignment.worker;

        const wage = await workersApi.createWage({
          assignment_id: assignment.id,
          worker_id: parseInt(wid),
          project_id: project?.id,
          payment_date: payDate,
          period_start: wTs[0]?.work_date,
          period_end: wTs[wTs.length - 1]?.work_date,
          days_worked: wTs.length,
          rate_snapshot: parseFloat(assignment.rate_amount || 0),
          gross_amount: workerPay,
          deduction: 0,
          net_amount: workerPay,
          notes: notes || `Payroll minggu ${selectedWeek}`,
        });

        await timesheetsApi.markPaid(sel.tsIds, Number(wage.id));

        await ledgerApi.createExpense({
          entry_date: payDate,
          entry_type: "expense",
          description: `Upah ${worker?.full_name} — ${wTs.length} hari (${selectedWeek})`,
          paid_to: worker?.full_name || "",
          gross_expense: workerPay,
          discount_received: 0,
          payment_method: payMethod,
          project_id: project?.id || null,
          notes: notes || null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["timesheets-project", project?.id, "unpaid"],
      });
      qc.invalidateQueries({ queryKey: ["timesheets"] });
      qc.invalidateQueries({ queryKey: ["wages"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      toast.success(
        `Payroll ${selectedWorkers.length} tukang berhasil diproses!`,
      );
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users size={16} className="text-emerald-600" />
              Payroll Run — {project?.project_name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Proses pembayaran semua tukang sekaligus dalam satu minggu
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Step 1: Pilih Minggu */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              1. Pilih Minggu
            </label>
            {isLoading ? (
              <div className="text-xs text-gray-400 text-center py-4">
                Loading timesheets...
              </div>
            ) : weekOptions.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                Tidak ada timesheet yang belum dibayar. Input hari kerja di
                Timesheet masing-masing tukang dulu.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {weekOptions.map(([wk, wTs]) => {
                  // Parse weekStart string manual
                  const [wy, wm, wd] = wk.split("-").map(Number);
                  const weekEndDate = new Date(wy, wm - 1, wd + 6);
                  const weekEndStr = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
                  const total = wTs.length;
                  const workers = [...new Set(wTs.map((ts) => ts.worker_id))]
                    .length;
                  return (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => handleWeekChange(wk)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedWeek === wk
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-800">
                        {formatDate(wk)} – {formatDate(weekEndStr)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {workers} tukang · {total} hari kerja
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Detail tukang minggu ini */}
          {selectedWeek && Object.keys(byWorker).length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                2. Verifikasi Hari Kerja Tukang
              </label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500 w-8">
                        <input
                          type="checkbox"
                          checked={
                            Object.keys(byWorker).length > 0 &&
                            Object.keys(byWorker).every(
                              (wid) => workerSel[String(wid)]?.selected,
                            )
                          }
                          onChange={(e) => {
                            const upd = {};
                            Object.keys(byWorker).forEach((wid) => {
                              upd[String(wid)] = {
                                ...workerSel[String(wid)],
                                selected: e.target.checked,
                              };
                            });
                            setWorkerSel((prev) => ({ ...prev, ...upd }));
                          }}
                          className="rounded border-gray-300 text-emerald-600"
                        />
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">
                        Tukang
                      </th>
                      <th className="text-center px-3 py-2 font-medium text-gray-500">
                        Hari
                      </th>
                      <th className="text-center px-3 py-2 font-medium text-gray-500">
                        Lembur
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">
                        Upah
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(byWorker).map(([wid, wTs]) => {
                      const assignment = assignments.find(
                        (a) => a.worker_id === parseInt(wid),
                      );
                      const worker = assignment?.worker;
                      const pay = calcWorkerPay(wid);
                      const ot = wTs.reduce(
                        (s, ts) => s + parseFloat(ts.overtime_hours || 0),
                        0,
                      );
                      const sel = workerSel[wid]?.selected ?? true;
                      const days = wTs.map(
                        (ts) => DAY_LABELS[new Date(ts.work_date).getDay()],
                      );

                      return (
                        <tr
                          key={wid}
                          className={`${!sel ? "opacity-40" : ""} hover:bg-gray-50`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => toggleWorker(wid)}
                              className="rounded border-gray-300 text-emerald-600"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
                                {worker?.full_name
                                  ?.split(" ")
                                  .slice(0, 2)
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {worker?.full_name}
                                </div>
                                <div className="text-gray-400">
                                  {
                                    ROLE_OPTIONS.find(
                                      (r) => r.value === worker?.role,
                                    )?.label
                                  }
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="font-medium">{wTs.length} hari</div>
                            <div className="text-gray-400">
                              {days.join(", ")}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {ot > 0 ? (
                              <span className="text-orange-500 font-medium">
                                {ot}j
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {formatRupiah(pay)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                      <td
                        colSpan={4}
                        className="px-3 py-2.5 text-xs font-semibold text-emerald-700"
                      >
                        Total ({selectedWorkers.length} tukang dipilih)
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 text-sm">
                        {formatRupiah(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Info pembayaran */}
          {selectedWeek && selectedWorkers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                3. Info Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Tanggal Bayar *"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
                <Select
                  label="Metode Bayar"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Catatan"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="optional"
                  className="col-span-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedWeek && selectedWorkers.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500">
                Minggu {formatDate(selectedWeek)} – {formatDate(weekEnd)} ·
                {selectedWorkers.length} tukang · Total{" "}
                {formatRupiah(grandTotal)}
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              loading={runMutation.isPending}
              disabled={!payDate}
              onClick={() => runMutation.mutate()}
            >
              🚀 Proses Payroll {selectedWorkers.length} Tukang ={" "}
              {formatRupiah(grandTotal)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Payment Terms ──────────────────────────────────────
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
  const [savingTermIdx, setSavingTermIdx] = useState(null);
  const [payForm, setPayForm] = useState({
    entry_date: "",
    gross_amount: "",
    payment_method: "transfer",
    bank_account: "",
    description: "",
    notes: "",
  });

  const saveSingleTerm = async (i, pay) => {
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

  const remove = (i) => {
    const pay = payments[i];
    if (!pay.id) {
      setPayments((p) => p.filter((_, idx) => idx !== i));
      return;
    }
    const amtPaid = parseFloat(pay.amount_paid || 0);
    if (amtPaid > 0) {
      toast.error(
        `Cannot delete "${pay.term_label || "this term"}" — paid ${formatRupiah(amtPaid)}. Void in Ledger first.`,
        { duration: 5000 },
      );
      return;
    }
    if (confirm(`Delete payment term "${pay.term_label || "this term"}"?`)) {
      setDeletedPaymentIds((prev) => [...prev, pay.id]);
      setPayments((p) => p.filter((_, idx) => idx !== i));
    }
  };

  const handlePct = (i, pct) => {
    set(i, "percentage", pct);
    const fee = parseFloat(parseCurrency(architectFee)) || 0;
    if (fee > 0 && pct)
      set(
        i,
        "amount",
        String(Math.round(((parseFloat(pct) || 0) / 100) * fee)),
      );
  };

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
      if (onDataRefresh) {
        const fresh = await onDataRefresh();
        if (fresh?.payments) setPayments(parsePayments(fresh));
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
                        <span
                          className={`text-xs font-semibold ${amtPaid > 0 ? "text-emerald-700" : "text-gray-300"}`}
                        >
                          {amtPaid > 0 ? formatRupiah(amtPaid) : "-"}
                        </span>
                        {pay.status === "partial" && (
                          <div className="mt-1">
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
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
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1 justify-end">
                          {!pay.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveSingleTerm(i, pay)}
                                disabled={savingTermIdx === i}
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
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
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
            <div className="p-5 space-y-4">
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

// ─── Tab: Workers ────────────────────────────────────────────
function TabWorkers({ project }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [timesheetModal, setTimesheetModal] = useState(null);
  const [payrollOpen, setPayrollOpen] = useState(false);
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
          /* ignore */
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

  const dailyWorkers = assignments.filter((a) => a.rate_type === "daily");

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Workers ({assignments.length})
        </h4>
        <div className="flex items-center gap-2">
          {dailyWorkers.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPayrollOpen(true)}
            >
              <Users size={14} /> Payroll Run
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowForm((s) => !s)}
          >
            <Plus size={14} /> Assign Worker
          </Button>
        </div>
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
                  Tipe Upah
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
                <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-28">
                  Payment
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
                  <td className="px-2 py-1.5"></td>
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

              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent mx-auto" />
                  </td>
                </tr>
              ) : assignments.length === 0 && !showForm ? (
                <tr>
                  <td
                    colSpan={11}
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
                    <td className="px-2 py-2.5">
                      {/* Single payment button per rate type */}
                      {a.rate_type === "daily" && (
                        <button
                          type="button"
                          onClick={() => setTimesheetModal(a)}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-all whitespace-nowrap"
                        >
                          📅 Timesheet
                        </button>
                      )}
                      {a.rate_type === "fixed" && (
                        <button
                          type="button"
                          onClick={() => setTimesheetModal(a)}
                          className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-all whitespace-nowrap"
                        >
                          💰 Pay
                        </button>
                      )}
                      {a.rate_type === "per_unit" && (
                        <button
                          type="button"
                          onClick={() => setTimesheetModal(a)}
                          className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition-all whitespace-nowrap"
                        >
                          📦 Units
                        </button>
                      )}
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

      {/* Modals */}
      {timesheetModal && (
        <TimesheetModal
          assignment={timesheetModal}
          project={project}
          onClose={() => setTimesheetModal(null)}
        />
      )}
      {payrollOpen && (
        <PayrollRunModal
          project={project}
          assignments={assignments}
          onClose={() => setPayrollOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Project Detail ──────────────────────────────────────────
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
    "text-xs font-medium text-gray-500 uppercase tracking-wide mb-1";
  const hInput =
    "w-full text-sm text-gray-900 bg-transparent border-0 border-b border-gray-300 focus:outline-none focus:border-emerald-500 pb-0.5 transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#f9fafb" }}
    >
      {/* Nav bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-emerald-600 text-xs font-medium transition-colors"
          >
            Projects
          </button>
          <span className="text-gray-300">›</span>
          <span className="text-gray-700 font-medium">
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
          {/* Row 1 */}
          <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-200">
            {project && (
              <span className="font-mono text-xs bg-white border border-gray-200 rounded-md px-2 py-1 text-emerald-700 font-semibold">
                PRJ-{String(project.id).padStart(5, "0")}
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Status:</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex-1" />
            {project && (
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Collected
                  </div>
                  <div className="text-sm font-bold text-emerald-700">
                    {project.total_paid != null
                      ? formatRupiah(project.total_paid)
                      : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Outstanding
                  </div>
                  <div className="text-sm font-bold text-red-500">
                    {project.total_outstanding != null
                      ? formatRupiah(project.total_outstanding)
                      : "—"}
                  </div>
                </div>
                <div className="text-right min-w-20">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    Progress
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${project.progress_percent || 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      {project.progress_percent != null
                        ? `${project.progress_percent}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Client */}
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
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-medium">
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

// ─── Main Page ───────────────────────────────────────────────
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
      // eslint-disable-next-line no-unused-vars
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

  const handleRefreshProject = async () => {
    if (!editData?.id) return;
    try {
      const fresh = await projectsApi.getById(editData.id);
      setEditData(fresh);
      return fresh;
    } catch {
      /* ignore */
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

                {/* Expanded payment terms */}
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
