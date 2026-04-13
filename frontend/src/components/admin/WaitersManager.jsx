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
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"
        >
          {isAdding || editingId ? 'Cancel' : '+ Add Waiter'}
        </button>
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="p-6 border-b border-slate-200 bg-blue-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="Name" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Pass Code (PIN)</label>
              <input 
                type="text" 
                value={formData.pass_code} 
                onChange={(e) => setFormData({...formData, pass_code: e.target.value})} 
                className="w-full border-slate-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500" 
                placeholder="e.g. 1234" 
                required 
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.is_active} 
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})} 
                  className="w-5 h-5 text-blue-600 rounded" 
                />
                <span className="font-semibold text-slate-700 cursor-pointer">Active Staff</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold">
              {editingId ? 'Update Waiter' : 'Save Waiter'}
            </button>
          </div>
        </form>
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
                    <button onClick={() => handleEdit(w)} className="text-blue-600 hover:text-blue-800 px-3 py-1 font-semibold"><i className="fa-solid fa-pen"></i></button>
                    <button onClick={() => handleDelete(w.id)} className="text-red-600 hover:text-red-800 px-3 py-1 font-semibold ml-2"><i className="fa-solid fa-trash"></i></button>
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
