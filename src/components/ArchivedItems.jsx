import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
          style={{ padding: '10px 20px', background: 'var(--a-gold)', color: 'var(--a-cream)', border: 'none', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Back
        </button>
      </div>

      <h2 style={{ color: 'var(--a-green)', marginBottom: '20px' }}>Archived Items</h2>

      <div style={{ background: 'var(--a-surface)', padding: '16px', marginBottom: '20px', border: '1px solid var(--a-border)', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 16px',
            background: filter === 'all' ? 'var(--a-green)' : 'var(--a-border)',
            color: filter === 'all' ? 'var(--a-surface)' : 'var(--a-muted)',
            border: 'none',
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
            background: filter === 'entree' ? 'var(--a-green)' : 'var(--a-border)',
            color: filter === 'entree' ? 'var(--a-surface)' : 'var(--a-muted)',
            border: 'none',
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
            background: filter === 'salad' ? 'var(--a-green)' : 'var(--a-border)',
            color: filter === 'salad' ? 'var(--a-surface)' : 'var(--a-muted)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          Sides ({archivedItems.filter(i => i.type === 'salad').length})
        </button>
        <button
          onClick={() => setFilter('addon')}
          style={{
            padding: '8px 16px',
            background: filter === 'addon' ? 'var(--a-green)' : 'var(--a-border)',
            color: filter === 'addon' ? 'var(--a-surface)' : 'var(--a-muted)',
            border: 'none',
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
        <p style={{ color: 'var(--a-muted)' }}>No archived items in this category.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredItems.map(item => (
            <div key={item.id} style={{ background: 'var(--a-surface)', padding: '16px', border: '1px solid var(--a-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: 'var(--a-green)' }}>
                  {item.name}
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--a-faint)', fontWeight: '400' }}>
                    ({item.type === 'entree' ? 'Entrée' : item.type === 'salad' ? 'Side' : 'Add-on'})
                  </span>
                </p>
                <p style={{ margin: '4px 0', fontSize: '13px', color: 'var(--a-muted)' }}>{item.description}</p>
                {item.price && <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--a-faint)' }}>${(item.price / 100).toFixed(2)}</p>}
                {item.archived_at && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--a-faintest)' }}>
                    Archived {new Date(item.archived_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRestore(item.id, item.type)}
                style={{ padding: '8px 16px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '12px' }}
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
