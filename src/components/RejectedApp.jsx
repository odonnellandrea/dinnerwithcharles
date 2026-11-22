import { brandLogo } from '../lib/logo'
import React, { useState } from 'react'
import SignupApp from './SignupApp'

export default function RejectedApp({ user, onLogout, onResubmitted }) {
  const [updating, setUpdating] = useState(false)

  if (updating) {
    return <SignupApp resubmitFor={user} onBack={() => setUpdating(false)} onResubmitted={onResubmitted} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-cream)', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'var(--a-surface)', padding: '40px', border: '1px solid var(--a-border)' }}>
        <img src={brandLogo()} alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        
        <h1 style={{ color: 'var(--a-green)', marginBottom: '16px' }}>Request Not Approved</h1>
        
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '12px', lineHeight: '1.6' }}>
          Unfortunately, we're unable to approve your request to join at this time.
        </p>

        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '30px', lineHeight: '1.6' }}>
          If something has changed, you can update your answers and resubmit, and we'll take another look.
        </p>

        <button
          onClick={() => setUpdating(true)}
          style={{ display: 'block', width: '100%', maxWidth: '320px', margin: '0 auto 12px', padding: '14px 24px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '600', fontFamily: 'inherit' }}
        >
          Update and resubmit
        </button>
        
        <p style={{ fontSize: '14px', color: 'var(--a-faint)', margin: '24px 0 16px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        
        <button 
          onClick={onLogout} 
          style={{ padding: '10px 20px', background: 'var(--a-surface)', color: 'var(--a-green)', border: '1px solid var(--a-green)', cursor: 'pointer', fontSize: '14px', fontWeight: '500', fontFamily: 'inherit' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
