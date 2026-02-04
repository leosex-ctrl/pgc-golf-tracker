'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Plus, X, UserPlus, Trash2, Check } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string
  full_name: string
  handicap_index: number | null
  avatar_url: string | null
}

interface SquadMember {
  id: string
  user_id: string
  profiles: Profile
}

interface Squad {
  id: string
  name: string
  description: string | null
  created_at: string
  squad_members: SquadMember[]
}

// ============================================
// COMPONENT
// ============================================

export default function SquadsPage() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)

  // Form states
  const [newSquadName, setNewSquadName] = useState('')
  const [newSquadDescription, setNewSquadDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const supabase = createClient()

      // ============================================
      // STEP 1: Fetch all squads
      // ============================================
      const { data: squadsData, error: squadsError } = await supabase
        .from('squads')
        .select('*')
        .order('name')

      if (squadsError) {
        console.error('Error fetching squads:', JSON.stringify(squadsError, null, 2))
        setError('Failed to load squads')
        setIsLoading(false)
        return
      }

      // ============================================
      // STEP 2: Fetch all squad members with profiles
      // ============================================
      const { data: membersData, error: membersError } = await supabase
        .from('squad_members')
        .select('*, profiles(*)')

      if (membersError) {
        console.error('Error fetching squad members:', JSON.stringify(membersError, null, 2))
        setError('Failed to load squad members')
        setIsLoading(false)
        return
      }

      // ============================================
      // STEP 3: Fetch all profiles for adding players
      // ============================================
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, handicap_index, avatar_url')
        .order('full_name')

      if (profilesError) {
        console.error('Error fetching profiles:', JSON.stringify(profilesError, null, 2))
      }

      // ============================================
      // STEP 4: Manually map members into squads
      // ============================================
      const membersMap = new Map<string, SquadMember[]>()

      ;(membersData || []).forEach((member: any) => {
        const squadId = member.squad_id
        if (!membersMap.has(squadId)) {
          membersMap.set(squadId, [])
        }
        membersMap.get(squadId)!.push({
          id: member.id,
          user_id: member.user_id,
          profiles: member.profiles as Profile,
        })
      })

      // Build squads with their members
      const squadsWithMembers: Squad[] = (squadsData || []).map((squad: any) => ({
        id: squad.id,
        name: squad.name,
        description: squad.description,
        created_at: squad.created_at,
        squad_members: membersMap.get(squad.id) || [],
      }))

      // ============================================
      // STEP 5: Deduplicate squads by name (keep first occurrence)
      // ============================================
      const seenNames = new Set<string>()
      const uniqueSquads = squadsWithMembers.filter((squad) => {
        if (seenNames.has(squad.name)) {
          return false
        }
        seenNames.add(squad.name)
        return true
      })

      setSquads(uniqueSquads)
      setAllProfiles((profilesData as Profile[]) || [])

    } catch (err) {
      console.error('Squads error:', JSON.stringify(err, null, 2))
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSquad = async () => {
    if (!newSquadName.trim()) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('squads')
        .insert({
          name: newSquadName.trim(),
          description: newSquadDescription.trim() || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating squad:', JSON.stringify(error, null, 2))
        setError('Failed to create squad')
        return
      }

      // Refresh data
      await fetchData()
      setShowCreateModal(false)
      setNewSquadName('')
      setNewSquadDescription('')

    } catch (err) {
      console.error('Create squad error:', JSON.stringify(err, null, 2))
      setError('Failed to create squad')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddPlayer = async (profileId: string) => {
    if (!selectedSquad) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('squad_members')
        .insert({
          squad_id: selectedSquad.id,
          user_id: profileId,
        })

      if (error) {
        console.error('Error adding player:', JSON.stringify(error, null, 2))
        setError('Failed to add player')
        return
      }

      // Refresh data
      await fetchData()
      setShowAddPlayerModal(false)
      setSelectedSquad(null)

    } catch (err) {
      console.error('Add player error:', JSON.stringify(err, null, 2))
      setError('Failed to add player')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemovePlayer = async (memberId: string) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('squad_members')
        .delete()
        .eq('id', memberId)

      if (error) {
        console.error('Error removing player:', JSON.stringify(error, null, 2))
        setError('Failed to remove player')
        return
      }

      // Refresh data
      await fetchData()

    } catch (err) {
      console.error('Remove player error:', JSON.stringify(err, null, 2))
      setError('Failed to remove player')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAddPlayerModal = (squad: Squad) => {
    setSelectedSquad(squad)
    setShowAddPlayerModal(true)
  }

  // Get available players (not already in the selected squad)
  const getAvailablePlayers = () => {
    if (!selectedSquad) return allProfiles

    const memberIds = selectedSquad.squad_members.map(m => m.user_id)
    return allProfiles.filter(p => !memberIds.includes(p.id))
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
            style={{ borderTopColor: '#C9A227' }}
          />
          <p className="text-white/60">Loading squads...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Users className="w-6 h-6" style={{ color: '#C9A227' }} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
              Squads
            </h1>
            <p className="text-white/60 mt-1">Manage your golf groups</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Create Squad</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty State */}
      {squads.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Users className="w-8 h-8" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Squads Yet</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Create your first squad to organize players for competitions and events.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-gold inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Your First Squad
          </button>
        </div>
      ) : (
        /* Squads Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {squads.map((squad) => (
            <div key={squad.id} className="glass-card overflow-hidden">
              {/* Squad Header */}
              <div
                className="p-4"
                style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}
              >
                <h3 className="text-lg font-semibold text-white">{squad.name}</h3>
                {squad.description && (
                  <p className="text-sm text-white/50 mt-1">{squad.description}</p>
                )}
                <p className="text-xs text-white/40 mt-2">
                  {squad.squad_members.length} member{squad.squad_members.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Members List */}
              <div className="p-4">
                {squad.squad_members.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-4">No members yet</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {squad.squad_members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {member.profiles.avatar_url ? (
                            <img
                              src={member.profiles.avatar_url}
                              alt={member.profiles.full_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: '#C9A227', color: '#153c30' }}
                            >
                              {getInitials(member.profiles.full_name || 'U')}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {member.profiles.full_name || 'Unknown'}
                            </p>
                            {member.profiles.handicap_index !== null && (
                              <p className="text-xs text-white/50">
                                HCP: {member.profiles.handicap_index.toFixed(1)}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemovePlayer(member.id)}
                          disabled={isSubmitting}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all"
                          title="Remove from squad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Player Button */}
                <button
                  onClick={() => openAddPlayerModal(squad)}
                  className="w-full mt-4 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: 'rgba(201, 162, 39, 0.15)',
                    color: '#C9A227',
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Add Player
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Squad Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCreateModal(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: '#1a4d3e' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#C9A227' }}>
                Create New Squad
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Squad Name *
                </label>
                <input
                  type="text"
                  value={newSquadName}
                  onChange={(e) => setNewSquadName(e.target.value)}
                  placeholder="e.g., Senior Cup Panel"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A227]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newSquadDescription}
                  onChange={(e) => setNewSquadDescription(e.target.value)}
                  placeholder="Brief description of the squad..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A227] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 px-4 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSquad}
                disabled={!newSquadName.trim() || isSubmitting}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#C9A227', color: '#153c30' }}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#153c30]/30 border-t-[#153c30] rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Create Squad
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && selectedSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setShowAddPlayerModal(false)
              setSelectedSquad(null)
            }}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-xl overflow-hidden"
            style={{ backgroundColor: '#1a4d3e' }}
          >
            <div
              className="flex items-center justify-between p-6"
              style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}
            >
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#C9A227' }}>
                  Add Player
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  to {selectedSquad.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddPlayerModal(false)
                  setSelectedSquad(null)
                }}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-4">
              {getAvailablePlayers().length === 0 ? (
                <p className="text-center text-white/50 py-8">
                  All players are already in this squad
                </p>
              ) : (
                <div className="space-y-2">
                  {getAvailablePlayers().map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleAddPlayer(profile.id)}
                      disabled={isSubmitting}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left disabled:opacity-50"
                    >
                      {/* Avatar */}
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: '#C9A227', color: '#153c30' }}
                        >
                          {getInitials(profile.full_name || 'U')}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {profile.full_name || 'Unknown Player'}
                        </p>
                        {profile.handicap_index !== null && (
                          <p className="text-xs text-white/50">
                            Handicap: {profile.handicap_index.toFixed(1)}
                          </p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-white/40" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              className="p-4"
              style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}
            >
              <button
                onClick={() => {
                  setShowAddPlayerModal(false)
                  setSelectedSquad(null)
                }}
                className="w-full py-3 px-4 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
