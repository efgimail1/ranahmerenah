import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Workers from './pages/Workers'
import Materials from './pages/Materials'
import PriceComparison from './pages/PriceComparison'
import Suppliers from './pages/Suppliers'
import Catalog from './pages/Catalog'
import Ledger from './pages/Ledger'
import Wages from './pages/Wages'

const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
    {title} — coming soon
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/projects"  element={<Projects />} />
        <Route path="/workers"   element={<Workers />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/catalog"   element={<Catalog />} />
        <Route path="/ledger"    element={<Ledger />} />
        <Route path="/wages"     element={<Wages />} />
        <Route path="/prices"    element={<PriceComparison />} />
        <Route path="/reports"   element={<Placeholder title="Reports" />} />
        <Route path="/settings"  element={<Placeholder title="Settings" />} />
      </Route>
    </Routes>
  )
}