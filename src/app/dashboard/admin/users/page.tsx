'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Users,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  ChevronDown,
  AlertCircle,
  Loader2,
  Crown,
  UserCog,
  AlertTriangle,
  X,
  Link2,
  Check,
} from 'lucide-react'
import {
  approveUser,
  rejectUser,
  promoteUserToAdmin,
  demoteAdminToUser,
  promoteUserToSuperAdmin,
} from '@/app/actions/user-management'

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
  handicap_index: number | null
  approval_status: string
  created_at: string
}

interface Squad {
  id: string
  name: string
  description: string | null
}

interface AdminSquad {
  id: string
  admin_id: string
  squad_id: string
}

type TabType = 'pending' | 'all' | 'squad-linker'

// ============================================
// CONSTANTS - PGC Corporate Theme
// ============================================

const PGC_DARK_GREEN = '#0D4D2B'
const PGC_GOLD = '#C9A227'

// ============================================
// COMPONENT
// ============================================

export default function AdminUsersPage() {
  const router = useRouter()

  // Auth & Access
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Data
  const [users, setUsers] = useState<UserProfile[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('pending')

  // Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Super Admin Promotion Modal
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false)
  const [pendingSuperAdminPromotion, setPendingSuperAdminPromotion] = useState<{
    userId: string
    userName: string
  } | null>(null)

  // Squad Linker State
  const [squads, setSquads] = useState<Squad[]>([])
  const [adminSquads, setAdminSquads] = useState<AdminSquad[]>([])
  const [selectedAdmin, setSelectedAdmin] = useState<UserProfile | null>(null)
  const [squadLinkLoading, setSquadLinkLoading] = useState<string | null>(null)

  useEffect(() => {
    checkAccessAndFetchData()
  }, [])

  const checkAccessAndFetchData = async () => {
    try {
      const supabase = createClient()

      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)

      // Check if user is Admin or Super Admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', JSON.stringify(profileError, null, 2))
        router.push('/dashboard')
        return
      }

      // Debug: Log the raw role value
      console.log('[AdminUsers] Raw profile:', profileData)
      console.log('[AdminUsers] Raw role:', profileData?.role)

      // Normalize role: lowercase and replace spaces with underscores
      const rawRole = profileData?.role || ''
      const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')

      console.log('[AdminUsers] Normalized role:', normalizedRole)

      const hasAccess = ['admin', 'super_admin'].includes(normalizedRole)

      if (!hasAccess) {
        console.log('[AdminUsers] Access denied - redirecting to dashboard')
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      setIsSuperAdmin(normalizedRole === 'super_admin')

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, handicap_index, approval_status, created_at')
        .order('created_at', { ascending: false })

      if (usersError) {
        console.error('Users fetch error:', JSON.stringify(usersError, null, 2))
      } else {
        setUsers(usersData || [])
      }

      // Fetch all squads (for Squad Linker)
      const { data: squadsData, error: squadsError } = await supabase
        .from('squads')
        .select('id, name, description')
        .order('name')

      if (squadsError) {
        console.error('Squads fetch error:', JSON.stringify(squadsError, null, 2))
      } else {
        setSquads(squadsData || [])
      }

      // Fetch all admin_squads associations
      const { data: adminSquadsData, error: adminSquadsError } = await supabase
        .from('admin_squads')
        .select('id, admin_id, squad_id')

      if (adminSquadsError) {
        console.error('Admin squads fetch error:', JSON.stringify(adminSquadsError, null, 2))
      } else {
        setAdminSquads(adminSquadsData || [])
      }

    } catch (err) {
      console.error('Admin users error:', JSON.stringify(err, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  const handleApprove = async (userId: string) => {
    setActionLoading(userId)
    setActionError(null)
    setActionSuccess(null)

    const result = await approveUser(userId)

    if (result.success) {
      setActionSuccess('User approved successfully')
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, approval_status: 'approved' } : u
      ))
    } else {
      setActionError(result.error || 'Failed to approve user')
    }

    setActionLoading(null)
    setTimeout(() => setActionSuccess(null), 3000)
  }

  const handleReject = async (userId: string) => {
    setActionLoading(userId)
    setActionError(null)
    setActionSuccess(null)

    const result = await rejectUser(userId)

    if (result.success) {
      setActionSuccess('User rejected')
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, approval_status: 'rejected' } : u
      ))
    } else {
      setActionError(result.error || 'Failed to reject user')
    }

    setActionLoading(null)
    setTimeout(() => setActionSuccess(null), 3000)
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    // If promoting to Super Admin, show confirmation modal first
    if (newRole === 'Super Admin') {
      const targetUser = users.find(u => u.id === userId)
      setPendingSuperAdminPromotion({
        userId,
        userName: targetUser?.full_name || 'Unknown User',
      })
      setShowSuperAdminModal(true)
      return
    }

    setActionLoading(userId)
    setActionError(null)
    setActionSuccess(null)

    let result
    if (newRole === 'Admin') {
      result = await promoteUserToAdmin(userId)
    } else {
      result = await demoteAdminToUser(userId)
    }

    if (result.success) {
      setActionSuccess(`User role updated to ${newRole}`)
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ))
    } else {
      setActionError(result.error || 'Failed to update role')
    }

    setActionLoading(null)
    setTimeout(() => setActionSuccess(null), 3000)
  }

  // Handle confirmed Super Admin promotion
  const handleConfirmSuperAdminPromotion = async () => {
    if (!pendingSuperAdminPromotion) return

    const { userId, userName } = pendingSuperAdminPromotion

    setShowSuperAdminModal(false)
    setActionLoading(userId)
    setActionError(null)
    setActionSuccess(null)

    const result = await promoteUserToSuperAdmin(userId)

    if (result.success) {
      setActionSuccess(`${userName} has been promoted to Super Admin`)
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: 'Super Admin' } : u
      ))
    } else {
      setActionError(result.error || 'Failed to promote to Super Admin')
    }

    setPendingSuperAdminPromotion(null)
    setActionLoading(null)
    setTimeout(() => setActionSuccess(null), 3000)
  }

  const handleCancelSuperAdminPromotion = () => {
    setShowSuperAdminModal(false)
    setPendingSuperAdminPromotion(null)
  }

  // ============================================
  // SQUAD LINKER HANDLERS
  // ============================================

  const handleSelectAdmin = (admin: UserProfile) => {
    setSelectedAdmin(admin)
  }

  const isSquadAssigned = (squadId: string): boolean => {
    if (!selectedAdmin) return false
    return adminSquads.some(
      (as) => as.admin_id === selectedAdmin.id && as.squad_id === squadId
    )
  }

  const handleToggleSquad = async (squadId: string) => {
    if (!selectedAdmin) return

    setSquadLinkLoading(squadId)
    setActionError(null)
    setActionSuccess(null)

    const supabase = createClient()
    const isCurrentlyAssigned = isSquadAssigned(squadId)

    try {
      if (isCurrentlyAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('admin_squads')
          .delete()
          .eq('admin_id', selectedAdmin.id)
          .eq('squad_id', squadId)

        if (error) {
          console.error('Error removing squad assignment:', JSON.stringify(error, null, 2))
          setActionError('Failed to remove squad assignment')
        } else {
          setActionSuccess('Squad assignment removed')
          // Update local state
          setAdminSquads((prev) =>
            prev.filter(
              (as) => !(as.admin_id === selectedAdmin.id && as.squad_id === squadId)
            )
          )
        }
      } else {
        // Add assignment
        const { data, error } = await supabase
          .from('admin_squads')
          .insert({
            admin_id: selectedAdmin.id,
            squad_id: squadId,
          })
          .select()
          .single()

        if (error) {
          console.error('Error adding squad assignment:', JSON.stringify(error, null, 2))
          setActionError('Failed to add squad assignment')
        } else {
          setActionSuccess('Squad assigned successfully')
          // Update local state
          setAdminSquads((prev) => [...prev, data])
        }
      }
    } catch (err) {
      console.error('Squad toggle error:', JSON.stringify(err, null, 2))
      setActionError('An unexpected error occurred')
    } finally {
      setSquadLinkLoading(null)
      setTimeout(() => setActionSuccess(null), 3000)
    }
  }

  const getAdminAssignedSquadsCount = (adminId: string): number => {
    return adminSquads.filter((as) => as.admin_id === adminId).length
  }

  // ============================================
  // FILTERED DATA
  // ============================================

  const pendingUsers = users.filter(u => u.approval_status?.toLowerCase() === 'pending')
  const displayUsers = activeTab === 'pending' ? pendingUsers : users

  // Get all admins for Squad Linker (both Admin and Super Admin roles)
  const adminUsers = users.filter((u) => {
    const role = (u.role || '').toLowerCase().replace(/\s+/g, '_')
    return role === 'admin' || role === 'super_admin'
  })

  // ============================================
  // HELPERS
  // ============================================

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || 'pending'
    switch (s) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
    }
  }

  const getRoleBadge = (role: string) => {
    // Normalize role: lowercase and replace spaces with underscores
    const r = (role || 'user').toLowerCase().replace(/\s+/g, '_')
    switch (r) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${PGC_GOLD}30`, color: PGC_GOLD }}>
            <Crown className="w-3 h-3" />
            Super Admin
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
            <Shield className="w-3 h-3" />
            Admin
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
            <Users className="w-3 h-3" />
            User
          </span>
        )
    }
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-white/20 rounded-full animate-spin mx-auto mb-4"
            style={{ borderTopColor: PGC_GOLD }}
          />
          <p className="text-white/60">Loading User Management...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${PGC_GOLD}33` }}
          >
            <UserCog className="w-6 h-6" style={{ color: PGC_GOLD }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: PGC_GOLD }}>
                User Management
              </h1>
              <Shield className="w-5 h-5" style={{ color: PGC_GOLD }} />
            </div>
            <p className="text-white/60 mt-1">Manage user approvals and roles</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div
            className="px-4 py-2 rounded-lg text-center"
            style={{ backgroundColor: `${PGC_GOLD}20` }}
          >
            <p className="text-2xl font-bold" style={{ color: PGC_GOLD }}>{pendingUsers.length}</p>
            <p className="text-xs text-white/60">Pending</p>
          </div>
          <div className="px-4 py-2 rounded-lg text-center bg-white/10">
            <p className="text-2xl font-bold text-white">{users.length}</p>
            <p className="text-xs text-white/60">Total Users</p>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {actionSuccess && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)' }}
        >
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-200">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          className="p-4 rounded-xl flex items-center justify-between"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-200">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-200 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
      >
        <div className="flex" style={{ borderBottom: `1px solid ${PGC_GOLD}30` }}>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2`}
            style={{
              backgroundColor: activeTab === 'pending' ? `${PGC_GOLD}20` : 'transparent',
              color: activeTab === 'pending' ? PGC_GOLD : 'rgba(255,255,255,0.6)',
              borderBottom: activeTab === 'pending' ? `2px solid ${PGC_GOLD}` : '2px solid transparent',
            }}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
            {pendingUsers.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
              >
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2`}
            style={{
              backgroundColor: activeTab === 'all' ? `${PGC_GOLD}20` : 'transparent',
              color: activeTab === 'all' ? PGC_GOLD : 'rgba(255,255,255,0.6)',
              borderBottom: activeTab === 'all' ? `2px solid ${PGC_GOLD}` : '2px solid transparent',
            }}
          >
            <Users className="w-4 h-4" />
            All Users
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('squad-linker')}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2`}
              style={{
                backgroundColor: activeTab === 'squad-linker' ? `${PGC_GOLD}20` : 'transparent',
                color: activeTab === 'squad-linker' ? PGC_GOLD : 'rgba(255,255,255,0.6)',
                borderBottom: activeTab === 'squad-linker' ? `2px solid ${PGC_GOLD}` : '2px solid transparent',
              }}
            >
              <Link2 className="w-4 h-4" />
              Squad Linker
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'squad-linker' ? (
            // ============================================
            // SQUAD LINKER VIEW
            // ============================================
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Admin List */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" style={{ color: PGC_GOLD }} />
                  Select an Admin
                </h3>
                {adminUsers.length === 0 ? (
                  <div
                    className="text-center py-8 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <Shield className="w-12 h-12 mx-auto mb-3 text-white/30" />
                    <p className="text-white/50">No admins found</p>
                    <p className="text-sm text-white/30 mt-1">
                      Promote users to Admin role first
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {adminUsers.map((admin) => {
                      const assignedCount = getAdminAssignedSquadsCount(admin.id)
                      const isSelected = selectedAdmin?.id === admin.id

                      return (
                        <button
                          key={admin.id}
                          onClick={() => handleSelectAdmin(admin)}
                          className={`w-full p-4 rounded-xl text-left transition-all ${
                            isSelected ? 'ring-2' : 'hover:bg-white/10'
                          }`}
                          style={{
                            backgroundColor: isSelected
                              ? `${PGC_GOLD}20`
                              : 'rgba(255,255,255,0.05)',
                            ringColor: isSelected ? PGC_GOLD : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                              style={{
                                backgroundColor: isSelected
                                  ? PGC_GOLD
                                  : `${PGC_GOLD}30`,
                                color: isSelected ? PGC_DARK_GREEN : PGC_GOLD,
                              }}
                            >
                              {admin.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">
                                {admin.full_name || 'Unknown'}
                              </p>
                              <p className="text-sm text-white/50 truncate">
                                {admin.email}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor:
                                    assignedCount > 0
                                      ? `${PGC_GOLD}30`
                                      : 'rgba(255,255,255,0.1)',
                                  color:
                                    assignedCount > 0 ? PGC_GOLD : 'rgba(255,255,255,0.5)',
                                }}
                              >
                                {assignedCount} squad{assignedCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Squad Assignment */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: PGC_GOLD }} />
                  Assign Squads
                </h3>
                {!selectedAdmin ? (
                  <div
                    className="text-center py-8 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <Link2 className="w-12 h-12 mx-auto mb-3 text-white/30" />
                    <p className="text-white/50">Select an admin to manage squads</p>
                  </div>
                ) : squads.length === 0 ? (
                  <div
                    className="text-center py-8 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <Users className="w-12 h-12 mx-auto mb-3 text-white/30" />
                    <p className="text-white/50">No squads available</p>
                    <p className="text-sm text-white/30 mt-1">
                      Create squads in the Squads section first
                    </p>
                  </div>
                ) : (
                  <div>
                    <div
                      className="p-3 rounded-lg mb-4 flex items-center gap-3"
                      style={{ backgroundColor: `${PGC_GOLD}15` }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                        style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
                      >
                        {selectedAdmin.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {selectedAdmin.full_name}
                        </p>
                        <p className="text-xs text-white/50">
                          Managing squad access
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                      {squads.map((squad) => {
                        const isAssigned = isSquadAssigned(squad.id)
                        const isLoading = squadLinkLoading === squad.id

                        return (
                          <button
                            key={squad.id}
                            onClick={() => handleToggleSquad(squad.id)}
                            disabled={isLoading}
                            className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                              isLoading ? 'opacity-50' : 'hover:bg-white/10'
                            }`}
                            style={{
                              backgroundColor: isAssigned
                                ? 'rgba(34, 197, 94, 0.15)'
                                : 'rgba(255,255,255,0.05)',
                              border: isAssigned
                                ? '1px solid rgba(34, 197, 94, 0.4)'
                                : '1px solid transparent',
                            }}
                          >
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                                isLoading ? 'animate-pulse' : ''
                              }`}
                              style={{
                                backgroundColor: isAssigned
                                  ? '#22C55E'
                                  : 'rgba(255,255,255,0.1)',
                                border: isAssigned
                                  ? 'none'
                                  : '2px solid rgba(255,255,255,0.3)',
                              }}
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              ) : isAssigned ? (
                                <Check className="w-4 h-4 text-white" />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white">
                                {squad.name}
                              </p>
                              {squad.description && (
                                <p className="text-sm text-white/50 truncate">
                                  {squad.description}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${PGC_GOLD}20` }}
              >
                {activeTab === 'pending' ? (
                  <CheckCircle className="w-8 h-8" style={{ color: PGC_GOLD }} />
                ) : (
                  <Users className="w-8 h-8" style={{ color: PGC_GOLD }} />
                )}
              </div>
              <p className="text-white/60">
                {activeTab === 'pending'
                  ? 'No pending approvals'
                  : 'No users found'}
              </p>
            </div>
          ) : activeTab === 'pending' ? (
            // ============================================
            // PENDING APPROVALS VIEW
            // ============================================
            <div className="space-y-4">
              {displayUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{ backgroundColor: `${PGC_GOLD}30`, color: PGC_GOLD }}
                      >
                        {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.full_name || 'Unknown'}</p>
                        <p className="text-sm text-white/50">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-white/50">
                      <span>
                        Joined: {new Date(user.created_at).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {user.handicap_index !== null && (
                        <span>HCP: {user.handicap_index.toFixed(1)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#22C55E', color: 'white' }}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(user.id)}
                      disabled={actionLoading === user.id}
                      className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#EF4444', color: 'white' }}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserX className="w-4 h-4" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ============================================
            // ALL USERS TABLE VIEW
            // ============================================
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `${PGC_GOLD}15` }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Role
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Handicap
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Status
                    </th>
                    {isSuperAdmin && (
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayUsers.map((user) => {
                    // Normalize role: lowercase and replace spaces with underscores
                    const userRole = (user.role || 'user').toLowerCase().replace(/\s+/g, '_')
                    const canChangeRole = isSuperAdmin && user.id !== currentUserId && userRole !== 'super_admin'

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-white/5 transition-colors"
                        style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.1)' }}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{ backgroundColor: `${PGC_GOLD}30`, color: PGC_GOLD }}
                            >
                              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-white">{user.full_name || 'Unknown'}</p>
                              <p className="text-xs text-white/40">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {getRoleBadge(user.role)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-white/70">
                            {user.handicap_index !== null ? user.handicap_index.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(user.approval_status)}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-4 text-center">
                            {canChangeRole ? (
                              <div className="relative inline-block">
                                <select
                                  value={
                                    userRole === 'super_admin' ? 'Super Admin' :
                                    userRole === 'admin' ? 'Admin' : 'User'
                                  }
                                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                  disabled={actionLoading === user.id}
                                  className="appearance-none px-3 py-1.5 pr-8 rounded-lg text-sm font-medium bg-white/10 text-white border cursor-pointer focus:outline-none disabled:opacity-50"
                                  style={{ borderColor: `${PGC_GOLD}40` }}
                                >
                                  <option value="User" style={{ backgroundColor: PGC_DARK_GREEN }}>User</option>
                                  <option value="Admin" style={{ backgroundColor: PGC_DARK_GREEN }}>Admin</option>
                                  {/* Super Admin option - only shown to current Super Admins */}
                                  <option value="Super Admin" style={{ backgroundColor: PGC_DARK_GREEN }}>Super Admin</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                              </div>
                            ) : (
                              <span className="text-white/30 text-sm">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Super Admin Promotion Confirmation Modal */}
      {showSuperAdminModal && pendingSuperAdminPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCancelSuperAdminPromotion}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-2xl p-6"
            style={{
              backgroundColor: PGC_DARK_GREEN,
              border: `2px solid ${PGC_GOLD}`,
              boxShadow: '0 0 60px rgba(201, 162, 39, 0.3)',
            }}
          >
            {/* Close Button */}
            <button
              onClick={handleCancelSuperAdminPromotion}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            {/* Warning Icon */}
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', border: '2px solid #F59E0B' }}
            >
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-center mb-2 text-white">
              Promote to Super Admin?
            </h2>

            {/* User Name */}
            <p className="text-center mb-4">
              <span className="text-white/60">You are about to promote </span>
              <span className="font-semibold" style={{ color: PGC_GOLD }}>
                {pendingSuperAdminPromotion.userName}
              </span>
              <span className="text-white/60"> to Super Admin.</span>
            </p>

            {/* Warning Message */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <p className="text-sm text-amber-200 text-center">
                <strong>Warning:</strong> This user will have <strong>full control</strong> over the system,
                including the ability to manage all users, approve memberships, and access all administrative functions.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelSuperAdminPromotion}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-all hover:bg-white/10"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuperAdminPromotion}
                className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#F59E0B', color: '#1a1a1a' }}
              >
                <Crown className="w-4 h-4" />
                Confirm Promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
