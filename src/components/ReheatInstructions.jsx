import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchSheetReheat } from '../lib/sheetMenu'
import { buildReheatGuide, LIBRARY_TABLE } from '../lib/reheatGuide'
import { downloadPdf } from '../lib/downloadPdf'

export default function ReheatInstructions({ user, deliveryDate, onClose, embedded = false }) {
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sheetDown, setSheetDown] = useState(false) // couldn't read the latest steps from the menu sheet
  const [downloading, setDownloading] = useState(false)

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

      // Latest steps from the menu sheet; if it can't be reached, fall back to the item library
      let sheetSteps = {}
      try {
        sheetSteps = await fetchSheetReheat()
      } catch (err) {
        console.error('Failed to load reheat steps from the menu sheet:', err)
        setSheetDown(true)
      }
      const lookupLibrary = async (type, name) => {
        const { data } = await supabase.from(LIBRARY_TABLE[type] || 'add_ons').select('*').eq('name', name).single()
        return data
      }
      const orderedDishes = await buildReheatGuide({ orders, sheetSteps, lookupLibrary })

      setInstructions(orderedDishes)
    } catch (err) {
      setError(err.message || 'Failed to load reheat instructions')
    } finally {
      setLoading(false)
    }
  }

  // Same guide as a PDF, built by the reheat-pdf function with the customer's own session
  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPdf(`/.netlify/functions/reheat-pdf?delivery_date=${encodeURIComponent(deliveryDate)}`, `Reheat Instructions ${deliveryDate}.pdf`)
    } catch (err) {
      alert("Sorry, we couldn't build the PDF. Please try again in a moment.\n\n(" + err.message + ")")
    }
    setDownloading(false)
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
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
            For your delivery {getDeliveryDateDisplay()}
          </p>
          {!loading && !error && instructions.length > 0 && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{ padding: '10px 18px', background: 'transparent', color: '#1a441f', border: '1px solid #1a441f', cursor: downloading ? 'wait' : 'pointer', fontSize: '13px', fontWeight: '600', letterSpacing: '0.04em', fontFamily: 'inherit', opacity: downloading ? 0.6 : 1 }}
            >
              {downloading ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          )}
        </div>

        {/* Instructions */}
        {loading && <p>Loading reheat instructions...</p>}
        {error && <p style={{ color: '#c62828', padding: '12px', background: '#fdf3f2', border: '1px solid #e8b4ae', marginBottom: '20px' }}>{error}</p>}

        {!loading && !error && instructions.length > 0 && (
          <div>
            {instructions.map((dish, dishIdx) => (
              <div key={dishIdx} style={{ background: 'white', border: '1px solid #e0dbd1', padding: '22px 24px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4A373', fontWeight: '600' }}>
                  {dish.type === 'salad' ? 'Side dish' : dish.type === 'addon' ? 'Add-on' : 'Entrée'}
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
