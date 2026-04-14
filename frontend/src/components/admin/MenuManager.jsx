import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function MenuManager() {
  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modals state
  const [isEditing, setIsEditing] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  
  // Item Form state
  const [formData, setFormData] = useState({ id: null, name: '', price: '', category: '', image_url: '', is_available: true })
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Category Form state
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCategoryLoading, setIsCategoryLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [itemsRes, catRes] = await Promise.all([
        supabase.from('menu_items').select('*').order('category'),
        supabase.from('menu_categories').select('*').order('name')
      ])

      if (itemsRes.error) throw itemsRes.error
      if (catRes.error && catRes.error.code !== '42P01') throw catRes.error

      setMenuItems(itemsRes.data || [])
      setCategories(catRes.data || [])
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- ITEM MANAGEMENT ---
  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!formData.category) return alert('Please select a category.')
    
    setIsUploading(true)
    try {
      let finalImageUrl = formData.image_url

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `public/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath)

        finalImageUrl = publicUrl
      }

      const payload = {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        image_url: finalImageUrl,
        is_available: formData.is_available
      }

      if (formData.id) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', formData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('menu_items').insert([payload])
        if (error) throw error
      }
      
      setIsEditing(false)
      setSelectedFile(null)
      fetchData()
    } catch (err) {
      alert('Error saving menu item: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      alert('Error deleting menu item: ' + err.message)
    }
  }

  const toggleAvailability = async (id, currentStatus) => {
    try {
      const { error } = await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id)
      if (error) throw error
      setMenuItems(prev => prev.map(item => item.id === id ? { ...item, is_available: !currentStatus } : item))
    } catch (err) {
      console.error(err)
    }
  }

  const openForm = (item = null) => {
    if (item) {
      setFormData({ ...item })
    } else {
      setFormData({ 
        id: null, 
        name: '', 
        price: '', 
        category: categories.length > 0 ? categories[0].name : '', 
        image_url: '', 
        is_available: true 
      })
    }
    setSelectedFile(null)
    setIsEditing(true)
  }

  // --- CATEGORY MANAGEMENT ---
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setIsCategoryLoading(true)
    try {
      const { error } = await supabase.from('menu_categories').insert([{ name: newCategoryName.trim() }])
      if (error) {
        if (error.code === '23505') throw new Error('Category already exists.')
        if (error.code === '42P01') throw new Error('Database table "menu_categories" not found. Please run the SQL migration first.')
        throw error
      }
      setNewCategoryName('')
      await fetchData() // refresh
    } catch (err) {
      alert(err.message)
    } finally {
      setIsCategoryLoading(false)
    }
  }

  const handleDeleteCategory = async (id, name) => {
    const inUse = menuItems.some(i => i.category === name)
    if (inUse) return alert(`Cannot delete "${name}" because it is currently used by active menu items. Reassign those items first.`)
    
    if (!window.confirm(`Delete category "${name}"?`)) return
    
    try {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      alert('Error deleting category: ' + err.message)
    }
  }

  const displayCategories = categories.length > 0 
    ? categories.map(c => c.name) 
    : [...new Set(menuItems.map(item => item.category))]

  // Animation constants for staggered lists
  const getDelay = (idx) => (idx * 50) + 'ms'

  return (
    <div className="space-y-8 pb-10 max-w-[1400px] mx-auto">
      
      {/* HEADER SECTION (GLASS) */}
      <div className="glass p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-slide-down">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30 border border-white/20 shrink-0">
             <i className="fa-solid fa-layer-group text-2xl"></i>
           </div>
           <div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Menu Catalog</h2>
             <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Manage Categories & Items</p>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex-1 md:flex-none btn-secondary bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-700 !py-3 !px-5 rounded-xl uppercase tracking-wide text-xs"
          >
            <i className="fa-solid fa-tags mr-1"></i> Categories
          </button>
          <button 
            onClick={() => openForm()}
            className="flex-1 md:flex-none btn-primary !py-3 !px-6 rounded-xl uppercase tracking-wide text-xs shadow-lg shadow-orange-500/20"
          >
            <i className="fa-solid fa-plus mr-1"></i> Add Item
          </button>
        </div>
      </div>

      {/* ITEMS LISTING BY CATEGORY */}
      {loading ? (
        <div className="flex justify-center py-32 animate-pulse">
           <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mb-4 shadow-sm"></div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Syncing Catalog...</p>
           </div>
        </div>
      ) : (
        <div className="space-y-12 stagger">
          {displayCategories.map((category, idx) => {
            const itemsInCategory = menuItems.filter(item => item.category === category)
            if (itemsInCategory.length === 0 && displayCategories.length > 0) return null

            return (
              <div key={category} className="animate-slide-up" style={{ animationDelay: getDelay(idx) }}>
                
                {/* Category Header */}
                <div className="flex items-center gap-4 mb-6 px-2">
                   <h3 className="text-3xl font-black text-slate-800 tracking-tighter capitalize flex-shrink-0">
                     {category}
                   </h3>
                   <div className="h-px bg-slate-200 w-full flex-1 mt-1"></div>
                   <span className="text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-lg text-xs tracking-widest uppercase">
                     {itemsInCategory.length} {itemsInCategory.length === 1 ? 'Item' : 'Items'}
                   </span>
                </div>
                
                {/* Responsive Grid Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {itemsInCategory.map((item, itemIdx) => (
                    <div 
                      key={item.id} 
                      className={`card-base flex flex-col p-4 rounded-3xl transition-all duration-300 relative group
                         ${item.is_available 
                           ? 'hover:-translate-y-1 hover:shadow-xl hover:border-slate-300' 
                           : 'border-red-100 bg-red-50/30 grayscale-[50%] opacity-80'}`}
                      style={{ animationDelay: getDelay(itemIdx) }}
                    >
                      
                      {/* Image header */}
                      <div className="w-full aspect-[4/3] rounded-2xl bg-slate-50 border border-slate-100 mb-5 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700 ease-out" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center text-slate-400">
                             <i className="fa-solid fa-camera text-3xl mb-2 opacity-50"></i>
                             <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">No Image</span>
                          </div>
                        )}
                        {!item.is_available && (
                          <div className="absolute inset-0 bg-red-900/10 backdrop-blur-[2px] flex items-center justify-center">
                             <span className="bg-red-500 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg rotate-[-5deg]">Out of Stock</span>
                          </div>
                        )}
                        {/* Price Badge Overlay (Top Right) */}
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow-sm border border-slate-100 px-3 py-1 rounded-full text-slate-900 font-black font-mono text-sm z-10 transition-transform group-hover:scale-105">
                           ₹{Number(item.price).toFixed(2)}
                        </div>
                      </div>

                      {/* Info & Details */}
                      <div className="flex-grow flex flex-col justify-between px-1">
                        <div className="mb-4">
                          <h4 className="font-black text-slate-800 line-clamp-2 leading-tight text-lg mb-1 group-hover:text-orange-600 transition-colors">{item.name}</h4>
                          <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full inline-block ${item.is_available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                              {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-auto border-t border-slate-100 pt-4 border-dashed">
                          <button onClick={() => toggleAvailability(item.id, item.is_available)} className={`flex-[2] py-2 rounded-xl flex justify-center items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${item.is_available ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 active:scale-95'}`} title="Toggle Availability">
                            {item.is_available ? <><i className="fa-solid fa-pause"></i> Hide Item</> : <><i className="fa-solid fa-play"></i> Reactivate</>}
                          </button>
                          
                          <button onClick={() => openForm(item)} className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex justify-center items-center transition-all hover:bg-blue-100 active:scale-90" title="Edit Item">
                            <i className="fa-solid fa-pen text-[11px]"></i>
                          </button>
                          
                          <button onClick={() => handleDeleteItem(item.id)} className="w-10 h-10 shrink-0 rounded-xl bg-red-50 text-red-500 flex justify-center items-center transition-all hover:bg-red-100 active:scale-90" title="Delete Item">
                            <i className="fa-solid fa-trash text-[11px]"></i>
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          
          {menuItems.length === 0 && displayCategories.length === 0 && (
            <div className="text-center py-24 glass rounded-[3rem] border-dashed border-2 border-slate-200/50 flex flex-col items-center justify-center animate-pop-in">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 mb-6 rotate-3">
                 <i className="fa-solid fa-box-open text-5xl text-slate-300 -rotate-3"></i>
              </div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Empty Catalog</h3>
              <p className="text-slate-500 font-semibold mt-2 max-w-sm leading-relaxed mb-8">Your restaurant menu is currently empty. Start by creating categories and adding your signature dishes.</p>
              <button onClick={() => openForm()} className="btn-primary !px-8 !py-4 text-base shadow-xl shadow-orange-500/20">
                 <i className="fa-solid fa-plus"></i> Add First Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------- */}
      {/* ITEM FORM MODAL (PREMIUM PREMIUM) */}
      {/* ---------------------------------- */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto animate-fade-scale">
          <div className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] max-w-2xl w-full p-8 md:p-10 my-8 relative border border-white">
            
            <button onClick={() => setIsEditing(false)} className="absolute top-6 right-6 w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="mb-8">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                 {formData.id ? 'Edit Item' : 'New Dish'} <span className="text-3xl opacity-80">{formData.id ? '✍️' : '✨'}</span>
               </h3>
               <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">Item Configuration</p>
            </div>
            
            <form onSubmit={handleSaveItem} className="space-y-6">
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-2">Item Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 border-2 border-white rounded-2xl font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner bg-white" placeholder="e.g. Signature Truffle Burger" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-2">Pricing (₹)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                      <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full pl-10 pr-5 py-4 border-2 border-white rounded-2xl font-black font-mono text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner bg-white" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-2">Category Assignment</label>
                    <div className="relative">
                      <select 
                        required 
                        value={formData.category} 
                        onChange={e => setFormData({...formData, category: e.target.value})} 
                        className="w-full px-5 py-4 border-2 border-white rounded-2xl font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner bg-white appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Choose...</option>
                        {displayCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 transition-colors rounded-3xl p-6 bg-white relative overflow-hidden align-middle">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 text-center">Photography (Optional)</label>
                
                {formData.image_url && !selectedFile && (
                  <div className="mb-5 relative group max-w-[200px] mx-auto rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                    <img src={formData.image_url} alt="Current" className="w-full aspect-square object-cover bg-slate-50" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="bg-red-500 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center active:scale-90">
                         <i className="fa-solid fa-trash text-sm"></i>
                       </button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center">
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    onChange={e => setSelectedFile(e.target.files[0])} 
                    className="text-sm font-semibold text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:uppercase file:font-black file:tracking-widest file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 file:transition-colors cursor-pointer file:cursor-pointer p-1 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner w-full sm:w-auto" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm cursor-pointer select-none group" onClick={() => setFormData({...formData, is_available: !formData.is_available})}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${formData.is_available ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200 group-hover:border-slate-300'}`}>
                  {formData.is_available && <i className="fa-solid fa-check text-white text-xs"></i>}
                </div>
                <div>
                  <span className="block text-sm font-black text-slate-800">Available for Ordering</span>
                  <span className="block text-xs font-semibold text-slate-400">Customers can see and add this to cart.</span>
                </div>
              </div>
              
              <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
                <button type="button" disabled={isUploading} onClick={() => setIsEditing(false)} className="flex-[1] btn-secondary !py-4 !rounded-2xl">Cancel</button>
                <button type="submit" disabled={isUploading} className="flex-[2] btn-primary !py-4 !rounded-2xl text-lg shadow-[0_10px_20px_rgba(249,115,22,0.2)]">
                  {isUploading ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Uploading & Saving</> : <><i className="fa-solid fa-check-double"></i> Finalize Details</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------- */}
      {/* CATEGORY MANAGER MODAL (PREMIUM)   */}
      {/* ---------------------------------- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-scale">
          <div className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] max-w-md w-full p-8 md:p-10 my-8 relative">
            <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors active:scale-95">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="mb-8">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner text-base"><i className="fa-solid fa-tags"></i></div>
                 Taxonomy
              </h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">Organize Application Categories</p>
            </div>
            
            <form onSubmit={handleAddCategory} className="flex gap-3 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-800 transition-all shadow-sm" 
                placeholder="New Category..." 
                required
              />
              <button 
                type="submit" 
                disabled={isCategoryLoading} 
                className="bg-blue-600 text-white px-6 rounded-xl font-black disabled:opacity-50 hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-600/20"
              >
                {isCategoryLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
              </button>
            </form>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto thin-scrollbar pr-2 pb-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2 mb-4">Existing Records</h4>
              {categories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="font-semibold text-sm">No structured categories yet.</p>
                  <p className="text-[11px] mt-1 opacity-70 px-4">Type above to establish your first database category.</p>
                </div>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm hover:border-slate-300 transition-all group">
                    <span className="font-bold text-slate-800 text-sm ml-2 tracking-wide uppercase">{cat.name}</span>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 opacity-50 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 flex items-center justify-center font-black active:scale-90"
                      title="Delete category"
                    >
                      <i className="fa-solid fa-trash text-[11px]"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
