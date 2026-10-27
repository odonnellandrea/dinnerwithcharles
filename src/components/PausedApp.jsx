import React from 'react'

// Shown to a customer whose account the admin has paused: they can sign in but see no menu
export default function PausedApp({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'white', padding: '40px', border: '1px solid #e0dbd1' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        <h1 style={{ color: '#1a441f', marginBottom: '16px' }}>Your account is on hold</h1>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px', lineHeight: '1.6' }}>
          Ordering is paused for this account right now. If you think that's a mistake, or you'd like to come back, message us on Instagram at @dinnerwithcharles.
        </p>
        <p style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        <button
          onClick={onLogout}
          style={{ padding: '12px 24px', background: '#1a441f', color: '#faf8f3', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', fontFamily: 'inherit' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
