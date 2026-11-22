import { brandLogo } from '../lib/logo'
import React from 'react'

export default function PendingApprovalApp({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-cream)', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'var(--a-surface)', padding: '40px', borderRadius: '12px', border: '1px solid var(--a-border)' }}>
        <img src={brandLogo()} alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        
        <h1 style={{ color: 'var(--a-green)', marginBottom: '16px' }}>You're on the waitlist</h1>
        
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '12px', lineHeight: '1.6' }}>
          Thank you for joining the Dinner with Charles waitlist. Our kitchen is at capacity for now, and we're expanding soon. We'll be in touch as spots open, and we can't wait to cook for you.
        </p>
        
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '30px', lineHeight: '1.6' }}>
          Come back and sign in anytime to check your status. Once a spot opens and you're approved, you'll be able to start ordering.
        </p>
        
        <p style={{ fontSize: '14px', color: 'var(--a-faint)', marginBottom: '20px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        
        <button 
          onClick={onLogout} 
          style={{ padding: '12px 24px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
