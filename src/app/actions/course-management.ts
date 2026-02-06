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

interface UpdateCourseData {
  name?: string
  par?: number
  rating?: number | null
  slope?: number | null
  location?: string | null
  course_type?: string | null
  tee_color?: string | null
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
// DELETE COURSE (with safety check)
// ============================================

export async function deleteCourse(courseId: string): Promise<ActionResult> {
  try {
    const { user, isAdmin } = await getCurrentUserWithPermissions()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Only admins can delete courses
    if (!isAdmin) {
      return { success: false, error: 'Only administrators can delete courses' }
    }

    const supabase = await createClient()

    // Safety check: Count rounds associated with this course
    const { count, error: countError } = await supabase
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)

    if (countError) {
      return { success: false, error: `Failed to check course usage: ${countError.message}` }
    }

    // If rounds exist, prevent deletion
    if (count && count > 0) {
      return {
        success: false,
        error: `Cannot delete this course. It has ${count} round${count === 1 ? '' : 's'} associated with it. Edit the course instead.`
      }
    }

    // Safe to delete - no rounds associated
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)

    if (deleteError) {
      return { success: false, error: `Failed to delete course: ${deleteError.message}` }
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/courses')
    revalidatePath('/dashboard/add-round')

    return { success: true }

  } catch (error: any) {
    console.error('Delete course error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred' }
  }
}

// ============================================
// UPDATE COURSE
// ============================================

export async function updateCourse(courseId: string, data: UpdateCourseData): Promise<ActionResult> {
  try {
    const { user, isAdmin } = await getCurrentUserWithPermissions()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Only admins can update courses
    if (!isAdmin) {
      return { success: false, error: 'Only administrators can edit courses' }
    }

    const supabase = await createClient()

    // Check if course exists
    const { data: existingCourse, error: fetchError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .single()

    if (fetchError || !existingCourse) {
      return { success: false, error: 'Course not found' }
    }

    // If renaming, check for duplicate names
    if (data.name) {
      const { data: duplicateCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('name', data.name)
        .neq('id', courseId)
        .single()

      if (duplicateCourse) {
        return { success: false, error: 'A course with this name already exists' }
      }
    }

    // Update the course
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        ...(data.name && { name: data.name }),
        ...(data.par !== undefined && { par: data.par }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.slope !== undefined && { slope: data.slope }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.course_type !== undefined && { course_type: data.course_type }),
        ...(data.tee_color !== undefined && { tee_color: data.tee_color }),
      })
      .eq('id', courseId)

    if (updateError) {
      return { success: false, error: `Failed to update course: ${updateError.message}` }
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/courses')
    revalidatePath('/dashboard/add-round')

    return { success: true }

  } catch (error: any) {
    console.error('Update course error:', error)
    return { success: false, error: error.message || 'An unexpected error occurred' }
  }
}
