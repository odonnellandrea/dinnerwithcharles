import { brandLogo } from '../lib/logo'
import React from 'react'

// Shown to someone whose neighborhood we don't deliver to yet: they're approved in spirit,
// and this account turns on the day we reach them.
export default function WaitlistApp({ user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--a-cream)', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center', background: 'var(--a-surface)', padding: '40px', border: '1px solid var(--a-border)' }}>
        <img src={brandLogo()} alt="Dinner with Charles" style={{ maxWidth: '200px', height: 'auto', marginBottom: '30px' }} />
        <p style={{ margin: '0 0 10px 0', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--a-gold)', fontWeight: '600' }}>On the list</p>
        <h1 style={{ color: 'var(--a-green)', marginBottom: '16px' }}>We're not on your block yet.</h1>
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '12px', lineHeight: '1.6' }}>
          We don't deliver to your neighborhood for now, and we're growing one block at a time. You're on our list, and this account will be ready the moment we reach you.
        </p>
        <p style={{ fontSize: '16px', color: 'var(--a-muted)', marginBottom: '30px', lineHeight: '1.6' }}>
          In the meantime, you're welcome to pick up in NoMad, or to have your order brought anywhere in Manhattan by messenger, at cost. Write to us at <a href="mailto:info@dinnerwithcharles.com" style={{ color: 'var(--a-green)' }}>info@dinnerwithcharles.com</a> and we'll set you up.
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
