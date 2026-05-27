import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/dashboard'
import { projectsApi } from '../api/projects'
import StatCard from '../components/ui/StatCard'
import Card, { CardHeader } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import {
  Briefcase, TrendingUp, TrendingDown, Wallet,
  AlertCircle
} from 'lucide-react'
import { formatRupiah, PROJECT_STATUS } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
  })

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  })

  if (loadingSummary || loadingProjects) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
      </div>
    )
  }

  const fin = summary?.financials || {}
  const cf = summary?.monthly_cashflow || {}
  const proj = summary?.projects || {}

  const statusChartData = [
    { name: 'Pending', value: proj.by_status?.pending || 0, fill: '#9ca3af' },
    { name: 'Running', value: proj.by_status?.in_progress || 0, fill: '#3b82f6' },
    { name: 'Completed', value: proj.by_status?.completed || 0, fill: '#10b981' },
    { name: 'On Hold', value: proj.by_status?.on_hold || 0, fill: '#f59e0b' },
  ]

  const activeProjects = projects.filter(p =>
    p.status === 'in_progress' || p.status === 'pending'
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Project & financial overview
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={proj.total || 0}
          sub={`${proj.by_status?.in_progress || 0} running · ${proj.by_status?.completed || 0} completed`}
          icon={Briefcase}
          color="blue"
        />
        <StatCard
          label="Total Architect Fees"
          value={formatRupiah(fin.total_architect_fee)}
          sub={`RAB: ${formatRupiah(fin.total_rab)}`}
          icon={Wallet}
          color="gray"
        />
        <StatCard
          label="Collected Payments"
          value={formatRupiah(fin.total_collected)}
          sub={`Outstanding: ${formatRupiah(fin.total_outstanding)}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Overdue Payments"
          value={summary?.overdue_payments_count || 0}
          sub="payments past due"
          icon={AlertCircle}
          color={summary?.overdue_payments_count > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Arus Kas + Chart */}
      <div className="grid grid-cols-3 gap-4">
        {/* Arus Kas Bulan Ini */}
        <Card className="col-span-1">
          <CardHeader title="Cash Flow This Month" />
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" />
                <span className="text-sm text-gray-600">Total Inflow</span>
              </div>
              <span className="text-sm font-semibold text-emerald-700">
                {formatRupiah(cf.income)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-red-500" />
                <span className="text-sm text-gray-600">Total Outflow</span>
              </div>
              <span className="text-sm font-semibold text-red-600">
                {formatRupiah(cf.expense)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Net Cash Flow</span>
              </div>
              <span className={`text-sm font-bold ${cf.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatRupiah(cf.net)}
              </span>
            </div>
          </div>
        </Card>

        {/* Chart Status Proyek */}
        <Card className="col-span-2">
          <CardHeader title="Project Status Distribution" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [v, 'Number of Projects']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {statusChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tabel Proyek Aktif */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">Active & Pending Projects</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">RAB Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Collected</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                    No projects yet. Add your first project!
                  </td>
                </tr>
              ) : (
                activeProjects.map((p) => {
                  const st = PROJECT_STATUS[p.status] || {}
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{p.project_name}</div>
                        <div className="text-xs text-gray-400">{p.location}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.client_name}</td>
                      <td className="px-4 py-3 text-gray-700">{formatRupiah(p.rab_value)}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{formatRupiah(p.total_paid)}</div>
                        <div className="text-xs text-gray-400">
                          Remaining: {formatRupiah(p.total_outstanding)}
                        </div>
                      </td>
                      <td className="px-4 py-3 w-36">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${p.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {p.progress_percent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={st.color}>{st.label}</Badge>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}