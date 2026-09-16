import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import GuestApp from './components/GuestApp'
import AdminApp from './components/AdminApp'
import SignupApp from './components/SignupApp'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('signup-or-login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      })
      if (error) throw error
      setLoginEmail('')
      setLoginPassword('')
    } catch (err) {
      setLoginError(err.message || 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    setForgotSuccess('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin
      })
      if (error) throw error
      setForgotSuccess('Password reset link sent to your email!')
      setForgotEmail('')
    } catch (err) {
      setForgotError(err.message || 'Failed to send reset link')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setScreen('signup-or-login')
  }

  if (loading) return <div></div>

  if (user) {
    return <GuestApp onLogout={handleLogout} />
  }

  if (screen === 'signup') {
    return <SignupApp onSignupComplete={() => setScreen('signup-or-login')} />
  }

  if (screen === 'forgot-password') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#faf8f3', flexDirection: 'column', padding: '20px' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', marginBottom: '20px', display: 'block', margin: '0 auto 20px' }} />
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1B5E4E', fontSize: '24px', fontWeight: '600' }}>Reset Password</h2>
          {forgotError && <div style={{ color: '#d32f2f', marginBottom: '20px', padding: '12px', background: '#ffebee', borderRadius: '6px' }}>{forgotError}</div>}
          {forgotSuccess && <div style={{ color: '#2e7d32', marginBottom: '20px', padding: '12px', background: '#e8f5e9', borderRadius: '6px' }}>{forgotSuccess}</div>}
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Email</label>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <button type="submit" disabled={forgotLoading} style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', opacity: forgotLoading ? 0.5 : 1 }}>{forgotLoading ? 'Sending...' : 'Send Reset Link'}</button>
          </form>
          <button onClick={() => setScreen('login')} style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back to Sign In</button>
        </div>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#faf8f3', flexDirection: 'column', padding: '20px' }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '200px', marginBottom: '20px', display: 'block', margin: '0 auto 20px' }} />
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1B5E4E', fontSize: '24px', fontWeight: '600' }}>Sign In</h2>
          {loginError && <div style={{ color: '#d32f2f', marginBottom: '20px', padding: '12px', background: '#ffebee', borderRadius: '6px' }}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Email</label>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <button type="submit" disabled={loginLoading} style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', opacity: loginLoading ? 0.5 : 1 }}>{loginLoading ? 'Signing In...' : 'Sign In'}</button>
          </form>
          <button onClick={() => setScreen('forgot-password')} style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'transparent', color: '#1B5E4E', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>Forgot Password?</button>
          <button onClick={() => setScreen('signup-or-login')} style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#faf8f3', flexDirection: 'column', paddingTop: '40px' }}>
      <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '280px', marginBottom: '10px' }} />
      <p style={{ fontSize: '18px', color: '#D4A373', fontWeight: '600', margin: '0 0 40px 0' }}>Weekly Kitchen Orders</p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => setScreen('login')} style={{ padding: '12px 24px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Sign In</button>
        <button onClick={() => setScreen('signup')} style={{ padding: '12px 24px', background: 'white', color: '#1B5E4E', border: '2px solid #1B5E4E', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Create Account</button>
      </div>
    </div>
  )
}
