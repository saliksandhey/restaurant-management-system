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

      fetchOrders()
    } catch (err) {
      console.error('Error processing payment:', err.message)
      alert('Failed to process payment')
    } finally {
      setProcessing(null)
    }
  }

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return
    setProcessing(orderId)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
      if (error) throw error
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
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <i className="fa-solid fa-bell-concierge text-green-500"></i> Ready Orders ({readyOrders.length})
        </h2>
        <p className="text-sm text-gray-500">Orders waiting for payment</p>
      </div>

      {readyOrders.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-500">
          No ready orders waiting for payment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {readyOrders.map(order => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden flex flex-col">
              <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                      Table {order.tables?.table_number}
                    </span>
                    <span className="text-sm font-medium text-gray-600">{new Date(order.created_at).toLocaleTimeString()}</span>
                  </div>
                  <h3 className="font-bold text-lg mt-1 text-gray-900">{order.customer_name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-700">₹{Number(order.total_amount).toFixed(2)}</p>
                </div>
              </div>

              <div className="p-4 flex-grow">
                <div className="space-y-2 mb-4">
                  {order.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-700">
                      <span className="flex gap-2">
                        <span className="font-medium">{item.quantity}x</span>
                        <span className="truncate max-w-[150px]">{item.menu_items?.name}</span>
                      </span>
                      <span className="text-gray-500">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {order.special_instructions && (
                  <div className="bg-amber-50 p-2 border border-amber-100 rounded text-sm text-amber-800 mb-4">
                    <strong>Note:</strong> {order.special_instructions}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['cash', 'upi', 'card'].map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod({ ...paymentMethod, [order.id]: m })}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-sm font-medium transition-colors ${
                          (paymentMethod[order.id] || 'cash') === m 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <span className="capitalize flex items-center gap-2">
                          {m === 'cash' && <i className="fa-solid fa-money-bill"></i>}
                          {m === 'upi' && <i className="fa-solid fa-mobile-screen"></i>}
                          {m === 'card' && <i className="fa-regular fa-credit-card"></i>}
                          {m}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => processPayment(order)}
                    disabled={processing === order.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing === order.id ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Processing...</> : <><i className="fa-solid fa-check"></i> Mark Paid</>}
                  </button>
                  <button
                    onClick={() => cancelOrder(order.id)}
                    disabled={processing === order.id}
                    className="px-3 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors font-medium text-sm"
                    title="Cancel Order"
                  >
                    <i className="fa-solid fa-xmark"></i> Cancel
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
