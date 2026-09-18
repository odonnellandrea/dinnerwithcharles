import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

const CATEGORIES = ['Chicken', 'Beef', 'Fish', 'Lamb', 'Pasta', 'Pork', 'Vegetarian', 'Frozen']

export default function ItemFormModal({ item, onClose, onSave }) {
  const [itemType, setItemType] = useState(item?.item_type || 'entree')
  const [name, setName] = useState(item?.name || '')
  const [description, setDescription] = useState(item?.description || '')
  const [price, setPrice] = useState(item?.price ? (item.price / 100).toFixed(2) : '')
  const [selectedCategories, setSelectedCategories] = useState(item?.category || [])
  const [components, setComponents] = useState(item?.components || [])
  const [chefNotes, setChefNotes] = useState(item?.chef_notes || '')
  const [loading, setLoading] = useState(false)

  const handleAddComponent = () => {
    setComponents([...components, { name: '', instruction: '', quantity: 1 }])
  }

  const handleUpdateComponent = (idx, field, value) => {
    const updated = [...components]
    updated[idx][field] = field === 'quantity' ? parseInt(value) || 1 : value
    setComponents(updated)
  }

  const handleRemoveComponent = (idx) => {
    setComponents(components.filter((_, i) => i !== idx))
  }

  const handleToggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat))
    } else {
      setSelectedCategories([...selectedCategories, cat])
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || components.length === 0) {
      alert('Name, description, and at least one component are required')
      return
    }

    setLoading(true)
    try {
      const table = itemType === 'entree' ? 'entrees'
                  : itemType === 'salad' ? 'salads'
                  : 'add_ons'

      const itemData = {
        name: name.trim(),
        description: description.trim(),
        price: price ? Math.round(parseFloat(price) * 100) : null,
        components: components,
        chef_notes: chefNotes.trim() || null,
        category: selectedCategories.length > 0 ? selectedCategories : null
      }

      if (item?.id) {
        const { error } = await supabase
          .from(table)
          .update(itemData)
          .eq('id', item.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from(table)
          .insert([itemData])

        if (error) throw error
      }

      onSave()
    } catch (err) {
      console.error('Save error:', err)
      alert('Error saving item: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        width: '90%'
      }}>
        <h2 style={{ color: '#1B5E4E', marginTop: 0 }}>
          {item ? 'Edit Item' : 'Add New Item'}
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#1B5E4E' }}>Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1' }}
          >
            <option value="entree">Entrée</option>
            <option value="salad">Salad</option>
            <option value="addon">Add-on</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#1B5E4E' }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Tuscan Chicken"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#1B5E4E' }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Pan-seared chicken with Italian herbs and garlic"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', minHeight: '80px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#1B5E4E' }}>Price (for add-ons)</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g., 43.00"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#1B5E4E' }}>Categories (select all that apply)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {CATEGORIES.map(cat => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px', background: '#faf8f3', borderRadius: '6px' }}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => handleToggleCategory(cat)}
                />
                <span style={{ fontSize: '14px' }}>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#1B5E4E' }}>Components</label>
          {components.map((comp, idx) => (
            <div key={idx} style={{ marginBottom: '12px', padding: '12px', background: '#faf8f3', borderRadius: '6px' }}>
              <input
                type="text"
                placeholder="Component name"
                value={comp.name}
                onChange={(e) => handleUpdateComponent(idx, 'name', e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #e0dbd1', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="Reheating instruction"
                value={comp.instruction}
                onChange={(e) => handleUpdateComponent(idx, 'instruction', e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #e0dbd1', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  value={comp.quantity}
                  onChange={(e) => handleUpdateComponent(idx, 'quantity', e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #e0dbd1' }}
                  placeholder="Qty"
                />
                <button
                  onClick={() => handleRemoveComponent(idx)}
                  style={{ padding: '8px 12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handleAddComponent}
            style={{ width: '100%', padding: '10px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >
            + Add Component
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#1B5E4E' }}>Chef Notes</label>
          <textarea
            value={chefNotes}
            onChange={(e) => setChefNotes(e.target.value)}
            placeholder="e.g., Best served within 2 days"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e0dbd1', minHeight: '60px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
