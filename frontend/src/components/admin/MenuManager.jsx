import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Drawer — renders into document.body via Portal
// This guarantees it is NEVER trapped inside any parent layout/overflow/transform
// ─────────────────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Sliding Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl rounded-l-2xl flex flex-col
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MenuManager
// ─────────────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const [menuItems, setMenuItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Drawer open states
  const [isItemOpen, setIsItemOpen] = useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)

  // Item form
  const [formData, setFormData] = useState({ id: null, name: '', price: '', category: '', image_url: '', is_available: true })
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCategoryLoading, setIsCategoryLoading] = useState(false)

  useEffect(() => { fetchData() }, [])

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

  // ── Item actions ────────────────────────────────────────────────────────────
  const openItemDrawer = (item = null) => {
    if (item) {
      setFormData({ ...item })
      setPreviewUrl(item.image_url || null)
    } else {
      setFormData({ id: null, name: '', price: '', category: categories.length > 0 ? categories[0].name : '', image_url: '', is_available: true })
      setPreviewUrl(null)
    }
    setSelectedFile(null)
    setIsItemOpen(true)
  }

  const closeItemDrawer = () => {
    setIsItemOpen(false)
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

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
        const { error: upErr } = await supabase.storage.from('menu-images').upload(filePath, selectedFile)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(filePath)
        finalImageUrl = publicUrl
      }
      const payload = { name: formData.name, price: parseFloat(formData.price), category: formData.category, image_url: finalImageUrl, is_available: formData.is_available }
      if (formData.id) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', formData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('menu_items').insert([payload])
        if (error) throw error
      }
      closeItemDrawer()
      fetchData()
    } catch (err) {
      alert('Error saving item: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this menu item?')) return
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) return alert('Error: ' + error.message)
    fetchData()
  }

  const toggleAvailability = async (id, current) => {
    const { error } = await supabase.from('menu_items').update({ is_available: !current }).eq('id', id)
    if (error) return console.error(error)
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, is_available: !current } : item))
  }

  // ── Category actions ────────────────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setIsCategoryLoading(true)
    try {
      const { error } = await supabase.from('menu_categories').insert([{ name: newCategoryName.trim() }])
      if (error) {
        if (error.code === '23505') throw new Error('Category already exists.')
        if (error.code === '42P01') throw new Error('Table not found. Run migration first.')
        throw error
      }
      setNewCategoryName('')
      await fetchData()
    } catch (err) {
      alert(err.message)
    } finally {
      setIsCategoryLoading(false)
    }
  }

  const handleDeleteCategory = async (id, name) => {
    if (menuItems.some(i => i.category === name)) return alert(`"${name}" is used by active items. Reassign first.`)
    if (!window.confirm(`Delete category "${name}"?`)) return
    const { error } = await supabase.from('menu_categories').delete().eq('id', id)
    if (error) return alert('Error: ' + error.message)
    fetchData()
  }

  const displayCategories = categories.length > 0
    ? categories.map(c => c.name)
    : [...new Set(menuItems.map(i => i.category))]

  const delay = (idx) => `${idx * 50}ms`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-10 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="glass p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-slide-down">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30 border border-white/20 shrink-0">
            <i className="fa-solid fa-layer-group text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Menu Catalog</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Manage Categories &amp; Items</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={() => setIsCategoryOpen(true)}
            className="flex-1 md:flex-none btn-secondary bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-700 !py-3 !px-5 rounded-xl uppercase tracking-wide text-xs"
          >
            <i className="fa-solid fa-tags mr-1.5"></i> Categories
          </button>
          <button
            onClick={() => openItemDrawer()}
            className="flex-1 md:flex-none btn-primary !py-3 !px-6 rounded-xl uppercase tracking-wide text-xs shadow-lg shadow-orange-500/20"
          >
            <i className="fa-solid fa-plus mr-1.5"></i> Add Item
          </button>
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center py-32">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Syncing Catalog...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-12 stagger">
          {displayCategories.map((category, idx) => {
            const items = menuItems.filter(i => i.category === category)
            if (items.length === 0) return null
            return (
              <div key={category} className="animate-slide-up" style={{ animationDelay: delay(idx) }}>
                <div className="flex items-center gap-4 mb-6 px-2">
                  <h3 className="text-3xl font-black text-slate-800 tracking-tighter capitalize flex-shrink-0">{category}</h3>
                  <div className="h-px bg-slate-200 w-full flex-1 mt-1"></div>
                  <span className="text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-lg text-xs tracking-widest uppercase">
                    {items.length} {items.length === 1 ? 'Item' : 'Items'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((item, iIdx) => (
                    <div
                      key={item.id}
                      className={`card-base flex flex-col p-4 rounded-3xl transition-all duration-300 relative group ${item.is_available ? 'hover:-translate-y-1 hover:shadow-xl hover:border-slate-300' : 'border-red-100 bg-red-50/30 grayscale-[50%] opacity-80'}`}
                      style={{ animationDelay: delay(iIdx) }}
                    >
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
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur shadow-sm border border-slate-100 px-3 py-1 rounded-full text-slate-900 font-black font-mono text-sm z-10 group-hover:scale-105 transition-transform">
                          ₹{Number(item.price).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex-grow flex flex-col justify-between px-1">
                        <div className="mb-4">
                          <h4 className="font-black text-slate-800 line-clamp-2 leading-tight text-lg mb-1 group-hover:text-orange-600 transition-colors">{item.name}</h4>
                          <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full inline-block ${item.is_available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-auto border-t border-dashed border-slate-100 pt-4">
                          <button onClick={() => toggleAvailability(item.id, item.is_available)} className={`flex-[2] py-2 rounded-xl flex justify-center items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${item.is_available ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 active:scale-95'}`}>
                            {item.is_available ? <><i className="fa-solid fa-pause"></i> Hide</> : <><i className="fa-solid fa-play"></i> Activate</>}
                          </button>
                          <button onClick={() => openItemDrawer(item)} className="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex justify-center items-center transition-all hover:bg-blue-100 active:scale-90" title="Edit">
                            <i className="fa-solid fa-pen text-[11px]"></i>
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="w-10 h-10 shrink-0 rounded-xl bg-red-50 text-red-500 flex justify-center items-center transition-all hover:bg-red-100 active:scale-90" title="Delete">
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
              <p className="text-slate-500 font-semibold mt-2 max-w-sm leading-relaxed mb-8">Start by creating categories, then add your signature dishes.</p>
              <button onClick={() => openItemDrawer()} className="btn-primary !px-8 !py-4 text-base shadow-xl shadow-orange-500/20">
                <i className="fa-solid fa-plus mr-2"></i>Add First Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ADD / EDIT ITEM — RIGHT SLIDE DRAWER (via Portal)
      ════════════════════════════════════════════════════════════ */}
      <Drawer open={isItemOpen} onClose={closeItemDrawer}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-500/30">
              <i className="fa-solid fa-utensils text-sm"></i>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">{formData.id ? 'Edit Item' : 'Add New Dish'}</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Fill in the details below</p>
            </div>
          </div>
          <button
            onClick={closeItemDrawer}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-500 transition-all active:scale-90"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSaveItem} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto thin-scrollbar p-6 space-y-5">

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Item Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all bg-white placeholder:text-slate-300"
                placeholder="e.g. Signature Truffle Burger"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Price (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">₹</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full h-12 pl-8 pr-4 border-2 border-slate-200 rounded-xl font-bold font-mono text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all bg-white placeholder:text-slate-300"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Category</label>
              <div className="relative">
                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full h-12 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all bg-white appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose a category...</option>
                  {displayCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
              </div>
              {displayCategories.length === 0 && (
                <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation"></i> No categories yet — add one first.
                </p>
              )}
            </div>

            {/* Photo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Photo (Optional)</label>
              <label className="block border-2 border-dashed border-slate-200 hover:border-orange-400 transition-colors rounded-xl cursor-pointer group overflow-hidden bg-slate-50/50">
                {previewUrl ? (
                  <div className="relative">
                    <img src={previewUrl} alt="Preview" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-all">
                        <i className="fa-solid fa-arrows-rotate mr-1"></i> Change
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-300 mb-2 group-hover:text-orange-400 transition-colors block"></i>
                    <p className="text-sm text-slate-400 font-semibold">Click to upload</p>
                    <p className="text-xs text-slate-300 mt-1">PNG, JPG, WebP</p>
                  </div>
                )}
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} className="hidden" />
              </label>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); setFormData({...formData, image_url: ''}) }}
                  className="mt-2 text-xs font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <i className="fa-solid fa-xmark"></i> Remove photo
                </button>
              )}
            </div>

            {/* Availability */}
            <div
              className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-orange-200 cursor-pointer select-none transition-all group"
              onClick={() => setFormData({...formData, is_available: !formData.is_available})}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${formData.is_available ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                {formData.is_available && <i className="fa-solid fa-check text-white text-xs"></i>}
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-800">Available for Ordering</span>
                <span className="block text-xs text-slate-400 mt-0.5">Customers can see and order this item.</span>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="shrink-0 border-t border-slate-100 px-6 py-4 bg-white flex gap-3">
            <button type="button" disabled={isUploading} onClick={closeItemDrawer} className="flex-1 h-12 btn-secondary !rounded-xl font-bold">
              Cancel
            </button>
            <button type="submit" disabled={isUploading} className="flex-[2] h-12 btn-primary !rounded-xl font-bold shadow-lg shadow-orange-500/20">
              {isUploading
                ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Saving...</>
                : <><i className="fa-solid fa-check mr-2"></i>{formData.id ? 'Save Changes' : 'Add Item'}</>
              }
            </button>
          </div>
        </form>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════
          CATEGORY MANAGER — RIGHT SLIDE DRAWER (via Portal)
      ════════════════════════════════════════════════════════════ */}
      <Drawer open={isCategoryOpen} onClose={() => setIsCategoryOpen(false)}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-tags text-sm"></i>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">Categories</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Organize your menu sections</p>
            </div>
          </div>
          <button
            onClick={() => setIsCategoryOpen(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-500 transition-all active:scale-90"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Add Form */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">New Category</label>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              className="flex-1 h-11 px-4 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all bg-white placeholder:text-slate-300"
              placeholder="e.g. Starters, Mains, Desserts..."
              required
            />
            <button
              type="submit"
              disabled={isCategoryLoading}
              className="h-11 px-5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-md shadow-blue-600/20 shrink-0"
            >
              {isCategoryLoading
                ? <i className="fa-solid fa-circle-notch fa-spin"></i>
                : <i className="fa-solid fa-plus"></i>
              }
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-6 py-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
            {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
          </p>
          {categories.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <i className="fa-solid fa-tags text-4xl text-slate-200 mb-4 block"></i>
              <p className="font-bold text-sm text-slate-400">No categories yet</p>
              <p className="text-xs text-slate-300 mt-1">Add your first category above.</p>
            </div>
          ) : (
            categories.map((cat, i) => (
              <div
                key={cat.id}
                className="flex justify-between items-center bg-slate-50 border border-slate-200 hover:border-slate-300 p-4 rounded-xl transition-all group"
                style={{ animationDelay: delay(i) }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-500 rounded-lg flex items-center justify-center text-sm font-black">
                    {cat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 capitalize block">{cat.name}</span>
                    <span className="text-[10px] text-slate-400">{menuItems.filter(i => i.category === cat.name).length} items</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-300 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center active:scale-90"
                  title="Delete"
                >
                  <i className="fa-solid fa-trash text-[10px]"></i>
                </button>
              </div>
            ))
          )}
        </div>
      </Drawer>

    </div>
  )
}
