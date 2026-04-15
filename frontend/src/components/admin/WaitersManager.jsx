import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function WaitersManager() {
  const [waiters, setWaiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [formData, setFormData] = useState({ name: '', pass_code: '', is_active: true })

  const fetchWaiters = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('waiters').select('*').order('created_at', { ascending: false })
    if (error) console.error('Error fetching waiters', error)
    else setWaiters(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchWaiters()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.pass_code) {
      alert("Name and Pass/PIN Code are required.")
      return
    }
    
    if (editingId) {
      const { error } = await supabase.from('waiters').update(formData).eq('id', editingId)
      if (error) {
        alert("Error updating waiter: " + error.message)
      } else {
        setEditingId(null)
        setFormData({ name: '', pass_code: '', is_active: true })
        fetchWaiters()
      }
    } else {
      const { error } = await supabase.from('waiters').insert([formData])
      if (error) {
        alert("Error adding waiter (pass code must be unique): " + error.message)
      } else {
        setIsAdding(false)
        setFormData({ name: '', pass_code: '', is_active: true })
        fetchWaiters()
      }
    }
  }

  const handleEdit = (waiter) => {
    setFormData({ name: waiter.name, pass_code: waiter.pass_code, is_active: waiter.is_active })
    setEditingId(waiter.id)
    setIsAdding(false)
  }

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this waiter?")) {
      await supabase.from('waiters').delete().eq('id', id)
      fetchWaiters()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-xl font-bold text-slate-800"><i className="fa-solid fa-user-tie text-blue-600 mr-2"></i>Waiter Management</h2>
          <p className="text-sm text-slate-500">Manage your restaurant staff and PIN codes.</p>
        </div>
        <button 
          onClick={() => { setIsAdding(!isAdding); setEditingId(null); setFormData({ name: '', pass_code: '', is_active: true }) }}
          className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold transition shadow-md shadow-orange-600/30 whitespace-nowrap"
        >
          <i className="fa-solid fa-plus mr-2"></i> {editingId ? 'Add Waiter' : 'Add Waiter'}
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="fixed inset-0 z-50 flex justify-end pb-[env(safe-area-inset-bottom)]">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => {setIsAdding(false); setEditingId(null);}}></div>
          
          <div className="relative z-10 w-full md:w-[400px] h-full bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200 transform translate-x-full duration-300 ease-out fill-mode-forwards" style={{ animation: 'slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div className="flex justify-between items-center bg-white p-6 md:p-8 border-b border-slate-100 shrink-0">
              <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-user-tie"></i></div>
                {editingId ? 'Edit Waiter' : 'New Waiter'}
              </h3>
              <button type="button" onClick={() => {setIsAdding(false); setEditingId(null);}} className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-colors active:scale-90">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <form id="waiter-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Name *</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 rounded-2xl p-4 font-bold outline-none transition-all shadow-inner" 
                    placeholder="John Doe" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Pass Code (PIN) *</label>
                  <input 
                    type="text" 
                    value={formData.pass_code} 
                    onChange={(e) => setFormData({...formData, pass_code: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 rounded-2xl p-4 font-bold outline-none font-mono tracking-widest transition-all shadow-inner" 
                    placeholder="e.g. 1234" 
                    required 
                  />
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-white border-2 border-slate-100 rounded-2xl">
                    <input 
                      type="checkbox" 
                      checked={formData.is_active} 
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked})} 
                      className="w-5 h-5 text-orange-600 rounded" 
                    />
                    <span className="font-bold text-slate-700 cursor-pointer">Active Staff Member</span>
                  </label>
                </div>
              </form>
            </div>
            
            <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0">
              <button type="submit" form="waiter-form" className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-600/30 transition-transform active:scale-95">
                {editingId ? 'Update Waiter' : 'Save Waiter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-0">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading waiters...</div>
        ) : waiters.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">No waiters found. Click "+ Add Waiter" to create one.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Pass Code</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {waiters.map(w => (
                <tr key={w.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-semibold text-slate-800">{w.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${w.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">****{w.pass_code.slice(-2) || w.pass_code}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(w)} className="text-orange-600 hover:text-orange-800 px-3 py-1 font-semibold block sm:inline-block"><i className="fa-solid fa-pen"></i></button>
                    <button onClick={() => handleDelete(w.id)} className="text-red-500 hover:text-red-700 px-3 py-1 font-semibold ml-2 block sm:inline-block"><i className="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
