import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function SignupApp({ onSignupComplete }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    household_composition: '',
    delivery_address: '',
    delivery_phone: '',
    delivery_instructions: '',
    delivery_time_slots: [],
    payment_method: '',
    allergies: '',
    health_restrictions: '',
    preference_restrictions: '',
    protein_preferences: '',
    cuisines_enjoyed: '',
    flavor_tolerance: '',
    meal_preferences: '',
    kids_eating: '',
    kids_quirks: '',
    reheating_preference: '',
    anything_else: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (slot) => {
    setFormData(prev => ({
      ...prev,
      delivery_time_slots: prev.delivery_time_slots.includes(slot)
        ? prev.delivery_time_slots.filter(s => s !== slot)
        : [...prev.delivery_time_slots, slot]
    }))
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      })

      if (signupError) throw signupError

      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: data.user.id,
          email: formData.email,
          name: formData.name,
          household_composition: formData.household_composition,
          delivery_address: formData.delivery_address,
          delivery_phone: formData.delivery_phone,
          delivery_instructions: formData.delivery_instructions,
          delivery_time_slots: formData.delivery_time_slots.join(', '),
          payment_method: formData.payment_method,
          allergies: formData.allergies,
          health_restrictions: formData.health_restrictions,
          preference_restrictions: formData.preference_restrictions,
          protein_preferences: formData.protein_preferences,
          cuisines_enjoyed: formData.cuisines_enjoyed,
          flavor_tolerance: formData.flavor_tolerance,
          meal_preferences: formData.meal_preferences,
          kids_eating: formData.kids_eating,
          kids_quirks: formData.kids_quirks,
          reheating_preference: formData.reheating_preference,
          anything_else: formData.anything_else
        }])

      if (insertError) throw insertError
      onSignupComplete()
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '20px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '20px' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', marginBottom: '20px', display: 'block', margin: '0 auto 20px' }} />
        
        {error && <div style={{ color: '#d32f2f', marginBottom: '20px', padding: '12px', background: '#ffebee', borderRadius: '6px' }}>{error}</div>}

        <form onSubmit={handleSignup}>
          {step === 1 && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Create Account</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <button type="button" onClick={() => setStep(2)} style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Next</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Household Information</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Who are we cooking for?</label>
                <input type="text" name="household_composition" value={formData.household_composition} onChange={handleInputChange} placeholder="e.g., 2 adults, 2 kids ages 4 and 6" style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Delivery Address</label>
                <input type="text" name="delivery_address" value={formData.delivery_address} onChange={handleInputChange} placeholder="Include apt/unit number" style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Delivery Phone Number</label>
                <input type="tel" name="delivery_phone" value={formData.delivery_phone} onChange={handleInputChange} placeholder="(555) 123-4567" style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Delivery Instructions & Times to Avoid</label>
                <textarea name="delivery_instructions" value={formData.delivery_instructions} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Preferred Delivery Time</label>
                {['Morning 8am-11am', 'Midday 11am-2pm', 'Afternoon 2pm-5pm', 'Evening 5pm-8pm'].map(slot => (
                  <div key={slot} style={{ marginBottom: '8px' }}>
                    <input type="checkbox" id={slot} checked={formData.delivery_time_slots.includes(slot)} onChange={() => handleCheckboxChange(slot)} />
                    <label htmlFor={slot} style={{ marginLeft: '8px' }}>{slot}</label>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Payment Method</label>
                <select name="payment_method" value={formData.payment_method} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px' }}>
                  <option value="">Select one</option>
                  <option value="Venmo">Venmo</option>
                  <option value="Zelle">Zelle</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button type="button" onClick={() => setStep(1)} style={{ marginRight: '10px', padding: '12px 20px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
              <button type="button" onClick={() => setStep(3)} style={{ padding: '12px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Next</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Allergies & Restrictions</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Allergies</label>
                <textarea name="allergies" value={formData.allergies} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Health Restrictions</label>
                <textarea name="health_restrictions" value={formData.health_restrictions} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Preference Restrictions</label>
                <textarea name="preference_restrictions" value={formData.preference_restrictions} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <button type="button" onClick={() => setStep(2)} style={{ marginRight: '10px', padding: '12px 20px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
              <button type="button" onClick={() => setStep(4)} style={{ padding: '12px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Next</button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Proteins & Cuisines</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>What proteins do you LOVE?</label>
                <textarea name="protein_preferences" value={formData.protein_preferences} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Cuisines You Enjoy</label>
                <textarea name="cuisines_enjoyed" value={formData.cuisines_enjoyed} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Flavor Tolerance</label>
                <textarea name="flavor_tolerance" value={formData.flavor_tolerance} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Meal Preferences</label>
                <textarea name="meal_preferences" value={formData.meal_preferences} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <button type="button" onClick={() => setStep(3)} style={{ marginRight: '10px', padding: '12px 20px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
              <button type="button" onClick={() => setStep(5)} style={{ padding: '12px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Next</button>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>Kids, Reheating & Final Thoughts</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Kids Eating Habits</label>
                <textarea name="kids_eating" value={formData.kids_eating} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Kids Food Quirks</label>
                <textarea name="kids_quirks" value={formData.kids_quirks} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Reheating Preference</label>
                <textarea name="reheating_preference" value={formData.reheating_preference} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Anything Else?</label>
                <textarea name="anything_else" value={formData.anything_else} onChange={handleInputChange} style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', resize: 'vertical' }} />
              </div>
              <button type="button" onClick={() => setStep(4)} style={{ marginRight: '10px', padding: '12px 20px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
              <button type="submit" disabled={loading} style={{ padding: '12px 20px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', opacity: loading ? 0.5 : 1 }}>{loading ? 'Creating Account...' : 'Create Account'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
