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
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
          <p className="text-sm text-gray-500">View completed payments</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['all', 'cash', 'upi', 'card'].map(m => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                filter === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(payment.paid_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {payment.order_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    T-{payment.tableNum}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {payment.customerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize
                      ${payment.payment_method === 'cash' ? 'bg-green-100 text-green-800' : ''}
                      ${payment.payment_method === 'upi' ? 'bg-purple-100 text-purple-800' : ''}
                      ${payment.payment_method === 'card' ? 'bg-blue-100 text-blue-800' : ''}
                    `}>
                      {payment.payment_method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    ₹{Number(payment.orderAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No payments found for the selected filter.
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
