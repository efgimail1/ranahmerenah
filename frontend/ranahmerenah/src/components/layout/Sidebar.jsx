import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, CreditCard, HardHat,
  Package, Truck, BookOpen, Receipt, BarChart3,
  Settings, Archive, Tag
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',          label: 'Dashboard',        icon: LayoutDashboard, end: true },
  { section: 'Projects' },
  { to: '/projects',  label: 'Projects',          icon: Briefcase },
  { to: '/payments',  label: 'Payment Terms',     icon: CreditCard },
  { section: 'Field' },
  { to: '/workers',   label: 'Workers',           icon: HardHat },
  { to: '/materials', label: 'Purchase Orders',   icon: Package },
  { to: '/suppliers', label: 'Suppliers',         icon: Truck },
  { to: '/catalog',   label: 'Item Catalog',      icon: Archive },
  { to: '/prices',    label: 'Price Comparison',  icon: Tag },
  { section: 'Finance' },
  { to: '/ledger',    label: 'Ledger',            icon: BookOpen },
  { to: '/wages',     label: 'Wage Payments',     icon: Receipt },
  { section: 'Reports' },
  { to: '/reports',   label: 'Reports',           icon: BarChart3 },
  { to: '/settings',  label: 'Settings',          icon: Settings },
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
            <p className="text-xs text-gray-400">Architect Pro</p>
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
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}>
              <item.icon size={16} />
              {item.label}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  )
}