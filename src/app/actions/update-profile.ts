'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

interface ActionResult {
  success: boolean
  error?: string
}

export interface UpdateProfileData {
  full_name: string
  home_club: string
  handicap_index: number | null
  gui_number: string
}

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

export async function updateProfile(data: UpdateProfileData): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        home_club: data.home_club,
        handicap_index: data.handicap_index,
        gui_number: data.gui_number,
      })
      .eq('id', user.id)

    if (updateError) {
      return { success: false, error: `Failed to update profile: ${updateError.message}` }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')

    return { success: true }

  } catch (error: any) {
    console.error('Update profile error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred' }
  }
}
