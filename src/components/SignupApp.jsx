import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function SignupApp({ onBack }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    household: '',
    address: '',
    phone: '',
    instructions: '',
    timeSlots: '',
    paymentMethod: '',
    allergies: '',
    healthRestrictions: '',
    preferenceRestrictions: '',
    proteinPreferences: '',
    cuisines: '',
    flavorTolerance: '',
    mealPreferences: '',
    kidsEating: '',
    kidsQuirks: '',
    reheatingPreference: '',
    anythingElse: ''
  })
  const [error, setError] = useState('')
  const [successScreen, setSuccessScreen] = useState(false)
  const [loading, setLoading] = useState(false)

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        setError('Please fill in all fields')
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
    }
    setError('')
    setStep(step + 1)
  }

  const handleBack = () => {
    if (step === 1) {
      onBack()
    } else {
      setStep(step - 1)
      setError('')
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      })

      if (signUpError) throw signUpError

      if (authData.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            username: formData.email,
            name: formData.name,
            email: formData.email,
            delivery_address: formData.address,
            delivery_phone: formData.phone,
            delivery_time_slots: formData.timeSlots,
            delivery_instructions: formData.instructions,
            payment_method: formData.paymentMethod,
            household_composition: formData.household,
            allergies: formData.allergies,
            health_restrictions: formData.healthRestrictions,
            preference_restrictions: formData.preferenceRestrictions,
            protein_preferences: formData.proteinPreferences,
            cuisines_enjoyed: formData.cuisines,
            flavor_tolerance: formData.flavorTolerance,
            meal_preferences: formData.mealPreferences,
            kids_eating: formData.kidsEating,
            kids_quirks: formData.kidsQuirks,
            reheating_preference: formData.reheatingPreference,
            anything_else: formData.anythingElse,
            approval_status: 'pending',
            is_active: true
          }])

        if (insertError) throw insertError
        setSuccessScreen(true)
      }
    } catch (err) {
      setError(err.message || 'Error during signup')
    }
    setLoading(false)
  }

  if (successScreen) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0dbd1' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
          
          <h1 style={{ color: '#1B5E4E', marginBottom: '16px' }}>Welcome!</h1>
          
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '12px', lineHeight: '1.6' }}>
            Thank you for signing up for Dinner with Charles. Your application is being reviewed by our team.
          </p>
          
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
            You'll receive an email once you're approved and can start ordering!
          </p>
          
          <p style={{ fontSize: '14px', color: '#999' }}>
            Redirecting you to sign in...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px', display: 'block' }} />

        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0dbd1' }}>
          <h2 style={{ color: '#1B5E4E', marginBottom: '24px' }}>Step {step} of 5</h2>

          {error && <p style={{ color: 'red', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

          {step === 1 && (
            <div>
              <input type="text" placeholder="Name" value={formData.name} onChange={(e) => updateField('name', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Password" value={formData.password} onChange={(e) => updateField('password', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          )}

          {step === 2 && (
            <div>
              <input type="text" placeholder="Household composition (e.g., 2 adults, 1 kid)" value={formData.household} onChange={(e) => updateField('household', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Delivery address" value={formData.address} onChange={(e) => updateField('address', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Delivery time preferences" value={formData.timeSlots} onChange={(e) => updateField('timeSlots', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Special instructions" value={formData.instructions} onChange={(e) => updateField('instructions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Payment method (e.g., credit card, Venmo)" value={formData.paymentMethod} onChange={(e) => updateField('paymentMethod', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          )}

          {step === 3 && (
            <div>
              <textarea placeholder="Allergies" value={formData.allergies} onChange={(e) => updateField('allergies', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
              <textarea placeholder="Health restrictions" value={formData.healthRestrictions} onChange={(e) => updateField('healthRestrictions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
              <textarea placeholder="Preference restrictions (e.g., vegetarian, no shellfish)" value={formData.preferenceRestrictions} onChange={(e) => updateField('preferenceRestrictions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
            </div>
          )}

          {step === 4 && (
            <div>
              <input type="text" placeholder="Protein preferences" value={formData.proteinPreferences} onChange={(e) => updateField('proteinPreferences', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Cuisines enjoyed" value={formData.cuisines} onChange={(e) => updateField('cuisines', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Flavor tolerance (spicy, mild, adventurous)" value={formData.flavorTolerance} onChange={(e) => updateField('flavorTolerance', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Meal preferences" value={formData.mealPreferences} onChange={(e) => updateField('mealPreferences', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          )}

          {step === 5 && (
            <div>
              <input type="text" placeholder="Do kids eat with you? (yes/no)" value={formData.kidsEating} onChange={(e) => updateField('kidsEating', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <textarea placeholder="Any kids quirks or preferences" value={formData.kidsQuirks} onChange={(e) => updateField('kidsQuirks', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
              <input type="text" placeholder="Reheating preference" value={formData.reheatingPreference} onChange={(e) => updateField('reheatingPreference', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <textarea placeholder="Anything else we should know?" value={formData.anythingElse} onChange={(e) => updateField('anythingElse', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleBack} style={{ flex: 1, padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}>
              Back
            </button>
            {step < 5 ? (
              <button onClick={handleNext} style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}>
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
