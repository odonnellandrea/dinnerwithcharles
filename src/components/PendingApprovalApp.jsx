import React from 'react'

export default function PendingApprovalApp({ user, onLogout }) {
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
        
        <p style={{ fontSize: '14px', color: '#999', marginBottom: '20px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        
        <button 
          onClick={onLogout} 
          style={{ padding: '12px 24px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
