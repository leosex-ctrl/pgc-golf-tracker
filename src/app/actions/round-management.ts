'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================
// TYPES
// ============================================

interface ActionResult {
  success: boolean
  error?: string
}

// ============================================
// HELPER: Create Supabase client
// ============================================

async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  )
}

// ============================================
// HELPER: Check if user is admin
// ============================================

async function getCurrentUserWithPermissions() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, isAdmin: false, isSuperAdmin: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const rawRole = profile?.role || ''
  const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')
  const isAdmin = ['admin', 'super_admin'].includes(normalizedRole)
  const isSuperAdmin = normalizedRole === 'super_admin'

  return { user, isAdmin, isSuperAdmin }
}

// ============================================
// DELETE ROUND
// ============================================

export async function deleteRound(roundId: string): Promise<ActionResult> {
  try {
    const { user, isAdmin } = await getCurrentUserWithPermissions()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // First, check if the round exists and get its owner
    const { data: round, error: fetchError } = await supabase
      .from('rounds')
      .select('id, user_id')
      .eq('id', roundId)
      .single()

    if (fetchError || !round) {
      return { success: false, error: 'Round not found' }
    }

    // Check permissions: must be owner or admin
    const isOwner = round.user_id === user.id
    if (!isOwner && !isAdmin) {
      return { success: false, error: 'You do not have permission to delete this round' }
    }

    // Delete associated scores first (cascade should handle this, but being explicit)
    const { error: scoresError } = await supabase
      .from('round_scores')
      .delete()
      .eq('round_id', roundId)

    if (scoresError) {
      console.error('Error deleting round scores:', scoresError)
      // Continue anyway - the round delete might still work
    }

    // Delete the round
    const { error: deleteError } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId)

    if (deleteError) {
      return { success: false, error: `Failed to delete round: ${deleteError.message}` }
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/rounds')
    revalidatePath('/dashboard/stats')

    return { success: true }

  } catch (error: any) {
    console.error('Delete round error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred' }
  }
}
