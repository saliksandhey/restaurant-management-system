import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Sub-components
import DashboardView from '../components/admin/DashboardView'
import OrderManager from '../components/admin/OrderManager'
import MenuManager from '../components/admin/MenuManager'
import TableManager from '../components/admin/TableManager'
import PaymentsHistory from '../components/admin/PaymentsHistory'
import WaitersManager from '../components/admin/WaitersManager'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const fetchCoreData = async () => {
    setLoading(true)
    try {
      const { data: oData, error: oError } = await supabase
        .from('orders')
        .select(`
          *,
          tables(table_number),
          order_items(
            id, quantity, price, kitchen_status,
            menu_items(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500)
        
      if (oError) throw oError

      const { data: pData, error: pError } = await supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .limit(500)
        
      if (pError) throw pError

      setOrders(oData || [])
      setPayments(pData || [])
    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoreData()

    // Realtime for new ready orders & payments
    const ordersSubscription = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // Notify when a new order comes in
          if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
            setUnreadNotifications(prev => prev + 1)
          }
          fetchCoreData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        () => fetchCoreData()
      )
      .subscribe()

    const paymentsSubscription = supabase
      .channel('admin-payments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        (payload) => {
          fetchCoreData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ordersSubscription)
      supabase.removeChannel(paymentsSubscription)
    }
  }, [])

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: <i className="fa-solid fa-chart-pie"></i> },
    { id: 'orders', label: 'Active Orders', icon: <i className="fa-solid fa-bell-concierge"></i> },
    { id: 'payments', label: 'Financials', icon: <i className="fa-solid fa-wallet"></i> },
    { id: 'menu', label: 'Menu Catalog', icon: <i className="fa-solid fa-layer-group"></i> },
    { id: 'waiters', label: 'Staff Hub', icon: <i className="fa-solid fa-user-shield"></i> },
    { id: 'tables', label: 'Table Maps', icon: <i className="fa-solid fa-compass"></i> },
  ]

  // Orders awaiting payment = everything not paid or cancelled
  const activeOrders = orders.filter(o => o.status !== 'paid' && o.status !== 'cancelled')
  const readyOrders = activeOrders // alias for OrderManager prop

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-900 border-t-transparent shadow-xl"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex pb-[env(safe-area-inset-bottom)] md:pb-0 bg-slate-50 font-sans selection:bg-black selection:text-white relative overflow-hidden">
      
      {/* Decorative blurred background gradients for premium aesthetic */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-200/30 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Sidebar - desktop (Glassmorphism) */}
      <aside className="w-[300px] bg-white/70 backdrop-blur-2xl border-r border-white/60 min-h-screen hidden md:flex flex-col fixed z-20 shadow-[10px_0_40px_-20px_rgba(0,0,0,0.08)]">
        <div className="p-8">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 mb-6">
            <i className="fa-solid fa-bolt text-2xl text-white"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Admin<br/><span className="text-slate-400 font-bold">Workspace</span></h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-4">Menu</div>
          {navItems.map((item) => {
            const isReady = item.id === 'orders'
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  if (isReady) setUnreadNotifications(0)
                }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-300 relative group overflow-hidden ${
                  isActive ? 'bg-black text-white shadow-lg shadow-black/10 scale-[1.02]' : 'text-slate-500 hover:bg-slate-900/5 hover:text-slate-900'
                }`}
              >
                <div className={`text-xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</div>
                <span className={`font-bold tracking-wide ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                
                {isReady && readyOrders.length > 0 && (
                  <span className={`absolute right-4 px-2 py-1 rounded-full text-[10px] font-black tracking-widest ${isActive ? 'bg-white text-black' : 'bg-rose-500 text-white shadow-md shadow-rose-500/30'}`}>
                    {readyOrders.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-8 mt-auto">
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 border border-white/60 p-5 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">System Live</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 leading-tight">Secure sync active across all services.</p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar + bottom nav */}
      <div className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-2xl text-slate-900 z-30 px-5 py-4 pb-[env(safe-area-inset-top)] flex justify-between items-center shadow-[0_4px_30px_rgba(0,0,0,0.05)] border-b border-white/50">
        <h2 className="text-xl font-black flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-lg shadow-black/20"><i className="fa-solid fa-bolt text-white text-sm"></i></div>
          Admin
        </h2>
        <div className="relative">
          <span className="text-2xl text-slate-400"><i className="fa-solid fa-bell"></i></span>
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-rose-500/40 border-2 border-white">
              {unreadNotifications}
            </span>
          )}
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-2xl text-slate-400 flex py-2 px-2 z-30 pb-[env(safe-area-inset-bottom)] border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] justify-around">
        {navItems.map(item => {
           const isActive = activeTab === item.id
           return (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center p-2 pt-3 rounded-2xl relative transition-all w-[4.5rem] ${isActive ? 'text-black bg-slate-100/80 shadow-inner' : 'hover:bg-slate-50'}`}
            >
              <span className={`text-xl mb-1.5 transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{item.label.split(' ')[0]}</span>
              {item.id === 'orders' && readyOrders.length > 0 && (
                <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
              )}
            </button>
           )
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-[300px] pt-24 md:pt-8 p-4 md:p-10 w-full max-w-[100vw] md:max-w-[none] min-h-screen mb-20 md:mb-0 relative z-10">
        <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
          {/* Section Header */}
          <header className="mb-8 md:mb-12 flex justify-between items-end">
            <div>
               <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
                 {navItems.find(n => n.id === activeTab)?.label}
               </h1>
               <p className="font-semibold text-slate-500 text-sm md:text-base">Real-time overview of your restaurant's operations.</p>
            </div>
            {/* Dynamic context actions could go here */}
          </header>

          <div className="animate-in fade-in zoom-in-95 duration-500 delay-150 fill-mode-both">
            {activeTab === 'dashboard' && <DashboardView orders={orders} payments={payments} />}
            {activeTab === 'orders' && <OrderManager readyOrders={readyOrders} fetchOrders={fetchCoreData} />}
            {activeTab === 'payments' && <PaymentsHistory payments={payments} orders={orders} />}
            {activeTab === 'menu' && <MenuManager />}
            {activeTab === 'waiters' && <WaitersManager />}
            {activeTab === 'tables' && <TableManager />}
          </div>
        </div>
      </main>
      
    </div>
  )
}
