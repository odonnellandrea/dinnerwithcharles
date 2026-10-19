import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import GuestApp from './components/GuestApp'
import AdminApp from './components/AdminApp'
import SignupApp from './components/SignupApp'
import PendingApprovalApp from './components/PendingApprovalApp'
import RejectedApp from './components/RejectedApp'
import LandingPage from './components/LandingPage'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
)

function App() {
  const [user, setUser] = useState(null)
  const [approvalStatus, setApprovalStatus] = useState(null)
  const [screen, setScreen] = useState('landing')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  }

  // Check if admin
  if (user?.email === 'admin@dinnerwithcharles.com') {
    return <AdminApp onLogout={handleLogout} />
  }

  // Logged in but not admin
  if (user) {
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
      {screen === 'login' && (
        <LoginForm onSuccess={() => setScreen('app')} onBack={() => setScreen('landing')} />
      )}
    </>
  )
}

function LoginForm({ onSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
        <h2 style={{ color: '#1a441f', marginBottom: '24px' }}>Sign In</h2>
        
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
      </div>
    </div>
  )
}

export default App
