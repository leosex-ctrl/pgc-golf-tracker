'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Clock, LogOut, RefreshCw } from 'lucide-react'

// ============================================
// CONSTANTS - PGC Corporate Theme
// ============================================

const PGC_DARK_GREEN = '#0D4D2B'
const PGC_GOLD = '#C9A227'

// ============================================
// COMPONENT
// ============================================

export default function PendingApprovalPage() {
  const router = useRouter()
  const [userName, setUserName] = useState<string>('')
  const [isChecking, setIsChecking] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    checkUserStatus()
  }, [])

  const checkUserStatus = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      // Get profile with approval status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, approval_status')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        return
      }

      setUserName(profile?.full_name || 'Member')

      // If approved, redirect to dashboard
      if (profile?.approval_status?.toLowerCase() === 'approved') {
        router.push('/dashboard')
        return
      }

      // If rejected, show a different message or redirect
      if (profile?.approval_status?.toLowerCase() === 'rejected') {
        // Could redirect to a rejection page or show different UI
      }

    } catch (err) {
      console.error('Error checking user status:', err)
    }
  }

  const handleRefresh = async () => {
    setIsChecking(true)
    await checkUserStatus()
    setIsChecking(false)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Logout error:', err)
      setIsLoggingOut(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#1B4D3E' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          backgroundColor: PGC_DARK_GREEN,
          border: `2px solid ${PGC_GOLD}`,
          boxShadow: `0 0 60px rgba(201, 162, 39, 0.2)`,
        }}
      >
        {/* Logo */}
        <div
          className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center font-bold text-2xl mb-6"
          style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
        >
          PGC
        </div>

        {/* Clock Icon */}
        <div
          className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${PGC_GOLD}20`, border: `2px solid ${PGC_GOLD}` }}
        >
          <Clock className="w-10 h-10" style={{ color: PGC_GOLD }} />
        </div>

        {/* Title */}
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: PGC_GOLD }}
        >
          Awaiting Approval
        </h1>

        {/* Message */}
        <p className="text-white/70 mb-6">
          Welcome, <span className="font-semibold text-white">{userName}</span>!
        </p>
        <p className="text-white/60 text-sm mb-8">
          Your membership request is currently pending review by an administrator.
          You&apos;ll receive access to the dashboard once your account has been approved.
        </p>

        {/* Info Box */}
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          <h3 className="text-sm font-semibold text-white/80 mb-2">What happens next?</h3>
          <ul className="text-sm text-white/60 space-y-2">
            <li className="flex items-start gap-2">
              <span style={{ color: PGC_GOLD }}>1.</span>
              <span>An admin will review your registration</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: PGC_GOLD }}>2.</span>
              <span>Once approved, you&apos;ll have full access</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: PGC_GOLD }}>3.</span>
              <span>Check back here or refresh to see updates</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={isChecking}
            className="w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
          >
            <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking Status...' : 'Check Status'}
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
          >
            <LogOut className="w-5 h-5" />
            {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>

        {/* Contact Info */}
        <p className="text-xs text-white/40 mt-6">
          Questions? Contact the club administrator.
        </p>
      </div>
    </div>
  )
}
