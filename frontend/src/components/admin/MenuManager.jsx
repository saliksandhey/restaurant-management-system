import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function MenuManager() {
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ id: null, name: '', price: '', category: '', image_url: '', is_available: true })
  
  // Image Upload State
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    fetchMenuItems()
  }, [])

  const fetchMenuItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('menu_items').select('*').order('category')
      if (error) throw error
      setMenuItems(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setIsUploading(true)
    try {
      let finalImageUrl = formData.image_url

      // Handle Image Upload if a new file is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `public/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, selectedFile)

        if (uploadError) throw uploadError

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath)

        finalImageUrl = publicUrl
      }

      // Prepare database payload
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
      fetchMenuItems()
    } catch (err) {
      alert('Error saving menu item: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return
    try {
      // Optional: Delete image from storage as well, but for simplicity we keep it unhandled right now.
      const { error } = await supabase.from('menu_items').delete().eq('id', id)
      if (error) throw error
      fetchMenuItems()
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
      setFormData({ id: null, name: '', price: '', category: '', image_url: '', is_available: true })
    }
    setSelectedFile(null)
    setIsEditing(true)
  }

  // Group by category
  const categories = [...new Set(menuItems.map(item => item.category))]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Menu Management</h2>
          <p className="text-sm text-gray-500">Add, edit, or remove items from the menu</p>
        </div>
        <button 
          onClick={() => openForm()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <i className="fa-solid fa-plus"></i> Add Item
        </button>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <h3 className="text-lg font-bold mb-4">{formData.id ? 'Edit Item' : 'New Menu Item'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                  <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2 border rounded-md" list="categories" />
                  <datalist id="categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-bold text-gray-700 mb-2">Item Image</label>
                
                {formData.image_url && !selectedFile && (
                  <div className="mb-3">
                    <img src={formData.image_url} alt="Current" className="w-full h-32 object-cover rounded-md border border-gray-200" />
                    <button type="button" onClick={() => setFormData({...formData, image_url: ''})} className="mt-2 text-sm text-red-600 font-medium hover:underline">Remove current image</button>
                  </div>
                )}
                
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={e => setSelectedFile(e.target.files[0])} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
                />
                <p className="text-xs text-gray-400 mt-2">Upload a new image to override existing one.</p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_available" checked={formData.is_available} onChange={e => setFormData({...formData, is_available: e.target.checked})} className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="is_available" className="text-sm font-medium text-gray-700">Item is available for ordering</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" disabled={isUploading} onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={isUploading} className="px-4 py-2 bg-blue-600 disabled:opacity-70 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
                  {isUploading ? <><span className="animate-spin relative top-[-1px]">↻</span> Uploading...</> : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading menu...</div>
      ) : (
        <div className="space-y-8">
          {categories.map(category => (
            <div key={category} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4 capitalize">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.filter(item => item.category === category).map(item => (
                  <div key={item.id} className={`flex items-start gap-4 p-4 rounded-lg border shadow-sm ${item.is_available ? 'border-gray-200 bg-white' : 'border-red-100 bg-red-50/30'}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-md object-cover flex-shrink-0 bg-gray-100" />
                    ) : (
                      <div className="w-20 h-20 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 border border-gray-200">
                        <i className="fa-regular fa-image text-3xl"></i>
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-gray-800 line-clamp-2 leading-tight">{item.name}</h4>
                        <span className="font-black text-blue-600">₹{Number(item.price).toFixed(2)}</span>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-block mt-2 ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.is_available ? 'Available' : 'Out of Stock'}
                      </span>
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 border-dashed">
                        <button onClick={() => toggleAvailability(item.id, item.is_available)} className={`flex-1 p-1.5 rounded-md hover:bg-gray-100 flex justify-center items-center gap-1 text-sm font-medium ${item.is_available ? 'text-amber-600' : 'text-green-600'}`} title="Toggle Availability">
                          {item.is_available ? <><i className="fa-solid fa-pause"></i> Pause</> : <><i className="fa-solid fa-play"></i> Resume</>}
                        </button>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <button onClick={() => openForm(item)} className="flex-1 p-1.5 rounded-md hover:bg-gray-100 flex justify-center items-center gap-1 text-blue-600 text-sm font-medium" title="Edit">
                          <i className="fa-solid fa-pen"></i> Edit
                        </button>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <button onClick={() => handleDelete(item.id)} className="flex-1 p-1.5 rounded-md hover:bg-red-50 flex justify-center items-center gap-1 text-red-600 text-sm font-medium" title="Delete">
                          <i className="fa-solid fa-trash"></i> Drop
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {menuItems.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
              No menu items found. Add some to get started!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
