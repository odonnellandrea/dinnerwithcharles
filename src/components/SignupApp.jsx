import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import NotificationChoices from './NotificationChoices'
import { normalizeUsPhone, PREFS_SET_COLUMN, isMissingPrefsColumn, withoutPrefsColumn } from '../lib/notificationConsent'
import { nameColumns, namesFrom, isMissingNameColumns, withoutNameColumns } from '../lib/customerName'
import { DELIVERY_OPTIONS, parseDeliveryOptions, joinDeliveryOptions, hasDeliveryOption } from '../lib/deliveryOptions'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

// Saved as-is in users.payment_method. Older profiles may hold free text
// (e.g. "credit card"); nothing in the app parses this value, so those stay valid.
const PAYMENT_METHODS = ['Venmo', 'Zelle', 'Cash']

// Form field -> users column, for the request-to-join answers (steps 2-5).
// Shared by the first submission (insert) and a resubmission (update).
const ANSWER_COLUMNS = {
  household: 'household_composition',
  address: 'delivery_address',
  deliveryOption: 'delivery_option',
  phone: 'delivery_phone',
  timeSlots: 'delivery_time_slots',
  instructions: 'delivery_instructions',
  paymentMethod: 'payment_method',
  allergies: 'allergies',
  healthRestrictions: 'health_restrictions',
  preferenceRestrictions: 'preference_restrictions',
  proteinPreferences: 'protein_preferences',
  cuisines: 'cuisines_enjoyed',
  flavorTolerance: 'flavor_tolerance',
  kidsEating: 'kids_eating',
  kidsQuirks: 'kids_quirks',
  reheatingPreference: 'reheating_preference',
  anythingElse: 'anything_else'
}

const answerColumns = (formData) =>
  Object.fromEntries(Object.entries(ANSWER_COLUMNS).map(([field, column]) => [column, formData[field]]))

// resubmitFor: the signed-in, rejected user. Skips the account step, pre-fills their
// previous answers, and updates their profile back to pending instead of signing up.
export default function SignupApp({ onBack, resubmitFor, onResubmitted }) {
  const isResubmit = !!resubmitFor
  const firstStep = isResubmit ? 2 : 1
  const [step, setStep] = useState(firstStep)
  const [loadingProfile, setLoadingProfile] = useState(isResubmit)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    household: '',
    address: '',
    deliveryOption: '',
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
    kidsEating: '',
    kidsQuirks: '',
    reheatingPreference: '',
    anythingElse: '',
    // Marketing opt-ins: always start unchecked
    emailOptIn: false,
    smsOptIn: false,
    smsPhone: ''
  })
  const [phoneError, setPhoneError] = useState('')
  const [error, setError] = useState('')
  const [successScreen, setSuccessScreen] = useState(false)
  const [loading, setLoading] = useState(false)

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (!isResubmit) return
    const loadProfile = async () => {
      const { data, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', resubmitFor.id)
        .single()
      if (profileError || !data) {
        setError("We couldn't load your previous answers. Please try again.")
      } else {
        const answers = Object.fromEntries(Object.entries(ANSWER_COLUMNS).map(([field, column]) => [field, data[column] ?? '']))
        setFormData(prev => ({
          ...prev,
          ...answers,
          // Legacy free-text payment values aren't in the list, so they must pick again
          paymentMethod: PAYMENT_METHODS.includes(data.payment_method) ? data.payment_method : '',
          firstName: namesFrom(data).firstName,
          lastName: namesFrom(data).lastName,
          email: data.email || resubmitFor.email,
          // Show the choices they already saved; nothing new is pre-checked
          emailOptIn: data.email_opt_in === true,
          smsOptIn: data.sms_opt_in === true,
          smsPhone: data.phone_number || ''
        }))
      }
      setLoadingProfile(false)
    }
    loadProfile()
  }, [])

  const [checkingEmail, setCheckingEmail] = useState(false)

  const handleNext = async () => {
    if (step === 1) {
      // Step 1 validation
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setError('Please enter your first and last name')
        return
      }
      if (!formData.email || !formData.email.trim()) {
        setError('Please enter your email')
        return
      }
      if (!formData.password) {
        setError('Please enter a password')
        return
      }
      if (!formData.confirmPassword) {
        setError('Please confirm your password')
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
      // Say so now if this email already has an account, rather than after every step.
      // If the check itself fails (function not installed yet), carry on; signup still catches it.
      setCheckingEmail(true)
      const { data: taken, error: checkError } = await supabase.rpc('email_taken', { addr: formData.email.trim() })
      setCheckingEmail(false)
      if (!checkError && taken === true) {
        setError('There is already an account for this email. Go back and sign in instead, or use "Forgot password?" if you need a new password.')
        return
      }
    }
    
    if (step === 2) {
      // Step 2 validation
      if (!formData.household || !formData.household.trim()) {
        setError('Please enter your household composition')
        return
      }
      if (!formData.address || !formData.address.trim()) {
        setError('Please enter your delivery address')
        return
      }
      if (!formData.deliveryOption) {
        setError('Please tick at least one way to get your order')
        return
      }
      if (!formData.phone || !formData.phone.trim()) {
        setError('Please enter your phone number')
        return
      }
      if (!formData.timeSlots || !formData.timeSlots.trim()) {
        setError('Please select at least one delivery time preference')
        return
      }
      if (!formData.paymentMethod || !formData.paymentMethod.trim()) {
        setError('Please choose your preferred payment method')
        return
      }
    }
    
    setError('')
    setStep(step + 1)
  }

  const handleBack = () => {
    if (step === firstStep) {
      onBack()
    } else {
      setStep(step - 1)
      setError('')
    }
  }

  const handleSubmit = async () => {
    // Texting consent needs a number to text; without consent the number is optional and not saved
    const smsPhone = normalizeUsPhone(formData.smsPhone)
    if (formData.smsOptIn && !smsPhone) {
      setPhoneError('Enter a valid 10-digit US mobile number, or uncheck the text message box.')
      return
    }
    setPhoneError('')

    setLoading(true)
    setError('')

    if (isResubmit) {
      try {
        const changes = {
          ...answerColumns(formData),
          ...nameColumns(formData.firstName, formData.lastName),
          email_opt_in: formData.emailOptIn === true,
          sms_opt_in: formData.smsOptIn === true,
          phone_number: formData.smsOptIn ? smsPhone : null,
          [PREFS_SET_COLUMN]: new Date().toISOString(),
          approval_status: 'pending',
          resubmitted_at: new Date().toISOString()
        }
        let { error: updateError } = await supabase.from('users').update(changes).eq('id', resubmitFor.id)
        if (isMissingPrefsColumn(updateError)) {
          ({ error: updateError } = await supabase.from('users').update(withoutPrefsColumn(changes)).eq('id', resubmitFor.id))
        }
        if (isMissingNameColumns(updateError)) {
          ({ error: updateError } = await supabase.from('users').update(withoutNameColumns(changes)).eq('id', resubmitFor.id))
        }
        if (updateError) throw updateError
        onResubmitted()
      } catch (err) {
        setError("Something went wrong resubmitting your request. Please try again, or message us on Instagram at @dinnerwithcharles.")
        console.error('Resubmit failed:', err)
      }
      setLoading(false)
      return
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      })

      if (signUpError) throw signUpError

      if (authData.user) {
        const profile = {
          id: authData.user.id,
          username: formData.email,
          ...nameColumns(formData.firstName, formData.lastName),
          email: formData.email,
          ...answerColumns(formData),
          // Always explicit so we never rely on the column default
          email_opt_in: formData.emailOptIn === true,
          sms_opt_in: formData.smsOptIn === true,
          phone_number: formData.smsOptIn ? smsPhone : null,
          [PREFS_SET_COLUMN]: new Date().toISOString(),
          approval_status: 'pending',
          is_active: true,
          ...(hasDeliveryOption(formData.deliveryOption, 'messenger') ? { messenger_delivery: true } : {})
        }

        let { error: insertError } = await supabase.from('users').insert([profile])
        if (isMissingPrefsColumn(insertError)) {
          ({ error: insertError } = await supabase.from('users').insert([withoutPrefsColumn(profile)]))
        }
        if (isMissingNameColumns(insertError)) {
          ({ error: insertError } = await supabase.from('users').insert([withoutNameColumns(profile)]))
        }
        // Until 20261020_messenger_delivery.sql is run these columns don't exist; keep the signup going
        if (insertError && /messenger_delivery|delivery_option/.test(insertError.message || '')) {
          const { messenger_delivery: _m, delivery_option: _d, ...rest } = withoutNameColumns(profile)
          ;({ error: insertError } = await supabase.from('users').insert([rest]))
        }
        if (insertError) throw insertError
        setSuccessScreen(true)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong submitting your request. Please try again.')
    }
    setLoading(false)
  }

  if (successScreen) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0dbd1' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
          
          <h1 style={{ color: '#1a441f', marginBottom: '16px' }}>Request Received</h1>
          
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '12px', lineHeight: '1.6' }}>
            Thank you for your request to join Dinner with Charles. We'll review it and be in touch once you're approved.
          </p>
          
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
            You can come back and log in anytime to check the status of your request.
          </p>
          
          <button
            onClick={onBack}
            style={{ padding: '12px 24px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', fontFamily: 'inherit' }}
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px', display: 'block' }} />

        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0dbd1' }}>
          {step === 1 && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#faf8f3', borderRadius: '8px', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0', color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                We'd love to have you join our community! After you submit your information, we'll review your request to ensure we're the right fit for your family's needs. You'll hear from us within a few days.
              </p>
            </div>
          )}

          {isResubmit && step === firstStep && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#faf8f3', border: '1px solid #e0dbd1' }}>
              <p style={{ margin: '0', color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                Update anything that's changed, then resubmit. We'll take another look at your request.
              </p>
            </div>
          )}

          <h2 style={{ color: '#1a441f', marginBottom: '24px' }}>Step {step - firstStep + 1} of {5 - firstStep + 1}</h2>

          {loadingProfile && <p style={{ color: '#666', marginBottom: '16px', fontSize: '14px' }}>Loading your answers...</p>}

          {error && <p style={{ color: '#c62828', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

          {step === 1 && (
            <div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="text" placeholder="First name" autoComplete="given-name" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Last name" autoComplete="family-name" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Password" value={formData.password} onChange={(e) => updateField('password', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          )}

          {step === 2 && (
            <div>
              <input type="text" placeholder="Household composition (e.g., 2 adults, 1 kid)" value={formData.household} onChange={(e) => updateField('household', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                Delivery is included in NoMad, Gramercy, Kips Bay, Murray Hill, Hudson Yards and some parts of Chelsea. Everywhere else in Manhattan, please choose pickup in NoMad or Uber messenger delivery at cost ($12–18, depending on delivery conditions). Outside Manhattan? Pickup in NoMad works, and so does delivery to an office or a friend's place in the city. We're always looking to expand our delivery area, so stay tuned.
              </p>
              <input type="text" placeholder="Delivery address" value={formData.address} onChange={(e) => updateField('address', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <div style={{ border: '1px solid #e0dbd1', borderRadius: '6px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#1a441f' }}>How would you like to get your order? <span style={{ fontWeight: '400', color: '#999' }}>Tick all that work for you.</span></p>
                {DELIVERY_OPTIONS.map(o => {
                  const chosen = parseDeliveryOptions(formData.deliveryOption)
                  const checked = chosen.includes(o.value)
                  return (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: '6px 0', fontSize: '14px', color: '#333', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateField('deliveryOption', joinDeliveryOptions(checked ? chosen.filter(v => v !== o.value) : [...chosen, o.value]))}
                        style={{ marginTop: '3px', cursor: 'pointer' }}
                      />
                      <span>{o.label}{o.hint ? <span style={{ color: '#999' }}> ({o.hint})</span> : null}</span>
                    </label>
                  )
                })}
              </div>
              <input type="tel" placeholder="Phone number" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Delivery time preferences" value={formData.timeSlots} onChange={(e) => updateField('timeSlots', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Special delivery instructions" value={formData.instructions} onChange={(e) => updateField('instructions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <select value={formData.paymentMethod} onChange={(e) => updateField('paymentMethod', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', boxSizing: 'border-box', fontSize: '16px', background: 'white', color: formData.paymentMethod ? 'inherit' : '#999' }}>
                <option value="">Preferred payment method</option>
                {PAYMENT_METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#faf8f3', borderRadius: '6px', fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                We take your family's dietary needs seriously and will do our very best to accommodate allergies and restrictions. As a small kitchen operation, we're unable to safely accommodate families with severe food allergies at this time.
              </div>
              <textarea placeholder="Allergies" value={formData.allergies} onChange={(e) => updateField('allergies', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
              <textarea placeholder="Health restrictions" value={formData.healthRestrictions} onChange={(e) => updateField('healthRestrictions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
              <textarea placeholder="Preference restrictions (e.g., vegetarian, no shellfish)" value={formData.preferenceRestrictions} onChange={(e) => updateField('preferenceRestrictions', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
            </div>
          )}

          {step === 4 && (
            <div>
              <input type="text" placeholder="Favorite proteins" value={formData.proteinPreferences} onChange={(e) => updateField('proteinPreferences', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Cuisines enjoyed" value={formData.cuisines} onChange={(e) => updateField('cuisines', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Flavor tolerance (spicy, mild, adventurous)" value={formData.flavorTolerance} onChange={(e) => updateField('flavorTolerance', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <input type="text" placeholder="Do kids eat with you? (yes/no)" value={formData.kidsEating} onChange={(e) => updateField('kidsEating', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }} />
              <textarea placeholder="Any kids quirks or preferences" value={formData.kidsQuirks} onChange={(e) => updateField('kidsQuirks', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />
            </div>
          )}

          {step === 5 && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#1a441f', fontSize: '14px' }}>How do you prefer to reheat?</label>
              <select value={formData.reheatingPreference} onChange={(e) => updateField('reheatingPreference', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '16px' }}>
                <option value="">Select an option</option>
                <option value="Toaster oven/Oven">Toaster oven/Oven</option>
                <option value="Microwave">Microwave</option>
                <option value="Both">Both</option>
              </select>
              <textarea placeholder="Is there anything else we should know to better understand your family's needs and preferences?" value={formData.anythingElse} onChange={(e) => updateField('anythingElse', e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box', minHeight: '80px' }} />

              <div style={{ marginBottom: '24px', paddingTop: '8px', borderTop: '1px solid #e0dbd1' }}>
                <h3 style={{ color: '#1a441f', fontSize: '17px', margin: '16px 0 4px 0' }}>Stay in touch (optional)</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: '1.6' }}>Choose either, both or neither.</p>
                <NotificationChoices
                  emailOptIn={formData.emailOptIn}
                  smsOptIn={formData.smsOptIn}
                  phoneNumber={formData.smsPhone}
                  phoneError={phoneError}
                  onChange={(field, value) => {
                    if (field === 'phoneNumber') updateField('smsPhone', value)
                    else updateField(field, value)
                    setPhoneError('')
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleBack} style={{ flex: 1, padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}>
              Back
            </button>
            {step < 5 ? (
              <button onClick={handleNext} disabled={checkingEmail} style={{ flex: 1, padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: checkingEmail ? 'wait' : 'pointer', fontSize: '16px', fontWeight: '500', opacity: checkingEmail ? 0.7 : 1 }}>
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading || loadingProfile} style={{ flex: 1, padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Submitting...' : isResubmit ? 'Resubmit Request' : 'Request to Join'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
