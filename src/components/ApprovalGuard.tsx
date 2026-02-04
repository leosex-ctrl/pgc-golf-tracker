'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface ApprovalGuardProps {
  children: React.ReactNode
}

export default function ApprovalGuard({ children }: ApprovalGuardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isApproved, setIsApproved] = useState(false)

  useEffect(() => {
    checkApprovalStatus()
  }, [])

  const checkApprovalStatus = async () => {
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
        .select('approval_status')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', profileError)
        // If no profile, might be a new user - let them through to complete registration
        setIsApproved(true)
        setIsLoading(false)
        return
      }

      // Debug: Log the raw approval status
      console.log('[ApprovalGuard] Raw profile:', profile)
      console.log('[ApprovalGuard] Raw approval_status:', profile?.approval_status)

      // Normalize status: lowercase and replace spaces with underscores
      const rawStatus = profile?.approval_status || 'pending'
      const status = rawStatus.toLowerCase().replace(/\s+/g, '_')

      console.log('[ApprovalGuard] Normalized status:', status)

      if (status === 'approved') {
        setIsApproved(true)
      } else if (status === 'rejected') {
        // Redirect rejected users to a rejection page or login
        router.push('/login?rejected=true')
        return
      } else {
        // Pending - redirect to waiting page
        router.push('/pending-approval')
        return
      }

    } catch (err) {
      console.error('Error checking approval status:', err)
      // On error, allow through but log it
      setIsApproved(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: '#1B4D3E' }}
      >
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-white/20 rounded-full animate-spin mx-auto mb-4"
            style={{ borderTopColor: '#C9A227' }}
          />
          <p className="text-white/60">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!isApproved) {
    return null
  }

  return <>{children}</>
}
