'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ============================================
// TYPES
// ============================================

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  handicap_index: number | null;
  approval_status: string;
  created_at: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

// ============================================
// SERVER CLIENT
// ============================================

async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}

// ============================================
// HELPER: LOG AUDIT ACTION
// ============================================

async function logAuditAction(
  supabase: any,
  actorId: string,
  action: string,
  targetUserId: string,
  details: Record<string, any>
) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: actorId,
      action,
      target_user_id: targetUserId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't fail the main operation if audit logging fails
  }
}

// ============================================
// GET CURRENT USER & CHECK PERMISSIONS
// ============================================

async function getCurrentUserWithPermissions(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, error: 'Not authenticated' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { user, profile: null, error: 'Profile not found' };
  }

  // Normalize role: lowercase and replace spaces with underscores
  const rawRole = profile.role || '';
  const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_');

  console.log('[UserManagement] Raw role:', rawRole, '| Normalized:', normalizedRole);

  const isAdmin = ['admin', 'super_admin'].includes(normalizedRole);
  const isSuperAdmin = normalizedRole === 'super_admin';

  return { user, profile, isAdmin, isSuperAdmin, error: null };
}

// ============================================
// APPROVE USER
// ============================================

export async function approveUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { user, profile, isAdmin, error } = await getCurrentUserWithPermissions(supabase);

    if (error || !isAdmin) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Update user's approval status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: `Failed to approve user: ${updateError.message}` };
    }

    // Log the action
    await logAuditAction(supabase, user!.id, 'USER_APPROVED', userId, {
      approved_by: profile.full_name,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/dashboard/admin/users');
    return { success: true };

  } catch (error: any) {
    console.error('Approve user error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

// ============================================
// REJECT USER
// ============================================

export async function rejectUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { user, profile, isAdmin, error } = await getCurrentUserWithPermissions(supabase);

    if (error || !isAdmin) {
      return { success: false, error: 'Unauthorized: Admin access required' };
    }

    // Update user's approval status to rejected
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: `Failed to reject user: ${updateError.message}` };
    }

    // Log the action
    await logAuditAction(supabase, user!.id, 'USER_REJECTED', userId, {
      rejected_by: profile.full_name,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/dashboard/admin/users');
    return { success: true };

  } catch (error: any) {
    console.error('Reject user error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

// ============================================
// PROMOTE USER TO ADMIN (Super Admin Only)
// ============================================

export async function promoteUserToAdmin(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { user, profile, isSuperAdmin, error } = await getCurrentUserWithPermissions(supabase);

    if (error || !isSuperAdmin) {
      return { success: false, error: 'Unauthorized: Super Admin access required' };
    }

    // Get target user's current role
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return { success: false, error: 'User not found' };
    }

    const previousRole = targetUser.role;

    // Update user's role to Admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'Admin' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: `Failed to promote user: ${updateError.message}` };
    }

    // Log the action
    await logAuditAction(supabase, user!.id, 'USER_PROMOTED', userId, {
      promoted_by: profile.full_name,
      previous_role: previousRole,
      new_role: 'Admin',
      target_user_name: targetUser.full_name,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/dashboard/admin/users');
    return { success: true };

  } catch (error: any) {
    console.error('Promote user error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

// ============================================
// DEMOTE ADMIN TO USER (Super Admin Only)
// ============================================

export async function demoteAdminToUser(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { user, profile, isSuperAdmin, error } = await getCurrentUserWithPermissions(supabase);

    if (error || !isSuperAdmin) {
      return { success: false, error: 'Unauthorized: Super Admin access required' };
    }

    // Get target user's current role
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return { success: false, error: 'User not found' };
    }

    const previousRole = targetUser.role;

    // Prevent demoting Super Admins (normalize role check)
    const targetRoleNormalized = (targetUser.role || '').toLowerCase().replace(/\s+/g, '_');
    if (targetRoleNormalized === 'super_admin') {
      return { success: false, error: 'Cannot demote a Super Admin' };
    }

    // Update user's role to Regular User
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'User' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: `Failed to demote user: ${updateError.message}` };
    }

    // Log the action
    await logAuditAction(supabase, user!.id, 'USER_DEMOTED', userId, {
      demoted_by: profile.full_name,
      previous_role: previousRole,
      new_role: 'User',
      target_user_name: targetUser.full_name,
      timestamp: new Date().toISOString(),
    });

    revalidatePath('/dashboard/admin/users');
    return { success: true };

  } catch (error: any) {
    console.error('Demote user error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

// ============================================
// PROMOTE USER TO SUPER ADMIN (Super Admin Only)
// This is for handover of Super Admin privileges
// ============================================

export async function promoteUserToSuperAdmin(userId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { user, profile, isSuperAdmin, error } = await getCurrentUserWithPermissions(supabase);

    if (error || !isSuperAdmin) {
      return { success: false, error: 'Unauthorized: Only Super Admins can promote to Super Admin' };
    }

    // Prevent self-promotion (already Super Admin)
    if (user!.id === userId) {
      return { success: false, error: 'You are already a Super Admin' };
    }

    // Get target user's current role
    const { data: targetUser, error: fetchError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return { success: false, error: 'User not found' };
    }

    const previousRole = targetUser.role;

    // Normalize to check if already Super Admin
    const targetRoleNormalized = (targetUser.role || '').toLowerCase().replace(/\s+/g, '_');
    if (targetRoleNormalized === 'super_admin') {
      return { success: false, error: 'User is already a Super Admin' };
    }

    // Update user's role to Super Admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'Super Admin' })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: `Failed to promote user to Super Admin: ${updateError.message}` };
    }

    // Log the action with detailed audit trail
    await logAuditAction(supabase, user!.id, 'SUPER_ADMIN_PROMOTION', userId, {
      promoted_by: profile.full_name,
      promoted_by_id: user!.id,
      previous_role: previousRole,
      new_role: 'Super Admin',
      target_user_name: targetUser.full_name,
      timestamp: new Date().toISOString(),
      action_type: 'SUPER_ADMIN_HANDOVER',
    });

    revalidatePath('/dashboard/admin/users');
    return { success: true };

  } catch (error: any) {
    console.error('Promote to Super Admin error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
