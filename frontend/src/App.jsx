import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import CustomerMenu from './pages/CustomerMenu'
import KitchenPanel from './pages/KitchenPanel'
import AdminDashboard from './pages/AdminDashboard'
import WaiterPanel from './pages/WaiterPanel'
import QRScanner from './pages/QRScanner'

function App() {
  return (
    <Router>
      {/* Routes */}
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<CustomerMenu />} />
          <Route path="/scan" element={<QRScanner />} />
          <Route path="/kitchen" element={<KitchenPanel />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/waiter" element={<WaiterPanel />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
