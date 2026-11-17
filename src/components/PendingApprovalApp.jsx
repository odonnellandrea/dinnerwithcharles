import React from 'react'

export default function PendingApprovalApp({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0dbd1' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        
        <h1 style={{ color: '#083525', marginBottom: '16px' }}>You're on the waitlist</h1>
        
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '12px', lineHeight: '1.6' }}>
          Thank you for joining the Dinner with Charles waitlist. Our kitchen is at capacity for now, and we're expanding soon. We'll be in touch as spots open, and we can't wait to cook for you.
        </p>
        
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
          Come back and sign in anytime to check your status. Once a spot opens and you're approved, you'll be able to start ordering.
        </p>
        
        <p style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        
        <button 
          onClick={onLogout} 
          style={{ padding: '12px 24px', background: '#083525', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
