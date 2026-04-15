import { useState, useEffect } from 'react'

export default function DashboardView({ orders, payments }) {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrdersToday: 0,
    pendingPayments: 0,
    completedOrders: 0,
    liveOrdersCount: 0
  })

  const [salesData, setSalesData] = useState([])

  useEffect(() => {
    if (!orders || !payments) return

    const today = new Date().toDateString()
    
    // Calculate stats
    let totalRev = 0
    let todayOrdersCount = 0
    let pendingCount = 0
    let completedCount = 0
    let liveCount = 0

    const dailyRevMap = {}

    orders.forEach(order => {
      const orderDateStr = new Date(order.created_at).toDateString()
      if (orderDateStr === today) {
        todayOrdersCount++
        if (order.status === 'ready') pendingCount++
        if (['pending', 'accepted', 'preparing'].includes(order.status)) liveCount++
      }

      const dateKey = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!dailyRevMap[dateKey]) {
        dailyRevMap[dateKey] = { date: dateKey, revenue: 0, orders: 0 }
      }
      dailyRevMap[dateKey].orders++
    })

    payments.forEach(payment => {
      const paymentDateStr = new Date(payment.paid_at).toDateString()
      if (paymentDateStr === today) {
        const orderAmt = orders.find(o => o.id === payment.order_id)?.total_amount || 0
        totalRev += Number(orderAmt)
        completedCount++
      }
      
      const pDateKey = new Date(payment.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (dailyRevMap[pDateKey]) {
        const amt = orders.find(o => o.id === payment.order_id)?.total_amount || 0
        dailyRevMap[pDateKey].revenue += Number(amt)
      }
    })

    setStats({
      totalRevenue: totalRev,
      totalOrdersToday: todayOrdersCount,
      pendingPayments: pendingCount, 
      completedOrders: completedCount, 
      liveOrdersCount: liveCount
    })

    const sortedChartData = Object.values(dailyRevMap).sort((a,b) => new Date(a.date) - new Date(b.date))
    setSalesData(sortedChartData.slice(-7))

  }, [orders, payments])

  const maxRevenue = Math.max(...salesData.map(d => d.revenue), 1)
  const maxOrders = Math.max(...salesData.map(d => d.orders), 1)

  return (
    <div className="space-y-8 animate-in fade-in duration-500 fill-mode-both">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue (Today)" 
          value={`₹${stats.totalRevenue.toFixed(2)}`} 
          icon={<i className="fa-solid fa-money-bill-trend-up"></i>}
          colorClass="text-orange-600"
          bgClass="bg-orange-50"
        />
        <StatCard 
          title="Orders Today" 
          value={stats.totalOrdersToday} 
          icon={<i className="fa-solid fa-chart-simple"></i>}
          colorClass="text-yellow-600"
          bgClass="bg-yellow-50" 
        />
        <StatCard 
          title="Pending Payments" 
          value={stats.pendingPayments} 
          icon={<i className="fa-solid fa-hourglass-half"></i>}
          colorClass="text-red-500"
          bgClass="bg-red-50" 
        />
        <StatCard 
          title="Completed Orders" 
          value={stats.completedOrders} 
          icon={<i className="fa-solid fa-cloud-check"></i>}
          colorClass="text-orange-500"
          bgClass="bg-orange-100" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="glass p-8 rounded-[2rem]">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-black text-slate-800 tracking-tight">Sales Revenue</h3>
             <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">Last 7 Days</span>
          </div>
          
          <div className="space-y-4">
            {salesData.map((data, i) => (
              <div key={i} className="flex items-center group">
                <span className="w-16 text-xs font-black uppercase text-slate-400 group-hover:text-slate-700 transition-colors tracking-widest">{data.date}</span>
                <div className="flex-1 mx-4 h-5 bg-slate-100/50 border border-slate-200 rounded-full overflow-hidden shadow-inner flex">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-orange-400 to-orange-500 opacity-90 group-hover:opacity-100 relative" 
                    style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-1/2 rounded-full blur-[2px]"></div>
                  </div>
                </div>
                <span className="w-20 text-right font-black text-slate-700 text-lg group-hover:scale-105 transition-transform origin-right font-mono">₹{data.revenue.toFixed(0)}</span>
              </div>
            ))}
            {salesData.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <i className="fa-solid fa-chart-line text-3xl mb-3 opacity-50"></i>
                <p className="font-semibold text-sm">Waiting for incoming sales tracking...</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem]">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-black text-slate-800 tracking-tight">Order Volume</h3>
             <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">Last 7 Days</span>
          </div>

          <div className="space-y-4">
            {salesData.map((data, i) => (
              <div key={i} className="flex items-center group">
                <span className="w-16 text-xs font-black uppercase text-slate-400 group-hover:text-slate-700 transition-colors tracking-widest">{data.date}</span>
                <div className="flex-1 mx-4 h-5 bg-slate-100/50 border border-slate-200 rounded-full overflow-hidden shadow-inner flex">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-yellow-400 to-orange-400 opacity-90 group-hover:opacity-100 relative" 
                    style={{ width: `${(data.orders / maxOrders) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-1/2 rounded-full blur-[2px]"></div>
                  </div>
                </div>
                <span className="w-16 text-right font-black text-slate-700 text-lg group-hover:scale-105 transition-transform origin-right font-mono">{data.orders}</span>
              </div>
            ))}
            {salesData.length === 0 && (
               <div className="py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                 <i className="fa-solid fa-basket-shopping text-3xl mb-3 opacity-50"></i>
                 <p className="font-semibold text-sm">Awaiting order traffic tracking...</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, colorClass, bgClass }) {
  return (
    <div className="glass p-6 rounded-[2rem] flex items-center gap-5 group hover:shadow-[0_15px_40px_rgb(0,0,0,0.08)] transition-all duration-300 transform hover:-translate-y-1 cursor-default">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/50 ${colorClass} ${bgClass} group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <div>
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{title}</h4>
        <p className="text-3xl font-black text-slate-800 tracking-tight font-mono">{value}</p>
      </div>
    </div>
  )
}
