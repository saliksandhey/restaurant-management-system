import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function KitchenPanel() {
  const [kitchenBatches, setKitchenBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const wakeLockRef = useRef(null)
  const prevCountRef = useRef(0)
  const soundEnabledRef = useRef(soundEnabled)

  // Keep ref in sync so fetchKitchenItems closure doesn't go stale
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  // Screen Wake Lock
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch (err) {
      // Wake lock not supported or denied — silently ignore
    }
  }

  useEffect(() => {
    requestWakeLock()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const playNotification = useCallback(() => {
    if (!soundEnabledRef.current) return
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15)
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6)
      oscillator.start(audioCtx.currentTime)
      oscillator.stop(audioCtx.currentTime + 0.6)
    } catch (e) {
      // Audio not available
    }
  }, [])

  const fetchKitchenItems = useCallback(async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, status, customer_name, special_instructions, created_at,
          tables(table_number),
          order_items!inner(
            id, quantity, kitchen_status, created_at,
            menu_items(name)
          )
        `)
        .not('status', 'in', '("paid","cancelled")')
        .in('order_items.kitchen_status', ['pending', 'preparing'])
        .order('created_at', { ascending: true })

      if (ordersError) throw ordersError

      const batches = (ordersData || [])
        .map(order => {
          const activeItems = (order.order_items || []).filter(
            i => i.kitchen_status === 'pending' || i.kitchen_status === 'preparing'
          )
          if (activeItems.length === 0) return null
          return {
            orderId: order.id,
            tableNumber: order.tables?.table_number,
            customerName: order.customer_name,
            specialInstructions: order.special_instructions,
            orderCreatedAt: order.created_at,
            items: activeItems.map(item => ({
              id: item.id,
              quantity: item.quantity,
              name: item.menu_items?.name,
              kitchenStatus: item.kitchen_status,
              createdAt: item.created_at,
            })),
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aEarliest = Math.min(...a.items.map(i => new Date(i.createdAt).getTime()))
          const bEarliest = Math.min(...b.items.map(i => new Date(i.createdAt).getTime()))
          return aEarliest - bEarliest
        })

      if (batches.length > prevCountRef.current) {
        playNotification()
      }
      prevCountRef.current = batches.length

      setKitchenBatches(batches)
    } catch (err) {
      console.error('Error fetching kitchen items:', err)
    } finally {
      setLoading(false)
    }
  }, [playNotification])

  useEffect(() => {
    fetchKitchenItems()

    const itemsChannel = supabase
      .channel('kitchen-order-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchKitchenItems)
      .subscribe()

    const ordersChannel = supabase
      .channel('kitchen-orders-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchKitchenItems)
      .subscribe()

    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)

    return () => {
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(ordersChannel)
      clearInterval(timer)
    }
  }, [fetchKitchenItems])

  const markBatchReady = async (batch) => {
    const itemIds = batch.items.map(i => i.id)
    const { error } = await supabase
      .from('order_items')
      .update({ kitchen_status: 'ready' })
      .in('id', itemIds)

    if (error) {
      console.error('Failed to mark batch ready:', error)
      return
    }
    setKitchenBatches(prev => prev.filter(b => b.orderId !== batch.orderId))
    prevCountRef.current = Math.max(0, prevCountRef.current - 1)
  }

  const acceptBatch = async (batch) => {
    const pendingIds = batch.items.filter(i => i.kitchenStatus === 'pending').map(i => i.id)
    if (pendingIds.length === 0) return

    const { error } = await supabase
      .from('order_items')
      .update({ kitchen_status: 'preparing' })
      .in('id', pendingIds)

    if (error) {
      console.error('Failed to accept batch:', error)
      return
    }
    setKitchenBatches(prev => prev.map(b => {
      if (b.orderId !== batch.orderId) return b
      return {
        ...b,
        items: b.items.map(i => pendingIds.includes(i.id) ? { ...i, kitchenStatus: 'preparing' } : i)
      }
    }))
  }

  const pendingCount = kitchenBatches.reduce((sum, b) => sum + b.items.filter(i => i.kitchenStatus === 'pending').length, 0)
  const preparingCount = kitchenBatches.reduce((sum, b) => sum + b.items.filter(i => i.kitchenStatus === 'preparing').length, 0)

  if (loading && kitchenBatches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
           <div className="w-16 h-16 border-4 border-slate-700 border-t-orange-500 rounded-full animate-spin mb-4"></div>
           <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">Syncing Kitchen Display...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 font-sans selection:bg-orange-500 selection:text-white">
      <div className="w-full">
        {/* PREMIUM TABLET OPTIMIZED HEADER */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl shadow-2xl mb-6 border border-slate-700/50 sticky top-4 z-40">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
               <i className="fa-solid fa-fire-burner text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-tight">Kitchen Hub</h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-700">
                  <div className={`w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'bg-slate-600'}`}></div>
                  {pendingCount} Pending
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 bg-slate-900/50 px-2 py-1 rounded-md border border-slate-700">
                  <div className={`w-2 h-2 rounded-full ${preparingCount > 0 ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`}></div>
                  {preparingCount} Preparing
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`px-5 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 border ${
              soundEnabled 
                ? 'bg-slate-900 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50 shadow-inner' 
                : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
            }`}
          >
            {soundEnabled ? <><i className="fa-solid fa-volume-high text-lg"></i> Alerts On</> : <><i className="fa-solid fa-volume-xmark text-lg"></i> Alerts Off</>}
          </button>
        </div>

        {/* KITCHEN GRID */}
        {kitchenBatches.length === 0 ? (
          <div className="text-center py-32 bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-700/50 mt-10">
            <div className="w-24 h-24 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-700/50">
              <i className="fa-solid fa-mug-hot text-5xl text-slate-600"></i>
            </div>
            <p className="text-3xl text-white font-black tracking-tight mb-2">Kitchen is clear</p>
            <p className="text-slate-500 font-semibold tracking-wide text-lg">Take a break. Awaiting new orders.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 auto-rows-max">
            {kitchenBatches.map((batch, index) => (
              <KitchenBatchCard
                key={batch.orderId}
                batch={batch}
                currentTime={currentTime}
                onAccept={() => acceptBatch(batch)}
                onMarkReady={() => markBatchReady(batch)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KitchenBatchCard({ batch, currentTime, onAccept, onMarkReady, index }) {
  const hasPending = batch.items.some(i => i.kitchenStatus === 'pending')
  const hasPreparing = batch.items.some(i => i.kitchenStatus === 'preparing')

  const orderCreatedMs = new Date(batch.orderCreatedAt).getTime()
  const hasNewItems = batch.items.some(i => {
    const itemCreatedMs = new Date(i.createdAt).getTime()
    return (itemCreatedMs - orderCreatedMs) > 60000
  })

  const earliestItemMs = Math.min(...batch.items.map(i => new Date(i.createdAt).getTime()))
  const elapsedMs = currentTime - earliestItemMs
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
  const timerText = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`

  let borderClass = 'border-yellow-500/50'
  let headerClass = 'bg-yellow-500'
  let shadowClass = 'shadow-[0_10px_30px_rgba(234,179,8,0.1)]'
  let labelIcon = <i className="fa-solid fa-bell"></i>
  let statusLabel = 'Incoming'
  
  const isUrgent = elapsedMinutes >= 15
  const isWarning = elapsedMinutes >= 10

  if (isUrgent) {
    borderClass = 'border-red-500 animate-ticker'
    headerClass = 'bg-red-600'
    shadowClass = 'shadow-[0_10px_40px_rgba(220,38,38,0.3)]'
    labelIcon = <i className="fa-solid fa-triangle-exclamation"></i>
    statusLabel = 'DELAYED!'
  } else if (isWarning) {
    borderClass = 'border-orange-500/80'
    headerClass = 'bg-orange-500'
    shadowClass = 'shadow-[0_10px_30px_rgba(249,115,22,0.2)]'
    labelIcon = <i className="fa-solid fa-clock"></i>
    statusLabel = 'Urgent'
  } else if (hasPreparing && !hasPending) {
    borderClass = 'border-blue-500/50'
    headerClass = 'bg-blue-500'
    shadowClass = 'shadow-[0_10px_30px_rgba(59,130,246,0.15)]'
    labelIcon = <i className="fa-solid fa-fire text-yellow-300"></i>
    statusLabel = 'Cooking'
  } else if (hasPending && hasPreparing) {
    statusLabel = 'Mixed'
  }

  return (
    <div className={`kitchen-card ${borderClass} ${shadowClass} animate-pop-in flex flex-col h-full`} style={{ animationDelay: (index * 50) + 'ms' }}>
      
      {/* HEADER: Massive contrast for distant readability */}
      <div className={`px-4 py-3 pb-4 flex justify-between items-start ${headerClass} text-slate-900 rounded-b-[2rem] shadow-sm relative z-10`}>
        <div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-black tracking-tighter leading-none">
              T{batch.tableNumber || '?'}
            </span>
            {hasNewItems && (
              <span className="text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white px-2.5 py-1 rounded-full shadow-lg shadow-black/20 animate-pulse relative -top-1">
                + Add On
              </span>
            )}
          </div>
          <div className="mt-2 text-xs font-bold font-mono tracking-widest uppercase opacity-80 flex items-center gap-1.5">
             <i className="fa-solid fa-user"></i> {batch.customerName || 'Walk-in'}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-slate-900 text-white font-mono text-3xl font-black tracking-wider px-3 py-1.5 rounded-xl border-b-4 border-slate-700/50 shadow-inner">
            {timerText}
          </div>
          <div className="text-[10px] uppercase font-black tracking-widest mt-2 bg-black/10 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-inner">
             {labelIcon} {statusLabel}
          </div>
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className="p-5 flex-grow bg-slate-800 -mt-6 pt-10">
        <ul className="space-y-4">
          {batch.items.map(item => {
            const isNew = (new Date(item.createdAt).getTime() - orderCreatedMs) > 60000
            const isCooking = item.kitchenStatus === 'preparing'
            return (
              <li key={item.id} className="flex gap-4 items-start pb-4 border-b border-slate-700/50 last:border-0 last:pb-0 group">
                <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-xl font-black shadow-inner border border-white/5 ${
                  isCooking ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {item.quantity}
                </div>
                <div className="flex-1 pt-1.5">
                  <div className="text-xl font-bold text-white leading-tight break-words">{item.name}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {isNew && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                        <i className="fa-solid fa-plus text-[8px]"></i> New
                      </span>
                    )}
                    {isCooking && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                        <i className="fa-solid fa-fire text-[8px]"></i> On Grill
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {batch.specialInstructions && (
          <div className="mt-5 p-4 bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl flex gap-3 shadow-inner">
            <i className="fa-solid fa-note-sticky text-orange-400 text-lg mt-0.5"></i>
            <div>
              <span className="block text-[10px] uppercase font-black text-orange-400 tracking-widest mb-1">Kitchen Note</span>
              <p className="text-orange-200 font-semibold text-sm leading-snug">{batch.specialInstructions}</p>
            </div>
          </div>
        )}
      </div>

      {/* ACTIONS (Huge tap targets for tablet) */}
      <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-3 z-10 w-full relative">
        {hasPending && (
          <button
            onClick={onAccept}
            className="flex-1 py-5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl font-black text-xl transition-all shadow-[0_5px_0_rgb(202,138,4)] active:translate-y-1 active:shadow-none uppercase tracking-wide flex justify-center items-center gap-2"
          >
            <i className="fa-solid fa-check"></i> Accept All
          </button>
        )}
        {hasPreparing && (
          <button
            onClick={onMarkReady}
            className="flex-1 py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-xl transition-all shadow-[0_5px_0_rgb(5,150,105)] active:translate-y-1 active:shadow-none uppercase tracking-wide flex justify-center items-center gap-2"
          >
            <i className="fa-solid fa-bell-concierge"></i> Ready
          </button>
        )}
        {hasPending && !hasPreparing && (
          <button
            onClick={onMarkReady}
            className="py-5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black text-sm transition-all border border-slate-700 active:scale-95 flex flex-col justify-center items-center leading-none"
            title="Skip to Ready"
          >
            <i className="fa-solid fa-forward-step mb-1"></i> Quick
          </button>
        )}
      </div>
    </div>
  )
}
