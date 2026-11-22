import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = { width: '100%', padding: '12px', border: '1px solid var(--a-border)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }

// Sets a new password for the signed-in user: from Settings, or after opening a reset link
export default function PasswordForm({ title, intro, submitLabel = 'Update Password', onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    // Same rules as signup
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setPassword('')
    setConfirmPassword('')
    setSaved(true)
    onDone?.()
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--a-surface)', padding: '24px', border: '1px solid var(--a-border)' }}>
      <h3 style={{ color: 'var(--a-green)', margin: '0 0 6px 0' }}>{title}</h3>
      {intro && <p style={{ fontSize: '13px', color: 'var(--a-muted)', margin: '0 0 20px 0' }}>{intro}</p>}

      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setSaved(false) }}
          style={inputStyle}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-muted)', fontSize: '12px', fontFamily: 'inherit' }}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => { setConfirmPassword(e.target.value); setSaved(false) }}
        style={{ ...inputStyle, marginBottom: '16px' }}
        required
      />

      {error && <p style={{ color: 'var(--a-bad-ink)', fontSize: '13px', margin: '0 0 16px 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: '12px 24px', background: 'var(--a-green)', color: 'var(--a-cream)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : submitLabel}
        </button>
        {saved && <span style={{ color: 'var(--a-green)', fontSize: '13px', fontWeight: '500' }}>✓ Password updated</span>}
      </div>
    </form>
  )
}
