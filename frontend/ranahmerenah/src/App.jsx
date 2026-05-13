import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Workers from './pages/Workers'
import Materials from './pages/Materials'
import Suppliers from './pages/Suppliers'
import Ledger from './pages/Ledger'
import Wages from './pages/Wages'
import Catalog from './pages/Catalog'

// placeholder untuk halaman belum dibuat
const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
    {title} — coming soon
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/workers" element={<Workers />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/wages" element={<Wages />} />
        <Route path="/payments" element={<Placeholder title="Pembayaran Termin" />} />
        <Route path="/reports" element={<Placeholder title="Laporan" />} />
        <Route path="/settings" element={<Placeholder title="Pengaturan" />} />
      </Route>
    </Routes>
  )
}