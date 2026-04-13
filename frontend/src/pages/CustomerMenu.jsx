import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function CustomerMenu() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [table, setTable] = useState(null)
  const [tableError, setTableError] = useState(false)
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  const [cart, setCart] = useState({})
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isCheckout, setIsCheckout] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [instructions, setInstructions] = useState('')

  const [placingOrder, setPlacingOrder] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [isTrackerExpanded, setIsTrackerExpanded] = useState(false)
  
  const [callingWaiter, setCallingWaiter] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  // Realtime Active Order Tracker
  useEffect(() => {
    if (!activeOrder) return
    const channel = supabase
      .channel(`customer-order-${activeOrder.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` },
        (payload) => {
          const newStatus = payload.new.status
          if (newStatus === 'paid' || newStatus === 'cancelled' || newStatus === 'completed') {
            setActiveOrder(null)
            setIsTrackerExpanded(false)
          } else {
            setActiveOrder(prev => ({ ...prev, status: newStatus }))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeOrder?.id])

  useEffect(() => {
    initMenu()
  }, [])

  const initMenu = async () => {
    setLoading(true)
    try {
      const tableIdParam = searchParams.get('table_id')
      const tableNumParam = searchParams.get('table')
      let matchedTable = null

      if (tableIdParam) {
        const { data } = await supabase.from('tables').select('*').eq('id', tableIdParam).single()
        if (data) { matchedTable = data; setTable(data) } else { setTableError(true) }
      } else if (tableNumParam) {
        const { data } = await supabase.from('tables').select('*').eq('table_number', parseInt(tableNumParam)).single()
        if (data) { matchedTable = data; setTable(data) } else { setTableError(true) }
      } else {
        setTableError(true)
      }

      if (matchedTable) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select(`*, order_items(quantity, menu_items(name))`)
          .eq('table_id', matchedTable.id)
          .not('status', 'in', '("paid","cancelled","completed")')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (existingOrder) setActiveOrder(existingOrder)
      }

      const { data: mData, error: mError } = await supabase.from('menu_items').select('*').eq('is_available', true).order('category')
      if (mError) throw mError
      setMenuItems(mData || [])
    } catch (err) {
      console.error('Init menu error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cart Functions
  const addToCart = (item) => {
    setCart(prev => ({
      ...prev,
      [item.id]: { ...item, quantity: (prev[item.id]?.quantity || 0) + 1 }
    }))
  }

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[itemId].quantity > 1) {
        newCart[itemId].quantity -= 1
      } else {
        delete newCart[itemId]
      }
      if (Object.keys(newCart).length === 0) {
        setIsCartOpen(false)
        setIsCheckout(false)
      }
      return newCart
    })
  }

  const getTotalItems = () => Object.values(cart).reduce((s, i) => s + i.quantity, 0)
  const getTotalAmount = () => Object.values(cart).reduce((s, i) => s + (i.price * i.quantity), 0)

  // Order Placement
  const placeOrder = async () => {
    if (!customerName.trim() && !activeOrder) return alert('Please enter your name for the order.')
    if (!table) return alert('Invalid table session. Please scan the QR code again.')

    setPlacingOrder(true)
    try {
      const amount = getTotalAmount()
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          table_id: table.id,
          customer_name: activeOrder ? activeOrder.customer_name : customerName.trim(),
          phone: phone.trim() || null,
          status: 'pending',
          total_amount: amount,
          special_instructions: instructions.trim() || null
        }])
        .select()
        .single()
      if (orderError) throw orderError

      const orderItemsData = Object.values(cart).map(item => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData)
      if (itemsError) throw itemsError

      const { data: newFullOrder } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, menu_items(name))`)
        .eq('id', orderData.id)
        .single()

      setActiveOrder(newFullOrder || orderData)
      setCart({})
      setIsCartOpen(false)
      setIsCheckout(false)
    } catch (err) {
      alert('Failed to place order. Please try again.')
    } finally {
      setPlacingOrder(false)
    }
  }

  const callWaiter = async () => {
    if (!table) return alert('Invalid table session.')
    setCallingWaiter(true)
    try {
      const { error } = await supabase.from('waiter_calls').insert([{ table_id: table.id }])
      if (error) throw error
      alert('Staff has been notified and will be with you shortly!')
    } catch (err) {
      alert('Failed to alert waiter. Please try again.')
    } finally {
      setCallingWaiter(false)
    }
  }

  const categories = ['All', ...new Set(menuItems.map(i => i.category))]
  const filteredItems = activeCategory === 'All' ? menuItems : menuItems.filter(i => i.category === activeCategory)

  // --- RENDERS ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent shadow-xl"></div>
      </div>
    )
  }

  if (tableError && !table) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <i className="fa-solid fa-qrcode text-4xl text-red-500"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Table Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-sm">Please scan the valid QR code placed on your table to start ordering from the menu.</p>
        <button
          onClick={() => navigate('/scan')}
          className="w-full max-w-xs py-4 bg-orange-600 hover:bg-orange-500 active:scale-[0.98] transition-all rounded-2xl font-black text-white flex items-center justify-center gap-3 shadow-xl shadow-orange-600/30"
        >
          <i className="fa-solid fa-camera"></i> Scan QR Code
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-[120px] font-sans selection:bg-orange-200">
      
      {/* 1. HEADER DESIGN */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 flex justify-between items-center transition-all">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-utensils text-orange-600"></i> The Great Bites
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">
            Table {table?.table_number}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={callWaiter} 
            disabled={callingWaiter}
            className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shadow-sm disabled:opacity-50 active:scale-95 transition-all"
            aria-label="Call Waiter"
          >
            <i className="fa-solid fa-bell"></i>
          </button>
          
          <button 
            onClick={() => getTotalItems() > 0 && setIsCartOpen(true)}
            className="relative w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm active:scale-95 transition-all"
          >
            <i className="fa-solid fa-bag-shopping text-lg"></i>
            {getTotalItems() > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md">
                {getTotalItems()}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <div className="p-4 pt-6">
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-[2rem] p-6 shadow-xl shadow-orange-600/20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-8 -mb-8 blur-xl"></div>
          
          <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-3 border border-white/20 shadow-sm">
            🔥 10% OFF Today
          </div>
          <h2 className="text-2xl font-black leading-tight mb-1 relative z-10">Delicious Food <br/>Awaits 🍽️</h2>
          <p className="text-sm font-medium text-orange-100 relative z-10 w-2/3">Order directly from your table effortlessly.</p>
        </div>
      </div>

      {/* 3. CATEGORY SCROLL */}
      <div className="sticky top-[73px] z-20 bg-slate-50/95 backdrop-blur-md pb-4 pt-1 shadow-[0_10px_10px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex overflow-x-auto gap-3 px-4 no-scrollbar items-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${
                activeCategory === cat 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                  : 'bg-white text-slate-600 border border-slate-100 active:bg-slate-100'
              }`}
            >
              <span className="capitalize">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. MENU ITEMS DESIGN */}
      <div className="px-4 pb-8 space-y-4 pt-4">
        {filteredItems.map(item => {
          const qty = cart[item.id]?.quantity || 0
          return (
            <div key={item.id} className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100 flex gap-4 h-36 relative overflow-hidden active:scale-[0.98] transition-transform">
              
              {/* Product Image */}
              <div className="w-32 h-full rounded-2xl bg-slate-100 relative overflow-hidden shrink-0 flex items-center justify-center border border-slate-50">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-image text-slate-300 text-3xl"></i>
                )}
                {/* Optional Bestseller Badge */}
                {item.price > 15 && (
                  <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm uppercase tracking-wider">
                    Must Try
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div className="flex-1 flex flex-col py-1 pr-1 w-full relative">
                <div className="mb-auto">
                  <h3 className="font-bold text-slate-800 text-base leading-tight pr-4 line-clamp-2">{item.name}</h3>
                  <p className="font-black text-slate-900 mt-1">₹{Number(item.price).toFixed(2)}</p>
                </div>
                
                {/* Add / Qty Controls positioned at bottom right */}
                <div className="absolute bottom-1 right-1 flex justify-end">
                  {qty > 0 ? (
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl p-1 shadow-sm">
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-white text-orange-600 font-black shadow-sm flex items-center justify-center active:scale-90 transition-transform"><i className="fa-solid fa-minus text-xs"></i></button>
                      <span className="font-black w-4 text-center text-orange-700 text-sm">{qty}</span>
                      <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-lg bg-orange-600 text-white font-black shadow-sm flex items-center justify-center active:scale-90 transition-transform shadow-orange-600/30"><i className="fa-solid fa-plus text-xs"></i></button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => addToCart(item)}
                      className="bg-orange-50 text-orange-600 border border-orange-100 text-sm font-black px-6 py-2.5 rounded-xl shadow-sm hover:bg-orange-100 active:scale-90 transition-all flex items-center gap-2"
                    >
                      ADD <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
             <i className="fa-solid fa-plate-wheat text-4xl text-slate-300 mb-3"></i>
             <p className="text-slate-500 font-medium">No items found in this section.</p>
          </div>
        )}
      </div>

      {/* 5. FLOATING CART BUTTON */}
      {getTotalItems() > 0 && !isCartOpen && !activeOrder && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-40 flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-300">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full max-w-md bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-4 shadow-xl shadow-slate-900/30 flex justify-between items-center transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 text-white font-bold h-9 w-9 rounded-xl flex items-center justify-center">{getTotalItems()}</span>
              <div className="text-left leading-tight">
                 <span className="font-bold text-sm block">View Cart</span>
                 <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Taxes applied at checkout</span>
              </div>
            </div>
            <span className="font-black text-xl">₹{getTotalAmount().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* 8. ORDER TRACKING UI (BOTTOM CARD) */}
      {activeOrder && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 bg-slate-900 text-white rounded-3xl p-5 shadow-2xl shadow-slate-900/40 animate-in slide-in-from-bottom-10 duration-500 border border-slate-800">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-black text-lg flex items-center gap-2">Your Order Status 🍳</h3>
              <p className="text-slate-400 text-sm font-medium mt-1">₹{Number(activeOrder.total_amount).toFixed(2)} • {activeOrder.order_items?.reduce((a,b)=>a+b.quantity, 0) || 0} items</p>
            </div>
            
            <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${
              activeOrder.status === 'pending' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              activeOrder.status === 'preparing' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
              'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              {activeOrder.status === 'ready' ? 'Ready to Serve' : activeOrder.status}
            </div>
          </div>
          
          <button 
            onClick={() => setIsTrackerExpanded(!isTrackerExpanded)}
            className="w-full py-3 bg-white/10 hover:bg-white/20 active:bg-white/5 rounded-2xl font-bold text-sm transition-colors text-white"
          >
            {isTrackerExpanded ? 'Hide Details' : 'View Details'}
          </button>

          {isTrackerExpanded && (
            <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in duration-300">
              <ul className="space-y-3 mb-4">
                {activeOrder.order_items?.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-start text-sm">
                    <div className="flex gap-3">
                      <span className="font-black text-slate-400">{item.quantity}x</span>
                      <span className="font-semibold text-slate-200">{item.menu_items?.name}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {activeOrder.status === 'ready' && (
                <div className="bg-green-500/20 p-3 rounded-xl border border-green-500/30 text-center">
                  <p className="font-black text-green-400 text-sm">Please pay at the front desk or wait for staff!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6 & 7. CART & CHECKOUT UI (MODERN DRAWER) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => { setIsCartOpen(false); setIsCheckout(false); }}></div>
          
          <div className="bg-slate-50 w-full h-[85vh] rounded-t-[2.5rem] relative flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300 ease-out">
            {/* Drawer Handle */}
            <div className="flex justify-center pt-3 pb-1 w-full absolute top-0 z-10" onClick={() => { setIsCartOpen(false); setIsCheckout(false); }}>
              <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
            </div>

            <div className="px-6 pt-10 pb-4 flex justify-between items-center bg-white rounded-t-[2.5rem] shadow-sm z-0 relative">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{isCheckout ? 'Checkout' : 'Your Order'}</h2>
              <button onClick={() => { setIsCartOpen(false); setIsCheckout(false); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 active:scale-90 transition-transform">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!isCheckout ? (
                <>
                  {/* Cart Items List */}
                  <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100">
                    {Object.values(cart).map(item => (
                      <div key={item.id} className="flex justify-between items-center p-4 border-b border-slate-50 last:border-0">
                        <div className="flex-1 pr-4">
                          <p className="font-bold text-slate-800 text-base mb-0.5">{item.name}</p>
                          <p className="text-slate-500 font-bold text-sm">₹{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                          <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-black shadow-sm flex items-center justify-center active:scale-90"><i className="fa-solid fa-minus text-[10px]"></i></button>
                          <span className="font-black w-4 text-center text-sm text-slate-800">{item.quantity}</span>
                          <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-lg bg-orange-600 text-white font-black shadow-sm shadow-orange-600/30 flex items-center justify-center active:scale-90"><i className="fa-solid fa-plus text-[10px]"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Bill Summary */}
                  <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 mb-4">Bill Summary</h3>
                    <div className="space-y-3 text-sm font-semibold text-slate-600 border-b border-slate-100 pb-4 mb-4">
                      <div className="flex justify-between"><span>Subtotal</span><span>₹{getTotalAmount().toFixed(2)}</span></div>
                      <div className="flex justify-between text-green-600"><span>Taxes & Fees</span><span>Included</span></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-900 text-lg">Grant Total</span>
                      <span className="font-black text-slate-900 text-2xl">₹{getTotalAmount().toFixed(2)}</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Checkout Form */
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
                  {activeOrder && (
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-blue-800 text-sm font-bold items-start">
                      <i className="fa-solid fa-circle-info mt-0.5"></i>
                      <p>You have an active tab. These items will be securely appended to your current order under <span className="text-blue-900">{activeOrder.customer_name}</span>.</p>
                    </div>
                  )}

                  {!activeOrder && (
                    <>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Your Name *</label>
                        <input 
                          type="text" 
                          value={customerName} 
                          onChange={e => setCustomerName(e.target.value)} 
                          className="w-full bg-slate-50 border outline-none border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold transition-all text-slate-800" 
                          placeholder="What should we call you?"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Phone Number</label>
                        <input 
                          type="tel" 
                          value={phone} 
                          onChange={e => setPhone(e.target.value)} 
                          className="w-full bg-slate-50 border outline-none border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold transition-all text-slate-800" 
                          placeholder="(Optional)"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Cooking Instructions</label>
                    <textarea 
                      value={instructions} 
                      onChange={e => setInstructions(e.target.value)} 
                      className="w-full bg-slate-50 border outline-none border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none font-semibold text-sm transition-all text-slate-800 h-28" 
                      placeholder="Any allergies or spice preferences?" 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-4 border-t border-slate-100 pb-8 rounded-b-[2.5rem] shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
              {!isCheckout ? (
                <button 
                  onClick={() => setIsCheckout(true)}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] flex justify-center items-center shadow-xl shadow-orange-600/30"
                >
                  Proceed to Checkout
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsCheckout(false)}
                    className="w-16 flex-shrink-0 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center font-bold active:scale-95 transition-all text-sm"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <button 
                    onClick={placeOrder}
                    disabled={placingOrder}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex justify-between px-6 items-center shadow-xl shadow-slate-900/30"
                  >
                    {placingOrder ? (
                      <span className="flex items-center gap-2 m-auto"><i className="fa-solid fa-circle-notch fa-spin"></i> Processing</span>
                    ) : (
                      <>
                        <span>Place Order</span>
                        <span>₹{getTotalAmount().toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
