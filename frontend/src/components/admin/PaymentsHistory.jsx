import { useState } from 'react'

export default function PaymentsHistory({ payments, orders }) {
  const [filter, setFilter] = useState('all') // all, cash, upi, card

  // Join payments with orders data
  const enrichedPayments = payments.map(p => {
    const order = orders.find(o => o.id === p.order_id)
    return {
      ...p,
      orderAmount: order ? order.total_amount : 0,
      customerName: order ? order.customer_name : 'Unknown',
      tableNum: order?.tables?.table_number || 'N/A'
    }
  }).sort((a,b) => new Date(b.paid_at) - new Date(a.paid_at))

  const filteredData = filter === 'all' 
    ? enrichedPayments 
    : enrichedPayments.filter(p => p.payment_method === filter)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center glass p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><i className="fa-solid fa-money-check-dollar text-orange-500"></i> Payment History</h2>
          <p className="text-sm text-slate-500">View completed payments</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200/50">
          {['all', 'cash', 'upi', 'card'].map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                filter === m ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30 scale-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 scale-95'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto thin-scrollbar">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Order ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Table</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Method</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white/50 divide-y divide-slate-50">
              {filteredData.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-500">
                    {new Date(payment.paid_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-slate-400 uppercase">
                    {payment.order_id.substring(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="bg-slate-900 text-white font-black px-3 py-1 rounded-lg text-sm shadow-sm">T{payment.tableNum}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700 capitalize">
                    {payment.customerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-[10px] font-black uppercase tracking-widest rounded-md border
                      ${payment.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''}
                      ${payment.payment_method === 'upi' ? 'bg-purple-50 text-purple-600 border-purple-200' : ''}
                      ${payment.payment_method === 'card' ? 'bg-orange-50 text-orange-600 border-orange-200' : ''}
                    `}>
                      {payment.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-800 text-lg font-mono">
                    ₹{Number(payment.orderAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-400">
                    <i className="fa-solid fa-receipt text-4xl mb-3 opacity-50 block"></i>
                    <span className="font-bold text-sm tracking-wide">No payments found for the selected filter.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
