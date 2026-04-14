import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function OrderManager({ readyOrders, fetchOrders }) {
  const [processing, setProcessing] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState({})

  const processPayment = async (order) => {
    const method = paymentMethod[order.id] || 'cash'
    setProcessing(order.id)

    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order.id)

      if (orderError) throw orderError

      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          order_id: order.id,
          payment_method: method,
          payment_status: 'paid'
        }])

      if (paymentError) throw paymentError

      // Free the table
      if (order.table_id) {
        await supabase.from('tables').update({ status: 'free' }).eq('id', order.table_id)
      }

      fetchOrders()
    } catch (err) {
      console.error('Error processing payment:', err.message)
      alert('Failed to process payment')
    } finally {
      setProcessing(null)
    }
  }

  const printBill = (order) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) { alert('Please allow popups to print the bill.'); return }
    const html = `
      <html>
      <head><title>Bill - Table ${order.tables?.table_number}</title></head>
      <body style="font-family: monospace; width: 300px; margin: 0 auto; padding: 20px;">
        <h2 style="text-align: center;">THE GREAT BITES</h2>
        <p style="text-align: center;">Table ${order.tables?.table_number}</p>
        <hr/>
        <p>Customer: ${order.customer_name}</p>
        <p>Time: ${new Date(order.created_at).toLocaleString()}</p>
        <hr/>
        ${(order.order_items || []).map(it => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>${it.quantity}x ${it.menu_items?.name || 'Item'}</span>
            <span>₹${(Number(it.price) * Number(it.quantity)).toFixed(2)}</span>
          </div>
        `).join('')}
        <hr/>
        <h3 style="text-align: right;">Total: ₹${Number(order.total_amount).toFixed(2)}</h3>
        <p style="text-align: center; margin-top: 30px;">Thank You! Visit Again.</p>
      </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  const cancelOrder = async (orderId, tableId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return
    setProcessing(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
      if (error) throw error
      // Free the table
      if (tableId) {
        await supabase.from('tables').update({ status: 'free' }).eq('id', tableId)
      }
      fetchOrders()
    } catch (err) {
      console.error(err)
      alert('Failed to cancel order')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center glass p-5 rounded-2xl animate-slide-down">
        <h2 className="text-xl font-black flex items-center gap-3 text-slate-800">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-inner">
            <i className="fa-solid fa-bell-concierge transition-transform group-hover:scale-110"></i>
          </div>
          Active Orders <span className="bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-lg text-sm">{readyOrders.length}</span>
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Manage & Collect</p>
      </div>

      {readyOrders.length === 0 ? (
        <div className="glass border-2 border-dashed border-slate-200/50 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center animate-fade-scale">
          <i className="fa-solid fa-check-circle text-6xl text-slate-300 mb-6 block drop-shadow-sm"></i>
          <h3 className="text-2xl font-black text-slate-600 tracking-tight">All caught up</h3>
          <p className="font-semibold text-slate-400 mt-2">No active orders left unpaid.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
          {readyOrders.map((order, i) => (
            <div key={order.id} className="card-lifted overflow-hidden flex flex-col animate-slide-up bg-white/80 backdrop-blur-xl border-slate-200/60" style={{ animationDelay: (i * 50) + 'ms' }}>
              
              {/* Order Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">
                      T{order.tables?.table_number}
                    </span>
                    <span className="text-[10px] font-black font-mono uppercase tracking-widest text-slate-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h3 className="font-black text-lg text-slate-800 leading-tight capitalize">{order.customer_name}</h3>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-2xl font-black text-slate-900 tracking-tighter font-mono">₹{Number(order.total_amount).toFixed(0)}</p>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Total Due</p>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5 flex-grow bg-white">
                <div className="space-y-3 mb-6">
                  {order.order_items?.map(item => {
                    const ks = item.kitchen_status
                    const ksBadge = ks === 'ready'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : ks === 'preparing'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                    return (
                      <div key={item.id} className="flex justify-between items-start text-sm text-slate-700">
                        <span className="flex gap-3 items-center flex-1">
                          <span className="font-black bg-slate-100 w-6 h-6 flex items-center justify-center rounded-md text-xs shadow-inner shrink-0">{item.quantity}</span>
                          <span className="font-bold text-slate-800 line-clamp-1">{item.menu_items?.name}</span>
                        </span>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                           <span className="font-black text-slate-600 text-xs font-mono mb-1">₹{(Number(item.price)*item.quantity).toFixed(0)}</span>
                           {ks && <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm ${ksBadge}`}>{ks}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {order.special_instructions && (
                  <div className="bg-orange-50 p-3 border border-orange-100 rounded-xl flex gap-2 items-start mt-auto shadow-inner">
                    <i className="fa-solid fa-note-sticky text-orange-400 mt-1"></i>
                    <p className="text-xs font-bold text-orange-800 leading-snug">{order.special_instructions}</p>
                  </div>
                )}
              </div>

              {/* Payment Info & Controls */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Payment Type</label>
                  <div className="flex bg-slate-200/50 p-1 rounded-xl">
                    {['cash', 'upi', 'card'].map(m => {
                      const isSelected = (paymentMethod[order.id] || 'cash') === m
                      return (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod({ ...paymentMethod, [order.id]: m })}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            isSelected
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                          }`}
                        >
                          <span className="flex justify-center items-center gap-1.5">
                            {m === 'cash' && <i className="fa-solid fa-money-bill text-[10px]"></i>}
                            {m === 'upi' && <i className="fa-solid fa-mobile-screen text-[10px]"></i>}
                            {m === 'card' && <i className="fa-regular fa-credit-card text-[10px]"></i>}
                            {m}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => processPayment(order)}
                    disabled={processing === order.id}
                    className="flex-[2] btn-success !py-2.5 !text-sm"
                  >
                    {processing === order.id ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing</> : <><i className="fa-solid fa-bolt"></i> Mark Paid</>}
                  </button>
                  <button
                    onClick={() => printBill(order)}
                    className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors font-black text-xs active:scale-95 flex items-center justify-center shadow-sm"
                    title="Print Bill"
                  >
                    <i className="fa-solid fa-print"></i>
                  </button>
                  <button
                    onClick={() => cancelOrder(order.id, order.table_id)}
                    disabled={processing === order.id}
                    className="flex-1 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 hover:text-red-700 transition-colors font-black text-xs active:scale-95 flex items-center justify-center shadow-sm"
                    title="Cancel Order"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
