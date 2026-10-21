import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import GuestApp from './components/GuestApp'
import AdminApp from './components/AdminApp'
import SignupApp from './components/SignupApp'
import PendingApprovalApp from './components/PendingApprovalApp'
import RejectedApp from './components/RejectedApp'
import LandingPage from './components/LandingPage'
import PasswordForm from './components/PasswordForm'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

// Read the reset link's details now, before Supabase signs the user in and tidies up the URL
const linkParams = new URLSearchParams(window.location.hash.slice(1))
const OPENED_RESET_LINK = linkParams.get('type') === 'recovery'
const RESET_LINK_FAILED = linkParams.has('error') && !OPENED_RESET_LINK

function App() {
  const [user, setUser] = useState(null)
  const [approvalStatus, setApprovalStatus] = useState(null)
  const [screen, setScreen] = useState('landing')
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(OPENED_RESET_LINK)
  const [resetLinkFailed, setResetLinkFailed] = useState(RESET_LINK_FAILED)

  useEffect(() => {
    if (RESET_LINK_FAILED) window.history.replaceState(null, '', window.location.pathname)

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        const { data } = await supabase
          .from('users')
          .select('approval_status')
          .eq('id', session.user.id)
          .single()
        
        setApprovalStatus(data?.approval_status || 'pending')
      }
      setLoading(false)
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (session?.user) {
        setUser(session.user)
        // Fetch approval status when user logs in
        const { data } = await supabase
          .from('users')
          .select('approval_status')
          .eq('id', session.user.id)
          .single()
        setApprovalStatus(data?.approval_status || 'pending')
        setScreen('app')
      } else {
        setUser(null)
        setScreen('landing')
        setApprovalStatus(null)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setApprovalStatus(null)
    setScreen('landing')
  }

  const loadingScreen = <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>

  if (loading) {
    return loadingScreen
  }

  // Opened a password reset link: choose a new password before anything else
  if (recovering && user) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto' }}>
          <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ display: 'block', maxWidth: '220px', height: 'auto', margin: '0 auto 40px' }} />
          <PasswordForm
            title="Choose a new password"
            intro="You'll use it the next time you sign in."
            submitLabel="Save Password"
            onDone={() => {
              window.history.replaceState(null, '', window.location.pathname)
              setRecovering(false)
            }}
          />
        </div>
      </div>
    )
  }

  // Check if admin
  if (user?.email === 'admin@dinnerwithcharles.com') {
    return <AdminApp onLogout={handleLogout} />
  }

  // Logged in but not admin
  if (user) {
    // Signed in, but we haven't heard yet whether they're approved. Wait, rather than
    // flashing the "under review" screen at someone who is approved.
    if (approvalStatus === null) {
      return loadingScreen
    }
    if (approvalStatus === 'approved') {
      return <GuestApp user={user} onLogout={handleLogout} />
    } else if (approvalStatus === 'rejected') {
      return <RejectedApp user={user} onLogout={handleLogout} onResubmitted={() => setApprovalStatus('pending')} />
    } else {
      return <PendingApprovalApp user={user} onLogout={handleLogout} />
    }
  }

  // Not logged in
  if (screen === 'signup') {
    return <SignupApp onBack={() => setScreen('landing')} />
  }

  // Landing page
  return (
    <>
      <LandingPage onSignIn={() => setScreen('login')} onJoin={() => setScreen('signup')} />
      {(screen === 'login' || resetLinkFailed) && (
        <LoginForm
          onSuccess={() => setScreen('app')}
          onBack={() => { setResetLinkFailed(false); setScreen('landing') }}
          expiredLink={resetLinkFailed}
        />
      )}
    </>
  )
}

function LoginForm({ onSuccess, onBack, expiredLink = false }) {
  const [mode, setMode] = useState(expiredLink ? 'forgot' : 'signin') // 'signin' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(expiredLink ? 'That reset link has expired or was already used. Enter your email to get a new one.' : '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)
    // The link brings them back here, where App shows "Choose a new password"
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setSending(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      // Same message whether or not the email has an account
      setNotice("If there's an account for that email, a reset link is on its way. Check your inbox and spam folder.")
      setSent(true)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      setError(signInError.message)
    } else if (data.user) {
      onSuccess()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '12px', maxWidth: '400px', width: '90%' }}>
        <h2 style={{ color: '#1a441f', marginBottom: '24px' }}>{mode === 'forgot' ? 'Reset Password' : 'Sign In'}</h2>

        {mode === 'forgot' ? (
          <form onSubmit={handleForgot}>
            {notice && <p style={{ color: '#1a441f', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0' }}>{notice}</p>}
            {!sent && (
            <>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              Enter the email you signed up with and we'll send you a link to choose a new password.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }}
              required
            />
            {error && <p style={{ color: '#c62828', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
            <button
              type="submit"
              disabled={sending}
              style={{ width: '100%', padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: '500', marginBottom: '12px', opacity: sending ? 0.6 : 1 }}
            >
              {sending ? 'Sending...' : 'Send Reset Link'}
            </button>
            </>
            )}
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(''); setNotice(''); setSent(false) }}
              style={{ width: '100%', padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
            >
              Back to Sign In
            </button>
          </form>
        ) : (
        <form onSubmit={handleLogin}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }}
            required
          />
          
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '12px', border: '1px solid #e0dbd1', borderRadius: '6px', boxSizing: 'border-box' }}
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => { setMode('forgot'); setError('') }}
            style={{ display: 'block', margin: '-4px 0 16px auto', background: 'none', border: 'none', padding: 0, color: '#1a441f', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Forgot password?
          </button>

          {error && <p style={{ color: '#c62828', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
          
          <button 
            type="submit" 
            style={{ width: '100%', padding: '12px', background: '#1a441f', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}
          >
            Sign In
          </button>
          
          <button 
            type="button" 
            onClick={onBack} 
            style={{ width: '100%', padding: '12px', background: '#D4A373', color: '#faf8f3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
          >
            Back
          </button>
        </form>
        )}
      </div>
    </div>
  )
}

export default App
