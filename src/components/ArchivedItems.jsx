import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function ArchivedItems({ onBack }) {
  const [archivedItems, setArchivedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchArchivedItems()
  }, [])

  const fetchArchivedItems = async () => {
    setLoading(true)

    try {
      const { data: entrees } = await supabase
        .from('entrees')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })

      const { data: salads } = await supabase
        .from('salads')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })

      const { data: addOns } = await supabase
        .from('add_ons')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })

      const allArchived = [
        ...(entrees || []).map(e => ({ ...e, type: 'entree' })),
        ...(salads || []).map(s => ({ ...s, type: 'salad' })),
        ...(addOns || []).map(a => ({ ...a, type: 'addon' }))
      ]

      setArchivedItems(allArchived)
    } catch (err) {
      console.error('Failed to fetch archived items:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (id, type) => {
    const table = type === 'entree' ? 'entrees' : type === 'salad' ? 'salads' : 'add_ons'

    try {
      await supabase
        .from(table)
        .update({ archived_at: null })
        .eq('id', id)

      setArchivedItems(archivedItems.filter(item => item.id !== id))
      alert('Item restored successfully!')
    } catch (err) {
      alert('Failed to restore item: ' + err.message)
    }
  }

  const filteredItems = filter === 'all' ? archivedItems : archivedItems.filter(item => item.type === filter)

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{ padding: '10px 20px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Back
        </button>
      </div>

      <h2 style={{ color: '#1B5E4E', marginBottom: '20px' }}>Archived Items</h2>

      <div style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0dbd1', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            background: filter === 'all' ? '#1B5E4E' : '#e0dbd1',
            color: filter === 'all' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          All ({archivedItems.length})
        </button>
        <button
          onClick={() => setFilter('entree')}
          style={{
            padding: '8px 16px',
            background: filter === 'entree' ? '#1B5E4E' : '#e0dbd1',
            color: filter === 'entree' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Entrées ({archivedItems.filter(i => i.type === 'entree').length})
        </button>
        <button
          onClick={() => setFilter('salad')}
          style={{
            padding: '8px 16px',
            background: filter === 'salad' ? '#1B5E4E' : '#e0dbd1',
            color: filter === 'salad' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Salads ({archivedItems.filter(i => i.type === 'salad').length})
        </button>
        <button
          onClick={() => setFilter('addon')}
          style={{
            padding: '8px 16px',
            background: filter === 'addon' ? '#1B5E4E' : '#e0dbd1',
            color: filter === 'addon' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Add-ons ({archivedItems.filter(i => i.type === 'addon').length})
        </button>
      </div>

      {loading ? (
        <p>Loading archived items...</p>
      ) : filteredItems.length === 0 ? (
        <p style={{ color: '#666' }}>No archived items in this category.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredItems.map(item => (
            <div key={item.id} style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e0dbd1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1B5E4E' }}>
                  {item.name}
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#999', fontWeight: '400' }}>
                    ({item.type === 'entree' ? 'Entrée' : item.type === 'salad' ? 'Salad' : 'Add-on'})
                  </span>
                </p>
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>{item.description}</p>
                {item.price && <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#999' }}>${(item.price / 100).toFixed(2)}</p>}
                {item.archived_at && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#bbb' }}>
                    Archived {new Date(item.archived_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRestore(item.id, item.type)}
                style={{ padding: '8px 16px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '12px' }}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
