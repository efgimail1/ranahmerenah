import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, CreditCard, HardHat,
  Package, Truck, BookOpen, Receipt, BarChart3, Settings, Archive
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'Proyek' },
  { to: '/projects', label: 'Daftar Proyek', icon: Briefcase },
  { to: '/payments', label: 'Pembayaran Termin', icon: CreditCard },
  { section: 'Lapangan' },
  { to: '/workers', label: 'Data Tukang', icon: HardHat },
  { to: '/materials', label: 'Pembelian Material', icon: Package },
  { to: '/suppliers', label: 'Supplier', icon: Truck },
  { to: '/catalog', label: 'Katalog Barang', icon: Archive },
  { section: 'Keuangan' },
  { to: '/ledger', label: 'Pembukuan', icon: BookOpen },
  { to: '/wages', label: 'Upah Tukang', icon: Receipt },
  { section: 'Lainnya' },
  { to: '/reports', label: 'Laporan', icon: BarChart3 },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-52 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">RM</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">RanahMerenah</p>
            <p className="text-xs text-gray-400">Arsitek Pro</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {nav.map((item, i) =>
          item.section ? (
            <p key={i} className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              {item.section}
            </p>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  )
}