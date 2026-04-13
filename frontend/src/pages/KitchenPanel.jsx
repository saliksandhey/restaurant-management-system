import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function KitchenPanel() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())

  const audioRef = useRef(null)

  // Use a generic beep sound (data URI) for notifications to avoid external asset dependency
  const beepSound = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'A'.repeat(100) // Dummy short base64 audio, realistically we can use an actual one, but let's use standard browser Audio Context

  const playNotification = () => {
    if (!soundEnabled) return
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.type = 'sine'
      oscillator.frequency.value = 800
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
      oscillator.start(audioCtx.currentTime)
      oscillator.stop(audioCtx.currentTime + 0.5)
    } catch (e) {
      console.warn('Audio play failed', e)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, status, created_at, ready_at, customer_name, special_instructions,
          tables(table_number),
          order_items(
            id, quantity,
            menu_items(name)
          )
        `)
        .in('status', ['pending', 'accepted', 'preparing', 'ready'])
        .order('created_at', { ascending: true })

      if (error) throw error
      
      setOrders(data || [])
    } catch (err) {
      console.error('Error fetching kitchen orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
            playNotification()
          }
          fetchOrders()
        }
      )
      .subscribe()

    // Timer sync every second
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)

    // Auto remove ready orders logic: checking if we need to manually prune
    // Actually, just relying on fetch is fine, but we can set a timer to periodically hide ready orders that have been ready for a while
    // Wait, the easiest way to "auto remove ready" is to just hide them from UI if their updated_at is > 30s ago. But we only have created_at in the DB schema.
    // Instead of querying `updated_at`, we can just capture the local time when it turns ready, or simply hide orders that are ready.
    // The prompt says "After marking "Ready", auto remove order after 30-60 seconds"

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [soundEnabled])

  const autoCompleteOrder = useCallback(async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId)
        .eq('status', 'ready') // Safety: only complete if still ready
      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== orderId))
      }
    } catch (err) {
      console.error('Auto-complete failed', err)
    }
  }, [])

  const updateStatus = async (orderId, newStatus) => {
    try {
      const updatePayload = { status: newStatus }

      // When marking ready, record the timestamp
      if (newStatus === 'ready') {
        updatePayload.ready_at = new Date().toISOString()
      }

      // Optimistic local update
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: newStatus, ready_at: updatePayload.ready_at || o.ready_at } : o
      ))

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)

      if (error) throw error

      // Start 5-minute auto-complete timer when marked ready
      if (newStatus === 'ready') {
        const FIVE_MIN_MS = 5 * 60 * 1000
        setTimeout(() => autoCompleteOrder(orderId), FIVE_MIN_MS)
      }
    } catch (err) {
      console.error('Failed to update status', err)
      fetchOrders() // revert optimistic update
    }
  }

  // Schedule auto-complete for any 'ready' orders that already exist when the page loads
  useEffect(() => {
    orders.forEach(order => {
      if (order.status === 'ready' && order.ready_at) {
        const readyTime = new Date(order.ready_at).getTime()
        const FIVE_MIN_MS = 5 * 60 * 1000
        const msUntilComplete = (readyTime + FIVE_MIN_MS) - Date.now()
        if (msUntilComplete > 0) {
          setTimeout(() => autoCompleteOrder(order.id), msUntilComplete)
        } else {
          // Already overdue – complete immediately
          autoCompleteOrder(order.id)
        }
      }
    })
  }, [orders.map(o => o.id + o.status).join(',')]) // only re-run when order ids/statuses change

  // Pre-process orders
  const sortedOrders = [...orders]
    // Filter out 'ready' orders that are older than some local state perhaps, but here we just handle it via the state updates.
    .sort((a, b) => {
      const priority = { pending: 1, accepted: 2, preparing: 2, ready: 3 }
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status]
      }
      return new Date(a.created_at) - new Date(b.created_at)
    })

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 font-sans">
      <style>{`
        .ready-fade-out {
          animation: fadeRemove 30s forwards;
        }
        @keyframes fadeRemove {
          0% { opacity: 1; transform: scale(1); }
          90% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); visibility: hidden; position: absolute; }
        }
      `}</style>
      
      <div className="max-w-[1600px] mx-auto">
        {/* Top Navbar */}
        <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow-md mb-6 border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <i className="fa-solid fa-fire-burner text-orange-500"></i> Kitchen Display System
            </h1>
            <p className="text-sm text-slate-400 mt-1">Real-time Order Workflow</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm font-semibold mr-4">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Pending</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Preparing</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Ready</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Delayed</span>
            </div>

            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 ${soundEnabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              {soundEnabled ? <><i className="fa-solid fa-volume-high"></i> Sound ON</> : <><i className="fa-solid fa-volume-xmark"></i> Sound OFF</>}
            </button>
          </div>
        </div>

        {/* Orders Grid */}
        {sortedOrders.length === 0 ? (
          <div className="text-center py-20 bg-slate-800 rounded-xl border border-slate-700 border-dashed">
            <p className="text-2xl text-slate-500 font-bold">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
            {sortedOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                currentTime={currentTime}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderCard({ order, currentTime, onUpdateStatus }) {
  const orderTimeMs = new Date(order.created_at).getTime()
  const elapsedMs = currentTime - orderTimeMs
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)

  // Countdown for ready → completed
  let countdownText = null
  if (order.status === 'ready' && order.ready_at) {
    const readyMs = new Date(order.ready_at).getTime()
    const FIVE_MIN_MS = 5 * 60 * 1000
    const msLeft = (readyMs + FIVE_MIN_MS) - currentTime
    if (msLeft > 0) {
      const minLeft = Math.floor(msLeft / 60000)
      const secLeft = Math.floor((msLeft % 60000) / 1000)
      countdownText = `Auto-complete in ${minLeft}:${secLeft.toString().padStart(2, '0')}`
    } else {
      countdownText = 'Completing...'
    }
  }

  // Color coding logic based on UX rules
  let statusColorClass = 'border-slate-600 bg-slate-800'
  let headerColorClass = 'bg-slate-700 text-white'
  let badgeColorClass = 'bg-slate-600 text-slate-200'

  if (order.status === 'pending') {
    statusColorClass = 'border-yellow-500 bg-slate-800'
    headerColorClass = 'bg-yellow-500 text-slate-900'
    badgeColorClass = 'bg-yellow-400 text-slate-900'
    if (elapsedMinutes >= 15) {
      statusColorClass = 'border-red-500 bg-red-900/20'
      headerColorClass = 'bg-red-500 text-white'
      badgeColorClass = 'bg-red-500 text-white'
    } else if (elapsedMinutes >= 10) {
      statusColorClass = 'border-orange-500 bg-orange-900/20'
      headerColorClass = 'bg-orange-500 text-white'
      badgeColorClass = 'bg-orange-500 text-white'
    }
  } else if (order.status === 'preparing' || order.status === 'accepted') {
    statusColorClass = 'border-blue-500 bg-slate-800'
    headerColorClass = 'bg-blue-600 text-white'
    badgeColorClass = 'bg-blue-500 text-white'
    if (elapsedMinutes >= 15) {
      statusColorClass = 'border-red-500 bg-red-900/20'
      headerColorClass = 'bg-red-600 text-white'
      badgeColorClass = 'bg-red-500 text-white'
    } else if (elapsedMinutes >= 10) {
      statusColorClass = 'border-orange-500 bg-orange-900/20'
      headerColorClass = 'bg-orange-600 text-white'
      badgeColorClass = 'bg-orange-500 text-white'
    }
  } else if (order.status === 'ready') {
    statusColorClass = 'border-green-500 bg-slate-800 opacity-80'
    headerColorClass = 'bg-green-600 text-white'
    badgeColorClass = 'bg-green-500 text-white'
  }

  // Format timer
  const timerText = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`

  return (
    <div id={`order-${order.id}`} className={`rounded-xl border-2 overflow-hidden shadow-lg flex flex-col transition-all duration-300 ${statusColorClass}`}>
      {/* Card Header */}
      <div className={`p-3 flex justify-between items-center ${headerColorClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black">
            T-{order.tables?.table_number || '?'}
          </span>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold tracking-wider">{timerText}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-80">
            {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>

      <div className="px-3 py-1 bg-slate-900 flex justify-between items-center text-xs border-b border-inherit">
        <span className="font-semibold text-slate-300 truncate max-w-[140px]">{order.customer_name}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${badgeColorClass}`}>
          {order.status}
        </span>
      </div>

      {/* Items List */}
      <div className="p-4 flex-grow bg-slate-800">
        <ul className="space-y-3">
          {order.order_items?.map(item => (
            <li key={item.id} className="flex justify-between items-start text-lg">
              <span className="font-bold text-white mr-3 whitespace-nowrap">
                {item.quantity} x
              </span>
              <span className="text-slate-200 flex-grow leading-tight">
                {item.menu_items?.name}
              </span>
            </li>
          ))}
        </ul>

        {order.special_instructions && (
          <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-300 font-medium text-sm">
            <span className="block text-xs uppercase font-bold text-yellow-500 mb-1"><i className="fa-solid fa-note-sticky"></i> Instructions:</span>
            {order.special_instructions}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
        {order.status === 'pending' && (
          <>
            <button 
              onClick={() => onUpdateStatus(order.id, 'cancelled')}
              className="px-4 py-3 bg-slate-700 hover:bg-red-600 text-white rounded font-bold transition-colors w-1/3 text-sm"
            >
              Reject
            </button>
            <button 
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded font-black text-lg transition-colors"
            >
              ACCEPT
            </button>
          </>
        )}
        
        {(order.status === 'accepted' || order.status === 'preparing') && (
          <button 
            onClick={() => onUpdateStatus(order.id, 'ready')}
            className="w-full py-4 bg-blue-600 hover:bg-green-500 text-white rounded-lg font-black text-xl transition-all uppercase tracking-wider relative overflow-hidden shadow-[0_0_15px_rgba(37,99,235,0.4)]"
          >
            Mark as Ready
          </button>
        )}

        {order.status === 'ready' && (
          <div className="w-full flex flex-col items-center gap-1 py-3 text-green-500 font-bold uppercase tracking-widest text-sm bg-slate-800/50 rounded border border-green-500/20">
            <span><i className="fa-solid fa-circle-check mr-1"></i>Order Ready</span>
            {countdownText && (
              <span className="text-[10px] text-slate-400 font-mono normal-case tracking-normal">
                <i className="fa-regular fa-clock mr-1"></i>{countdownText}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
