import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchSheetReheat } from '../lib/sheetMenu'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function ReheatInstructions({ user, deliveryDate, onClose, embedded = false }) {
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetDown, setSheetDown] = useState(false) // couldn't read the latest steps from the menu sheet

  useEffect(() => {
    fetchReheatInstructions()
  }, [])

  const fetchReheatInstructions = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch all orders for this customer and delivery date
      const { data: orders } = await supabase
        .from('Orders')
        .select('*')
        .eq('email', user.email)
        .eq('delivery_date', deliveryDate)

      if (!orders || orders.length === 0) {
        setError('No orders found for this delivery date')
        setLoading(false)
        return
      }

      // Get unique item names and types, maintaining order
      const itemsMap = {}
      orders.forEach(o => {
        const key = `${o.item_type}:${o.item_name}`
        if (!itemsMap[key]) {
          itemsMap[key] = { type: o.item_type, name: o.name || o.item_name }
        }
      })

      const itemsToFetch = Object.keys(itemsMap)

      // Latest steps from the menu sheet; if it can't be reached, fall back to the item library
      let sheetSteps = {}
      try {
        sheetSteps = await fetchSheetReheat()
      } catch (err) {
        console.error('Failed to load reheat steps from the menu sheet:', err)
        setSheetDown(true)
      }

      // Fetch all items and their components
      const dishInstructions = {}

      for (const itemKey of itemsToFetch) {
        const [itemType, itemName] = itemKey.split(':')
        const steps = sheetSteps[itemName.toLowerCase()]
        if (steps?.length) {
          dishInstructions[itemName] = {
            type: itemType,
            components: steps
          }
          continue
        }

        // Dishes not in the sheet (e.g. from before it existed): look them up in the item library
        const table = itemType === 'entree' ? 'entrees' : itemType === 'salad' ? 'salads' : 'add_ons'

        const { data: item } = await supabase
          .from(table)
          .select('*')
          .eq('name', itemName)
          .single()

        if (item && item.components) {
          dishInstructions[itemName] = {
            type: itemType,
            components: item.components.map(comp => ({ name: comp.name, instruction: comp.instruction }))
          }
        }
      }

      // Create ordered array of dishes (in the order they were ordered)
      const orderedDishes = []
      const seen = new Set()
      orders.forEach(o => {
        if (!seen.has(o.item_name)) {
          orderedDishes.push({
            name: o.item_name,
            type: o.item_type,
            components: dishInstructions[o.item_name]?.components || []
          })
          seen.add(o.item_name)
        }
      })

      setInstructions(orderedDishes)
    } catch (err) {
      setError(err.message || 'Failed to load reheat instructions')
    } finally {
      setLoading(false)
    }
  }

  const getDeliveryDateDisplay = () => {
    // Parse YYYY-MM-DD as a local date; new Date('2026-10-19') is UTC and shows the day before in the US
    const [y, m, d] = String(deliveryDate).split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const options = { weekday: 'long', month: 'short', day: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  return (
    <div style={embedded ? { paddingBottom: '40px' } : { minHeight: '100vh', background: '#faf8f3', padding: '20px', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          {!embedded && <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '20px' }} />}
          {onClose && (
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', background: '#D4A373', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Title */}
        <h1 style={{ color: '#1a441f', fontSize: '28px', marginTop: '0', marginBottom: '8px' }}>
          Reheat Guide
        </h1>
        <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          For your delivery {getDeliveryDateDisplay()}
        </p>

        {/* Instructions */}
        {loading && <p>Loading reheat instructions...</p>}
        {error && <p style={{ color: '#c62828', padding: '12px', background: '#fdf3f2', border: '1px solid #e8b4ae', marginBottom: '20px' }}>{error}</p>}

        {!loading && !error && instructions.length > 0 && (
          <div>
            {instructions.map((dish, dishIdx) => (
              <div key={dishIdx} style={{ background: 'white', border: '1px solid #e0dbd1', padding: '22px 24px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>
                  {dish.type === 'salad' ? 'Salad' : dish.type === 'addon' ? 'Add-on' : 'Entrée'}
                </p>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '500', color: '#1a441f', lineHeight: 1.3 }}>
                  {dish.name}
                </h2>

                {dish.components.length === 0 && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                    {sheetDown ? "We couldn't load the steps for this dish. Please refresh in a moment." : 'Nothing to reheat. Serve as is.'}
                  </p>
                )}
                {dish.components.map((comp, compIdx) => (
                  <div key={compIdx} style={{ padding: '14px 0 0 0', marginTop: '14px', borderTop: '1px solid #e0dbd1' }}>
                    {comp.name && (
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '500', color: '#1a441f' }}>{comp.name}</p>
                    )}
                    <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: '#333' }}>{comp.instruction}</p>
                  </div>
                ))}
              </div>
            ))}

            {/* Tips section */}
            <div style={{ padding: '20px 24px', marginTop: '28px', borderTop: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>Tips</p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: '#666', lineHeight: 1.7 }}>
                <li>Reheat only what you'll eat. These steps are for single portions.</li>
                <li>Times are approximate, so adjust for your oven or microwave.</li>
                <li>When in doubt, reheat low and slow.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
