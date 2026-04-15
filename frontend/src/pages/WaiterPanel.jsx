import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function WaiterPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [waiter, setWaiter] = useState(null)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-200">
        <div className="glass p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-sm border-2 border-white animate-pop-in text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-400 rounded-full blur-[80px] opacity-40"></div>
          
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/30 rotate-3">
            <i className="fa-solid fa-user-tie text-4xl text-white -rotate-3"></i>
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-3 tracking-tighter">Staff Portal</h1>
          <p className="text-slate-500 mb-10 font-bold uppercase tracking-widest text-xs">Secure Access</p>

          <form onSubmit={async (e) => {
            e.preventDefault()
            setLoginError('')
            setLoginLoading(true)
            try {
              const { data, error } = await supabase
                .from('waiters')
                .select('*')
                .eq('pass_code', pin)
                .eq('is_active', true)
                .maybeSingle()
              if (error) throw error
              if (!data) setLoginError('Invalid PIN or inactive profile.')
              else { setWaiter(data); setIsAuthenticated(true) }
            } catch {
              setLoginError('Authentication failed.')
            } finally {
              setLoginLoading(false)
            }
          }} className="space-y-6 relative z-10">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-100 border-2 border-white focus:bg-white rounded-2xl p-5 text-center text-4xl font-mono text-slate-800 tracking-[0.5em] focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none shadow-inner"
              autoFocus
            />
            {loginError && <p className="text-red-500 bg-red-50/80 backdrop-blur-sm py-2 rounded-xl text-sm font-bold border border-red-100">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:active:scale-100"
            >
              {loginLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <WaiterDashboard waiter={waiter} onLogout={() => { setIsAuthenticated(false); setPin('') }} />
}

function WaiterDashboard({ waiter, onLogout }) {
  const [activeTab, setActiveTab] = useState('tables')

  const [tables, setTables] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [waiterCalls, setWaiterCalls] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedTableId, setSelectedTableId] = useState(null)

  const fetchData = useCallback(async () => {
    const [tblRes, ordRes, callsRes, menuRes] = await Promise.all([
      supabase.from('tables').select('*').order('table_number'),
      supabase
        .from('orders')
        .select('*, tables(table_number), order_items(id, quantity, price, created_at, kitchen_status, menu_items(name))')
        .not('status', 'in', '("paid","cancelled")'),
      supabase
        .from('waiter_calls')
        .select('*, tables(table_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('menu_items').select('*').eq('is_available', true).order('category'),
    ])

    if (!tblRes.error) setTables(tblRes.data || [])
    if (!ordRes.error) setActiveOrders(ordRes.data || [])
    if (!callsRes.error) setWaiterCalls(callsRes.data || [])
    if (!menuRes.error) setMenuItems(menuRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const subOrders = supabase
      .channel('waiter-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchData)
      .subscribe()
    const subCalls = supabase
      .channel('waiter-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, fetchData)
      .subscribe()
    const subTables = supabase
      .channel('waiter-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .subscribe()

    return () => {
      supabase.removeChannel(subOrders)
      supabase.removeChannel(subCalls)
      supabase.removeChannel(subTables)
    }
  }, [fetchData])

  const resolveCall = async (id) => {
    await supabase.from('waiter_calls').update({ status: 'resolved' }).eq('id', id)
  }

  const tablesWithDetails = useMemo(() => {
    return tables.map(t => {
      const order = activeOrders.find(o => o.table_id === t.id)
      let displayStatus = 'Free'
      if (t.status === 'occupied') displayStatus = 'Occupied'
      if (order) {
        const allItemsReady = order.order_items?.length > 0 &&
          order.order_items.every(i => i.kitchen_status === 'ready')
        displayStatus = allItemsReady ? 'Order Ready' : 'Active Order'
      }
      return { ...t, currentOrder: order, displayStatus }
    })
  }, [tables, activeOrders])

  const selectedTable = selectedTableId
    ? tablesWithDetails.find(t => t.id === selectedTableId) || null
    : null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-[env(safe-area-inset-bottom)] selection:bg-orange-200">
      
      {/* PREMIUM HEADER - TABLET OPTIMIZED */}
      <header className="glass shadow-[0_10px_30px_rgb(0,0,0,0.02)] sticky top-0 z-30 pt-safe">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-gradient-to-tr from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
               <i className="fa-solid fa-bell-concierge text-white text-xl"></i>
            </div>
            <nav className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50">
              <button 
                onClick={() => setActiveTab('tables')} 
                className={`px-8 py-3 rounded-xl font-black transition-all duration-300 text-sm ${activeTab === 'tables' ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 scale-95'}`}
              >
                TABLE MAP
              </button>
              <button 
                onClick={() => setActiveTab('orders')} 
                className={`px-8 py-3 rounded-xl font-black transition-all duration-300 text-sm ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 scale-95'}`}
              >
                LIVE ORDERS
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl border border-slate-200 leading-none">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Staff</span>
                <span className="font-black text-slate-800">{waiter?.name}</span>
              </div>
            </div>
            <button onClick={onLogout} className="w-12 h-12 bg-white border-2 border-slate-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-2xl flex items-center justify-center transition-all shadow-sm active:scale-95" title="Logout">
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="flex md:hidden border-t border-slate-100 bg-white">
          <button onClick={() => setActiveTab('tables')} className={`flex-1 py-4 font-black text-sm transition-all border-b-2 ${activeTab === 'tables' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-slate-400'}`}>MAP</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-4 font-black text-sm transition-all border-b-2 ${activeTab === 'orders' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-slate-400'}`}>ORDERS</button>
        </div>
      </header>

      {/* EMERGENCY WAITER CALLS (Top Notification) */}
      {waiterCalls.length > 0 && (
        <div className="bg-orange-500 border-b border-orange-600 relative z-20">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex gap-3 overflow-x-auto no-scrollbar snap-x">
            {waiterCalls.map(call => (
              <div key={call.id} className="snap-start shrink-0 bg-white shadow-lg w-max px-4 py-2.5 rounded-xl flex items-center gap-4 animate-slide-up border border-orange-300">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                   <i className="fa-solid fa-bell animate-ticker"></i>
                </div>
                <div>
                  <span className="font-black text-lg text-slate-800 block leading-none mb-1">Table {call.tables?.table_number}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">Assistance</span>
                </div>
                <button onClick={() => resolveCall(call.id)} className="ml-2 bg-slate-100 hover:bg-emerald-50 text-emerald-600 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm active:scale-95">
                  Done
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-8 overflow-y-auto">
        {loading && tables.length === 0 ? (
          <div className="flex justify-center py-32">
             <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mb-4 shadow-xl"></div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Syncing Data...</p>
             </div>
          </div>
        ) : (
          <>
            {activeTab === 'tables' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 auto-rows-max animate-pop-in stagger">
                {tablesWithDetails.map(t => (
                  <TableCard key={t.id} table={t} onClick={() => setSelectedTableId(t.id)} />
                ))}
              </div>
            )}
            {activeTab === 'orders' && (
              <div className="animate-slide-up bg-white rounded-3xl shadow-sm border border-slate-200 p-2 md:p-6">
                <OrdersList orders={activeOrders} onSelectOrder={(order) => { setSelectedTableId(order.table_id) }} />
              </div>
            )}
          </>
        )}
      </main>

      {/* DETAILS MODAL */}
      {selectedTable && (
        <TableDetailsModal
          key={selectedTable.id + '-' + (selectedTable.currentOrder?.id || 'none')}
          table={selectedTable}
          menuItems={menuItems}
          onClose={() => setSelectedTableId(null)}
          refreshData={fetchData}
        />
      )}
    </div>
  )
}

function TableCard({ table, onClick }) {
  let bgClass = 'bg-white border-slate-200 hover:border-slate-300'
  let icon = <i className="fa-solid fa-chair text-slate-300"></i>
  let statusBadge = 'bg-slate-100 text-slate-600 border-slate-200'
  let timerText = null
  let textClass = 'text-slate-400'

  if (table.displayStatus === 'Occupied') {
    bgClass = 'bg-yellow-50 border-yellow-200 shadow-yellow-100/50 hover:border-yellow-400'
    icon = <i className="fa-solid fa-users text-yellow-500"></i>
    statusBadge = 'bg-yellow-100 text-yellow-800 border-yellow-200'
    textClass = 'text-yellow-600'
  } else if (table.displayStatus === 'Active Order') {
    bgClass = 'bg-orange-50 border-orange-200 shadow-orange-100/50 hover:border-orange-400'
    icon = <i className="fa-solid fa-utensils text-orange-500"></i>
    statusBadge = 'bg-orange-100 text-orange-800 border-orange-200'
    textClass = 'text-orange-600'
    if (table.currentOrder) {
      const mins = Math.floor((Date.now() - new Date(table.currentOrder.created_at).getTime()) / 60000)
      timerText = `${mins}m ago`
    }
  } else if (table.displayStatus === 'Order Ready') {
    bgClass = 'bg-emerald-50 border-emerald-300 shadow-emerald-100 hover:border-emerald-500'
    icon = <i className="fa-solid fa-bell text-emerald-500 animate-bounce"></i>
    statusBadge = 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/30'
    textClass = 'text-emerald-700'
    if (table.currentOrder) {
      const mins = Math.floor((Date.now() - new Date(table.currentOrder.created_at).getTime()) / 60000)
      timerText = `${mins}m ago`
    }
  }

  return (
    <button onClick={onClick} className={`text-left rounded-3xl border-2 p-6 shadow-sm transition-all duration-200 flex flex-col h-44 active:scale-95 hover:-translate-y-1 hover:shadow-xl ${bgClass}`}>
      <div className="flex justify-between items-start mb-auto">
        <div className={`text-4xl font-black tracking-tighter ${textClass}`}>
          T{table.table_number}
        </div>
        <div className="text-3xl bg-white/60 w-12 h-12 flex items-center justify-center rounded-2xl shadow-inner border border-white">
          {icon}
        </div>
      </div>
      
      {table.currentOrder && (
         <div className="mt-2 mb-2 font-bold text-slate-700 line-clamp-1 break-words text-sm">
            {table.currentOrder.customer_name}
         </div>
      )}

      <div className="mt-auto flex justify-between items-end w-full">
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${statusBadge}`}>
          {table.displayStatus}
        </span>
        {timerText && <span className="text-[11px] font-black text-slate-400 font-mono bg-white/50 px-2 py-0.5 rounded-md">{timerText}</span>}
      </div>
    </button>
  )
}

function TableDetailsModal({ table, menuItems, onClose, refreshData }) {
  const [view, setView] = useState('details')
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('Walk-in ' + table.table_number)
  const [submitting, setSubmitting] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const toggleOccupied = async () => {
    const newStatus = table.status === 'free' ? 'occupied' : 'free'
    await supabase.from('tables').update({ status: newStatus }).eq('id', table.id)
    refreshData()
  }

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id)
      if (existing) return prev.map(p => p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p)
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeCart = (id) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === id)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(p => p.id !== id)
      return prev.map(p => p.id === id ? { ...p, quantity: p.quantity - 1 } : p)
    })
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  // Quick Action Buttons Logic (Get top 4 items by category to display as quick add)
  const quickItems = menuItems.slice(0, 4) 

  const submitOrder = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      if (table.currentOrder) {
        const itemsToInsert = cart.map(c => ({
          order_id: table.currentOrder.id,
          menu_item_id: c.id,
          quantity: c.quantity,
          price: c.price,
          kitchen_status: 'pending',
        }))
        const { error: insertErr } = await supabase.from('order_items').insert(itemsToInsert)
        if (insertErr) throw insertErr
        const newTotal = Number(table.currentOrder.total_amount) + cartTotal
        await supabase.from('orders').update({ total_amount: newTotal }).eq('id', table.currentOrder.id)
      } else {
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .insert({
            table_id: table.id,
            customer_name: customerName.trim() || `Walk-in ${table.table_number}`,
            status: 'pending',
            total_amount: cartTotal,
          })
          .select()
          .single()
        if (orderErr) throw orderErr

        const itemsToInsert = cart.map(c => ({
          order_id: orderData.id,
          menu_item_id: c.id,
          quantity: c.quantity,
          price: c.price,
          kitchen_status: 'pending',
        }))
        const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert)
        if (itemsErr) throw itemsErr
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id)
      }
      setCart([])
      setView('details')
      refreshData()
    } catch (err) {
      alert('Failed to submit order.')
    } finally {
      setSubmitting(false)
    }
  }

  const markPaid = async () => {
    if (!table.currentOrder) return
    if (!window.confirm(
      `Confirm payment for Table ${table.table_number}?\nTotal: ₹${Number(table.currentOrder.total_amount).toFixed(2)}`
    )) return

    setPaymentLoading(true)
    try {
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', table.currentOrder.id)
      if (orderErr) throw orderErr

      await supabase.from('payments').insert({
        order_id: table.currentOrder.id,
        payment_method: 'cash',
        payment_status: 'paid',
      })
      await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
      onClose()
      refreshData()
    } catch (err) {
      alert('Failed to process payment.')
    } finally {
      setPaymentLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end pb-[env(safe-area-inset-bottom)]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative z-10 w-full md:w-[900px] lg:w-[1100px] max-w-full h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 transform translate-x-full duration-300 ease-out fill-mode-forwards" style={{ animation: 'slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slide-in-right {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}} />

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 md:px-8 md:py-6 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 text-orange-700 rounded-2xl flex items-center justify-center text-2xl font-black shadow-sm border border-orange-200/50">
              T{table.table_number}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Table Overview</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{table.displayStatus}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-colors active:scale-90 text-lg shadow-sm">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/30">

          {view === 'details' ? (
            <div className="flex-1 p-6 md:p-10 overflow-y-auto w-full">
              {!table.currentOrder ? (
                /* EMPTY STATE */
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-40 h-40 bg-white border-2 border-slate-100 rounded-[3rem] flex items-center justify-center shadow-sm mb-8">
                    <i className="fa-solid fa-utensils text-6xl text-slate-200"></i>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-3">No Active Order</h3>
                  <p className="text-slate-500 font-medium max-w-md">Table is currently free. You can place a new order or update the table status manually.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mt-10">
                    <button onClick={toggleOccupied} className={`flex-1 py-5 rounded-2xl font-black text-base transition-all shadow-sm active:scale-95 border-2 ${table.status === 'occupied' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {table.status === 'occupied' ? 'Free Table' : 'Mark Occupied'}
                    </button>
                    <button onClick={() => setView('menu')} className="flex-1 py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black shadow-xl shadow-orange-600/30 transition-all active:scale-95 text-base">
                      + Create Order
                    </button>
                  </div>
                </div>
              ) : (
                /* ACTIVE ORDER DETAILS */
                <div className="h-full flex flex-col max-w-4xl mx-auto w-full">
                  
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-8 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div>
                      <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight capitalize mb-2">{table.currentOrder.customer_name}</h3>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                        <i className="fa-solid fa-hashtag text-slate-300"></i> {table.currentOrder.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className={`px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest shadow-inner ${
                      table.currentOrder.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                      table.currentOrder.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {table.currentOrder.status}
                    </div>
                  </div>

                  {/* Order Items Table */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex-1 mb-6 flex flex-col overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                      <span>Ordered Items</span>
                      <span>Kitchen State</span>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-2">
                      <ul className="space-y-2">
                        {table.currentOrder.order_items?.map(it => {
                          const ks = it.kitchen_status || 'pending'
                          const isReady = ks === 'ready'
                          const ksBadge = isReady ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                          ks === 'preparing' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                                          'bg-yellow-50 text-yellow-600 border border-yellow-200'
                          const lineTotal = Number(it.price) * Number(it.quantity)
                          
                          return (
                            <li key={it.id} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                  {it.quantity}
                                </span>
                                <div className="truncate">
                                  <span className="font-bold text-slate-800 text-lg leading-tight">{it.menu_items?.name}</span>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md shrink-0 shadow-sm ${ksBadge}`}>{ks}</span>
                              </div>
                              <span className="font-black text-slate-900 text-right w-24 shrink-0 text-xl font-mono">₹{lineTotal.toFixed(2)}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-slate-900 shadow-inner">
                      <span className="font-bold text-slate-500 uppercase tracking-widest text-sm">Amount Due</span>
                      <span className="font-black text-4xl tracking-tight leading-none text-slate-800">₹{Number(table.currentOrder.total_amount).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <button onClick={() => setView('menu')} className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-2xl font-black transition-all active:scale-95 flex justify-center items-center gap-3 text-lg">
                      <i className="fa-solid fa-plus-circle text-xl text-orange-500"></i> Add More Items
                    </button>
                    <button
                      onClick={markPaid}
                      disabled={paymentLoading}
                      className="flex-1 py-5 bg-teal-500 hover:bg-teal-400 disabled:opacity-70 text-white rounded-2xl font-black shadow-[0_10px_30px_rgba(20,184,166,0.3)] transition-all active:scale-95 flex justify-center items-center gap-3 text-lg"
                    >
                      {paymentLoading
                        ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing...</>
                        : <><i className="fa-solid fa-money-bill-wave"></i> Collect Payment</>
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* MENU + CART VIEW OVERRIDE FOR TABLETS */
            <>
              {/* Menu Column */}
              <div className="flex-1 bg-white p-6 md:p-8 overflow-y-auto border-r border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <button onClick={() => setView('details')} className="btn-ghost px-0 py-1 mb-2 text-sm text-orange-600 font-bold uppercase tracking-widest hover:bg-transparent hover:text-orange-700">
                      <i className="fa-solid fa-arrow-left mr-1"></i> Back
                    </button>
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">Menu Server</h3>
                  </div>
                  
                  {!table.currentOrder && (
                    <div className="w-64 relative">
                      <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Customer Name"
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-orange-500 rounded-xl py-3 pl-11 pr-4 font-bold outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Quick Add Top Bar (Waiters love this for speed) */}
                <div className="mb-8">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Quick Add</h4>
                  <div className="flex flex-wrap gap-3">
                     {quickItems.map(qi => (
                        <button key={qi.id} onClick={() => addToCart(qi)} className="bg-orange-50 border border-orange-100 hover:border-orange-300 text-orange-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all text-sm shadow-sm">
                           {qi.name} <span className="bg-orange-200/50 px-1.5 py-0.5 rounded text-[10px] font-black">+</span>
                        </button>
                     ))}
                  </div>
                </div>

                {/* Full Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {menuItems.map(item => {
                    const qty = cart.find(c => c.id === item.id)?.quantity || 0
                    const isActive = qty > 0
                    return (
                      <div key={item.id} className={`bg-white border-2 rounded-[1.5rem] p-4 transition-all shadow-sm flex flex-col h-40 ${isActive ? 'border-orange-400 shadow-orange-100' : 'border-slate-100 hover:border-slate-300'}`}>
                        <div className="font-bold text-slate-700 text-base leading-tight mb-1 line-clamp-2">{item.name}</div>
                        <div className="text-slate-400 font-bold mb-3 font-mono">₹{item.price}</div>
                        
                        <div className="mt-auto">
                          {qty > 0 ? (
                            <div className="flex items-center justify-between bg-orange-50 rounded-xl p-1.5 border border-orange-100">
                              <button onClick={() => removeCart(item.id)} className="w-10 h-10 flex items-center justify-center bg-white rounded-lg font-black text-slate-600 shadow-sm active:scale-90 transition-transform"><i className="fa-solid fa-minus text-xs"></i></button>
                              <span className="font-black text-xl text-orange-700 w-8 text-center">{qty}</span>
                              <button onClick={() => addToCart(item)} className="w-10 h-10 flex items-center justify-center bg-orange-500 rounded-lg font-black text-white shadow-sm active:scale-90 transition-transform"><i className="fa-solid fa-plus text-xs"></i></button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(item)} className="w-full py-3.5 bg-slate-50 border-2 border-slate-100 text-slate-600 hover:bg-white hover:border-slate-300 rounded-xl font-black text-sm transition-all active:scale-95 uppercase tracking-wide">
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cart Sidebar */}
              <div className="w-full md:w-[28rem] bg-slate-50 flex flex-col shrink-0 relative shadow-inner z-20">
                <div className="p-6 md:p-8 border-b border-slate-200 flex items-center justify-between bg-white">
                  <h3 className="font-black text-slate-800 text-2xl tracking-tight">Active Cart</h3>
                  <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                    {cart.reduce((a, b) => a + b.quantity, 0)} items
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 thin-scrollbar">
                  {cart.length === 0 ? (
                    <div className="text-slate-400 text-center flex flex-col items-center justify-center h-full opacity-60">
                      <i className="fa-solid fa-basket-shopping text-6xl mb-4"></i>
                      <p className="font-bold tracking-wide">Select items to begin</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex-1 pr-4">
                          <div className="font-bold text-slate-800 leading-tight mb-1">{item.name}</div>
                          <div className="text-sm font-semibold text-slate-500 font-mono">₹{item.price}</div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shadow-inner">
                          <button onClick={() => removeCart(item.id)} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm font-black text-slate-600 hover:text-red-500 active:scale-90"><i className="fa-solid fa-minus text-[10px]"></i></button>
                          <span className="font-black text-lg w-6 text-center text-slate-800">{item.quantity}</span>
                          <button onClick={() => addToCart(item)} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm font-black text-slate-600 hover:text-orange-600 active:scale-90"><i className="fa-solid fa-plus text-[10px]"></i></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-8 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
                  <div className="flex justify-between items-end mb-6">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-1">Total</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tighter">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={submitOrder}
                    disabled={cart.length === 0 || submitting}
                    className="w-full py-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white rounded-[1.5rem] font-black text-xl shadow-[0_10px_20px_rgba(0,0,0,0.1)] transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wide"
                  >
                    {submitting ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing</>
                    ) : (
                      table.currentOrder ? <><i className="fa-solid fa-paper-plane text-base"></i> Send to Kitchen</> : <><i className="fa-solid fa-plus text-base"></i> Create Order</>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function OrdersList({ orders, onSelectOrder }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-32 rounded-[2rem]">
        <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-full mx-auto mb-4 border border-slate-100 shadow-inner">
           <i className="fa-solid fa-receipt text-3xl text-slate-300"></i>
        </div>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight">No active orders</h3>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto thin-scrollbar pb-4">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-100 text-[11px] uppercase tracking-widest text-slate-400 font-black">
            <th className="p-5 pb-3">Table</th>
            <th className="p-5 pb-3">Customer</th>
            <th className="p-5 pb-3">Status</th>
            <th className="p-5 pb-3">Items Overview</th>
            <th className="p-5 pb-3 text-right">Total Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {orders.map(o => (
            <tr key={o.id} onClick={() => onSelectOrder(o)} className="hover:bg-orange-50/50 cursor-pointer transition-colors group">
              <td className="p-5">
                <span className="bg-slate-900 text-white px-4 py-2 text-lg rounded-xl font-black block w-max shadow-sm group-hover:bg-orange-600 transition-colors">
                  T{o.tables?.table_number}
                </span>
              </td>
              <td className="p-5">
                 <div className="font-bold text-slate-800 text-lg">{o.customer_name}</div>
                 <div className="text-xs font-bold text-slate-400 font-mono tracking-widest uppercase">#{o.id.slice(0,8)}</div>
              </td>
              <td className="p-5">
                <span className={`px-4 py-1.5 rounded-[0.5rem] text-[10px] font-black uppercase tracking-widest block w-max shadow-inner border ${
                  o.status === 'ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  o.status === 'preparing' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                }`}>
                  {o.status}
                </span>
              </td>
              <td className="p-5 text-sm font-semibold text-slate-500 max-w-[300px] truncate leading-relaxed">
                {o.order_items?.map(it => `${it.quantity} ${it.menu_items?.name}`).join(', ')}
              </td>
              <td className="p-5 text-right">
                 <span className="font-black text-slate-800 text-2xl font-mono">₹{Number(o.total_amount).toFixed(2)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
