import { brandLogo } from '../lib/logo'
import React from 'react'

// Shown to a customer whose account the admin has paused: they can sign in but see no menu
export default function PausedApp({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-cream)', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'var(--a-surface)', padding: '40px', border: '1px solid var(--a-border)' }}>
        <img src={brandLogo()} alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        <h1 style={{ color: 'var(--a-green)', marginBottom: '16px' }}>Your account is on hold</h1>
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '30px', lineHeight: '1.6' }}>
          Ordering is paused for this account right now. If you think that's a mistake, or you'd like to come back, message us on Instagram at @dinnerwithcharles.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--a-faint)', marginBottom: '20px' }}>
          Signed in as: <strong>{user?.email}</strong>
        </p>
        <button
          onClick={onLogout}
          style={{ padding: '12px 24px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', fontFamily: 'inherit' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}
