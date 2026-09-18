import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import GuestApp from './components/GuestApp'
import AdminApp from './components/AdminApp'
import SignupApp from './components/SignupApp'
import PendingApprovalApp from './components/PendingApprovalApp'
import RejectedApp from './components/RejectedApp'

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
      return <RejectedApp user={user} onLogout={handleLogout} />
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
    <div style={{ minHeight: '100vh', background: '#faf8f3', padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '600px', textAlign: 'center' }}>
        <img src="/Green Horizontal Logo.png" alt="Dinner with Charles" style={{ maxWidth: '280px', height: 'auto', marginBottom: '40px' }} />
        
        <h1 style={{ color: '#1B5E4E', marginBottom: '30px', fontSize: '28px' }}>Welcome to Dinner with Charles</h1>
        
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '40px', lineHeight: '1.6' }}>
          Your own private chef, cooking for your family the way we cook for ours.
        </p>
        
        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          <button 
            onClick={() => setScreen('login')} 
            style={{ padding: '12px 24px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
          >
            Sign In
          </button>
          
          <button 
            onClick={() => setScreen('signup')} 
            style={{ padding: '12px 24px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
          >
            Request to Join
          </button>
        </div>
      </div>

      {screen === 'login' && (
        <LoginForm onSuccess={() => setScreen('app')} onBack={() => setScreen('landing')} />
      )}
    </div>
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
        <h2 style={{ color: '#1B5E4E', marginBottom: '24px' }}>Sign In</h2>
        
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
          
          {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
          
          <button 
            type="submit" 
            style={{ width: '100%', padding: '12px', background: '#1B5E4E', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}
          >
            Sign In
          </button>
          
          <button 
            type="button" 
            onClick={onBack} 
            style={{ width: '100%', padding: '12px', background: '#D4A373', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
          >
            Back
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
