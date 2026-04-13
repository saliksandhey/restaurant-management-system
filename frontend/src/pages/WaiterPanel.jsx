import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function WaiterPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [waiter, setWaiter] = useState(null)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-700 text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <i className="fa-solid fa-user-tie text-3xl text-white"></i>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Staff Portal</h1>
          <p className="text-slate-400 mb-8 font-medium">Enter your secure PIN to access operations.</p>

          <form onSubmit={async (e) => {
            e.preventDefault()
            setLoginError('')
            const { data, error } = await supabase.from('waiters').select('*').eq('pass_code', pin).eq('is_active', true).single()
            if (error || !data) setLoginError('Invalid PIN or inactive staff profile.')
            else { setWaiter(data); setIsAuthenticated(true); }
          }} className="space-y-6">
            <input 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 rounded-2xl p-4 text-center text-4xl font-mono text-white tracking-[0.5em] focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              autoFocus
            />
            {loginError && <p className="text-red-400 text-sm font-semibold">{loginError}</p>}
            <button type="submit" className="w-full py-4 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-black text-lg transition-transform active:scale-95 shadow-xl">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <WaiterDashboard waiter={waiter} onLogout={() => { setIsAuthenticated(false); setPin(''); }} />
}

function WaiterDashboard({ waiter, onLogout }) {
  const [activeTab, setActiveTab] = useState('tables') // 'tables' | 'orders'
  
  const [tables, setTables] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [waiterCalls, setWaiterCalls] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Selection states
  const [selectedTable, setSelectedTable] = useState(null)
  
  const fetchData = async () => {
    setLoading(true)
    
    const [tblRes, ordRes, callsRes, menuRes] = await Promise.all([
      supabase.from('tables').select('*').order('table_number'),
      supabase.from('orders').select('*, order_items(id, quantity, price, menu_items(name))').in('status', ['pending', 'accepted', 'preparing', 'ready']),
      supabase.from('waiter_calls').select('*, tables(table_number)').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('menu_items').select('*').eq('is_available', true).order('category')
    ])

    if (!tblRes.error) setTables(tblRes.data)
    if (!ordRes.error) setActiveOrders(ordRes.data)
    if (!callsRes.error) setWaiterCalls(callsRes.data)
    if (!menuRes.error) setMenuItems(menuRes.data)
    
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Subscriptions
    const subOrders = supabase.channel('waiter-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe()
    const subCalls = supabase.channel('waiter-calls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, fetchData)
      .subscribe()
    const subTables = supabase.channel('waiter-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .subscribe()

    return () => {
      supabase.removeChannel(subOrders)
      supabase.removeChannel(subCalls)
      supabase.removeChannel(subTables)
    }
  }, [])

  const resolveCall = async (id) => {
    await supabase.from('waiter_calls').update({ status: 'resolved' }).eq('id', id)
    fetchData()
  }

  // Derived state mapping tables to their orders
  const tablesWithDetails = useMemo(() => {
    return tables.map(t => {
      const order = activeOrders.find(o => o.table_id === t.id)
      let displayStatus = 'Free'
      if (t.status === 'occupied') displayStatus = 'Occupied'
      if (order) {
        if (order.status === 'ready') displayStatus = 'Waiting Payment'
        else displayStatus = 'Active Order'
      }
      return { ...t, currentOrder: order, displayStatus }
    })
  }, [tables, activeOrders])

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-[env(safe-area-inset-bottom)]">
      {/* Top Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <i className="fa-solid fa-bell-concierge text-blue-400"></i> WaiterApp
            </h1>
            <nav className="hidden md:flex gap-2">
              <button onClick={() => setActiveTab('tables')} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'tables' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'}`}>Tables Overview</button>
              <button onClick={() => setActiveTab('orders')} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'}`}>All Active Orders</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-medium text-slate-300 hidden md:block">Staff: <span className="text-white font-bold">{waiter?.name}</span></span>
            <button onClick={onLogout} className="w-10 h-10 bg-slate-800 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors shadow-inner">
              <i className="fa-solid fa-power-off text-sm"></i>
            </button>
          </div>
        </div>
        
        {/* Mobile Nav */}
        <div className="flex md:hidden border-t border-slate-800">
          <button onClick={() => setActiveTab('tables')} className={`flex-1 py-4 font-bold border-b-2 ${activeTab === 'tables' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400'}`}>Tables</button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-4 font-bold border-b-2 ${activeTab === 'orders' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400'}`}>Orders</button>
        </div>
      </header>

      {/* Alerts Bar for Waiter Calls */}
      {waiterCalls.length > 0 && (
        <div className="bg-orange-500 text-white shadow-md z-20">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex gap-4 overflow-x-auto snap-x hide-scrollbar">
            {waiterCalls.map(call => (
              <div key={call.id} className="snap-start shrink-0 bg-white/20 px-4 py-2 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-2">
                <span className="font-black text-lg whitespace-nowrap"><i className="fa-solid fa-bell animate-bounce mr-2"></i> Table {call.tables?.table_number}</span>
                <span className="text-sm font-semibold opacity-90 whitespace-nowrap tracking-wide">Assistance Needed!</span>
                <button onClick={() => resolveCall(call.id)} className="ml-2 bg-white text-orange-600 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-orange-50 transition-colors shadow-sm">
                  Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 overflow-y-auto">
        {loading && tables.length === 0 ? (
          <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <>
            {activeTab === 'tables' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 auto-rows-max animate-in fade-in zoom-in-95 duration-200">
                {tablesWithDetails.map(t => (
                  <TableCard key={t.id} table={t} onClick={() => setSelectedTable(t)} />
                ))}
              </div>
            )}
            {activeTab === 'orders' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <OrdersList orders={activeOrders} onSelectOrder={(order) => {
                  const table = tablesWithDetails.find(t => t.id === order.table_id)
                  setSelectedTable(table)
                }} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Detail Modal */}
      {selectedTable && (
        <TableDetailsModal 
          table={selectedTable} 
          menuItems={menuItems} 
          onClose={() => setSelectedTable(null)} 
          refreshData={fetchData} 
        />
      )}
    </div>
  )
}

function TableCard({ table, onClick }) {
  // Styles based on status
  let bgClass = "bg-white border-slate-200"
  let icon = <i className="fa-solid fa-chair text-slate-300"></i>
  let statusBadge = "bg-slate-100 text-slate-600"
  let timerText = null

  if (table.displayStatus === 'Occupied') {
    bgClass = "bg-yellow-50 border-yellow-200 shadow-yellow-100"
    icon = <i className="fa-solid fa-users text-yellow-500"></i>
    statusBadge = "bg-yellow-200 text-yellow-800"
  } else if (table.displayStatus === 'Active Order') {
    bgClass = "bg-blue-50 border-blue-200 shadow-blue-100"
    icon = <i className="fa-solid fa-utensils text-blue-500"></i>
    statusBadge = "bg-blue-200 text-blue-800"
    // Calc elapsed
    if (table.currentOrder) {
      const mins = Math.floor((Date.now() - new Date(table.currentOrder.created_at).getTime()) / 60000)
      timerText = `${mins}m ago`
    }
  } else if (table.displayStatus === 'Waiting Payment') {
    bgClass = "bg-green-50 border-green-200 shadow-green-100"
    icon = <i className="fa-solid fa-receipt text-green-500"></i>
    statusBadge = "bg-green-200 text-green-800"
  }

  return (
    <button onClick={onClick} className={`text-left rounded-3xl border-2 p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col h-40 ${bgClass}`}>
      <div className="flex justify-between items-start mb-auto">
        <div className="text-3xl font-black text-slate-800">T{table.table_number}</div>
        <div className="text-2xl">{icon}</div>
      </div>
      
      <div className="mt-4 flex justify-between items-end">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusBadge}`}>
          {table.displayStatus}
        </span>
        {timerText && <span className="text-xs font-bold text-slate-500 font-mono">{timerText}</span>}
      </div>
    </button>
  )
}

function TableDetailsModal({ table, menuItems, onClose, refreshData }) {
  const [view, setView] = useState('details') // 'details' | 'menu'
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('Walk-in ' + table.table_number)

  const toggleOccupied = async () => {
    const newStatus = table.status === 'free' ? 'occupied' : 'free'
    await supabase.from('tables').update({ status: newStatus }).eq('id', table.id)
    refreshData()
  }

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id)
      if (existing) return prev.map(p => p.id === item.id ? { ...p, quantity: p.quantity + 1} : p)
      return [...prev, { ...item, quantity: 1}]
    })
  }

  const removeCart = (id) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === id)
      if (existing.quantity === 1) return prev.filter(p => p.id !== id)
      return prev.map(p => p.id === id ? { ...p, quantity: p.quantity - 1} : p)
    })
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const submitOrder = async () => {
    if (cart.length === 0) return

    if (table.currentOrder) {
      // Append to existing
      const itemsToInsert = cart.map(c => ({ order_id: table.currentOrder.id, menu_item_id: c.id, quantity: c.quantity, price: c.price * c.quantity }))
      await supabase.from('order_items').insert(itemsToInsert)
      const newTotal = Number(table.currentOrder.total_amount) + cartTotal
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', table.currentOrder.id)
    } else {
      // Create new order
      const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
        table_id: table.id,
        customer_name: customerName,
        status: 'pending',
        total_amount: cartTotal
      }).select().single()

      if (!orderErr) {
        const itemsToInsert = cart.map(c => ({ order_id: orderData.id, menu_item_id: c.id, quantity: c.quantity, price: c.price * c.quantity }))
        await supabase.from('order_items').insert(itemsToInsert)
        // Mark table as occupied just in case
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', table.id)
      }
    }
    setCart([])
    setView('details')
    refreshData()
  }

  const markPaid = async () => {
    if (!table.currentOrder) return
    // Simple direct to 'paid' status workflow
    await supabase.from('orders').update({ status: 'paid' }).eq('id', table.currentOrder.id)
    // Create payment record
    await supabase.from('payments').insert({ order_id: table.currentOrder.id, payment_method: 'cash', payment_status: 'paid' })
    await supabase.from('tables').update({ status: 'free' }).eq('id', table.id)
    onClose()
    refreshData()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-5xl h-[95vh] md:h-[85vh] rounded-[2rem] shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black">
              T{table.table_number}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">Table Overview</h2>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{table.displayStatus}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-200 hover:bg-red-500 hover:text-white text-slate-600 rounded-full flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {view === 'details' ? (
            <div className="flex-1 p-6 overflow-y-auto w-full">
              {!table.currentOrder ? (
                // EMPTY STATE
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 text-5xl mb-4">
                    <i className="fa-solid fa-utensils"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">No Active Order</h3>
                    <p className="text-slate-500 mt-2 font-medium">This table is currently not serving any verified orders.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-8">
                    <button onClick={toggleOccupied} className={`flex-1 py-4 px-6 rounded-2xl font-bold transition-all shadow-md active:scale-95 ${table.status === 'occupied' ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300' : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {table.status === 'occupied' ? 'Set as Free' : 'Set as Occupied'}
                    </button>
                    <button onClick={() => setView('menu')} className="flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black shadow-lg shadow-blue-600/30 transition-all active:scale-95">
                      + Place Order
                    </button>
                  </div>
                </div>
              ) : (
                // ACTIVE ORDER DETAILS
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-3xl font-black text-slate-900">{table.currentOrder.customer_name}</h3>
                      <p className="text-slate-500 font-medium">Order ID: {table.currentOrder.id.slice(0,8)}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest ${table.currentOrder.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {table.currentOrder.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex-1 mb-6 overflow-y-auto">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Line Items</h4>
                    <ul className="space-y-4">
                      {table.currentOrder.order_items?.map(it => (
                        <li key={it.id} className="flex justify-between items-center text-lg">
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">{it.quantity}</span>
                            <span className="font-bold text-slate-700">{it.menu_items?.name}</span>
                          </div>
                          <span className="font-black text-slate-900">₹{Number(it.price).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <button onClick={() => setView('menu')} className="flex-1 py-5 bg-white border-2 border-slate-200 text-slate-800 hover:border-blue-500 hover:text-blue-600 rounded-2xl font-black transition-all active:scale-95 flex justify-center items-center gap-2">
                       <i className="fa-solid fa-plus"></i> Add Items
                    </button>
                    {(table.currentOrder.status === 'ready' || table.currentOrder.status === 'preparing') && (
                      <button onClick={markPaid} className="flex-1 py-5 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black shadow-lg shadow-green-500/30 transition-all active:scale-95 flex justify-center items-center gap-2">
                        Collect Payment
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // MENU AND ORDERING VIEW
            <>
              {/* Menu Layout */}
              <div className="flex-1 bg-slate-50/50 p-4 md:p-6 overflow-y-auto border-r border-slate-200">
                <div className="flex flex-col mb-6 gap-2">
                  <button onClick={() => setView('details')} className="self-start text-sm font-bold text-blue-600 hover:underline mb-2"><i className="fa-solid fa-arrow-left mr-1"></i> Back</button>
                  <h3 className="text-2xl font-black text-slate-800">Menu Select</h3>
                  {!table.currentOrder && (
                     <input 
                      type="text" 
                      value={customerName} 
                      onChange={(e)=>setCustomerName(e.target.value)} 
                      placeholder="Customer Name" 
                      className="w-full md:w-1/2 p-3 border-2 border-slate-200 focus:border-blue-500 rounded-xl font-bold outline-none" 
                     />
                  )}
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {menuItems.map(item => (
                    <button key={item.id} onClick={() => addToCart(item)} className="bg-white border-2 border-slate-100 hover:border-blue-500 p-4 rounded-2xl text-left transition-all active:scale-95 flex flex-col h-full shadow-sm">
                      <div className="font-bold text-slate-800 text-lg leading-tight mb-2">{item.name}</div>
                      <div className="text-blue-600 font-black mt-auto">₹{item.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart Layout */}
              <div className="w-full md:w-96 bg-white flex flex-col h-[40vh] md:h-full shrink-0 border-t md:border-t-0 border-slate-200">
                <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-800 text-xl">Current Cart</h3>
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{cart.reduce((a,b)=>a+b.quantity,0)} items</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                  {cart.length === 0 ? <p className="text-slate-400 text-center font-medium italic mt-10">Cart is empty</p> : 
                    cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center group">
                        <div className="flex-1 pr-4">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-sm font-semibold text-slate-500">₹{item.price}</div>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl">
                          <button onClick={() => removeCart(item.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-slate-600 hover:text-red-500"><i className="fa-solid fa-minus"></i></button>
                          <span className="font-black text-lg w-4 text-center">{item.quantity}</span>
                          <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-slate-600 hover:text-blue-600"><i className="fa-solid fa-plus"></i></button>
                        </div>
                      </div>
                    ))
                  }
                </div>

                <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-slate-500 font-bold uppercase tracking-widest text-sm">Total</span>
                    <span className="text-3xl font-black text-slate-900">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <button onClick={submitOrder} disabled={cart.length === 0} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:shadow-none text-white rounded-2xl font-black text-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95">
                    {table.currentOrder ? 'Confirm Additions' : 'Place Order'}
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
      <div className="text-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
        <h3 className="text-2xl font-bold text-slate-400">No active orders</h3>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-bold">
              <th className="p-5">Order ID</th>
              <th className="p-5">Table</th>
              <th className="p-5">Customer</th>
              <th className="p-5">Status</th>
              <th className="p-5">Items</th>
              <th className="p-5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} onClick={() => onSelectOrder(o)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                <td className="p-5 font-mono text-sm text-slate-400 font-semibold group-hover:text-blue-600">{o.id.slice(0,8)}</td>
                <td className="p-5">
                  <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-lg font-black block w-max">
                    T{o.tables?.table_number}
                  </span>
                </td>
                <td className="p-5 font-bold text-slate-800">{o.customer_name}</td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest block w-max ${
                    o.status === 'ready' ? 'bg-green-100 text-green-700' :
                    o.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-5 text-sm font-semibold text-slate-500 max-w-[200px] truncate">
                  {o.order_items?.map(it => it.menu_items?.name).join(', ')}
                </td>
                <td className="p-5 font-black text-slate-800">₹{Number(o.total_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
