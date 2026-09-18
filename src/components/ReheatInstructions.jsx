import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function ReheatInstructions({ user, deliveryDate, onClose }) {
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

      // Fetch all items and their components
      const dishInstructions = {}

      for (const itemKey of itemsToFetch) {
        const [itemType, itemName] = itemKey.split(':')
        const table = itemType === 'entree' ? 'entrees' : itemType === 'salad' ? 'salads' : 'add_ons'

        const { data: item } = await supabase
          .from(table)
          .select('*')
          .eq('name', itemName)
          .single()

        if (item && item.components) {
          const quantity = orders.filter(o => o.item_name === itemName).length
          dishInstructions[itemName] = {
            type: itemType,
            components: item.components.map(comp => ({
              name: comp.name,
              instruction: comp.instruction,
              quantity: (comp.quantity || 1) * quantity
            }))
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
    const date = new Date(deliveryDate)
    const options = { weekday: 'long', month: 'short', day: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <img src="/Green Horizontal Logo.png" alt="Weekly Kitchen" style={{ maxWidth: '200px', height: 'auto', marginBottom: '20px' }} />
          {onClose && (
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Title */}
        <h1 style={{ color: '#1B5E4E', fontSize: '28px', marginTop: '0', marginBottom: '8px' }}>
          Reheat Guide
        </h1>
        <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
          For your delivery {getDeliveryDateDisplay()}
        </p>

        {/* Instructions */}
        {loading && <p>Loading reheat instructions...</p>}
        {error && <p style={{ color: '#c62828', padding: '12px', background: '#ffebee', borderRadius: '6px', marginBottom: '20px' }}>{error}</p>}

        {!loading && !error && instructions.length > 0 && (
          <div>
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e0dbd1', overflow: 'hidden' }}>
              {instructions.map((dish, dishIdx) => (
                <div key={dishIdx} style={{ borderBottom: dishIdx < instructions.length - 1 ? '2px solid #e0dbd1' : 'none' }}>
                  {/* Dish header */}
                  <div style={{ padding: '16px', background: '#1B5E4E', color: 'white' }}>
                    <h2 style={{ margin: '0', fontSize: '18px', fontWeight: '600' }}>
                      {dish.name}
                    </h2>
                  </div>

                  {/* Components */}
                  <div>
                    {dish.components.map((comp, compIdx) => (
                      <div
                        key={compIdx}
                        style={{
                          padding: '16px',
                          paddingLeft: '24px',
                          borderBottom: compIdx < dish.components.length - 1 ? '1px solid #e0dbd1' : 'none',
                          background: compIdx % 2 === 0 ? '#faf8f3' : 'white'
                        }}
                      >
                        <h4 style={{ color: '#1B5E4E', margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                          {comp.name}
                          {comp.quantity > 1 && (
                            <span style={{ color: '#D4A373', marginLeft: '8px', fontSize: '12px', fontWeight: '500' }}>
                              × {comp.quantity}
                            </span>
                          )}
                        </h4>
                        <p style={{ color: '#333', margin: '0', fontSize: '13px', lineHeight: '1.5' }}>
                          {comp.instruction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips section */}
            <div style={{ background: '#f5f0e6', padding: '16px', borderRadius: '8px', marginTop: '24px', border: '1px solid #e0dbd1' }}>
              <h3 style={{ color: '#1B5E4E', marginTop: '0' }}>Tips</h3>
              <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                <li>Reheat only what you'll eat — these instructions are for single portions</li>
                <li>All times are approximate — adjust based on your oven or microwave</li>
                <li>When in doubt, reheat low and slow for best flavor</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
