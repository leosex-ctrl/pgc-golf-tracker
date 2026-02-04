'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { PlusCircle, Trash2, Sun, Cloud, CloudRain, Wind, Thermometer, History } from 'lucide-react'
import { deleteRound } from '@/app/actions/round-management'

// ============================================
// TYPES
// ============================================

interface Round {
  id: string
  user_id: string
  date_of_round: string
  total_strokes: number | null
  total_par: number | null
  score_to_par: number | null
  holes_played: number | null
  course_id: string
  weather: string | null
  temp_c: number | null
  wind_speed_kph: number | null
  courses: {
    name: string
  }
  profiles: {
    full_name: string
  }
}

// ============================================
// WEATHER ICON HELPER
// ============================================

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return null
  const w = weather.toLowerCase()
  if (w.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-400" />
  if (w.includes('sun') || w.includes('clear')) return <Sun className="w-4 h-4 text-yellow-400" />
  if (w.includes('wind')) return <Wind className="w-4 h-4 text-blue-300" />
  if (w.includes('cloud') || w.includes('overcast')) return <Cloud className="w-4 h-4 text-gray-400" />
  return <Cloud className="w-4 h-4 text-gray-400" />
}

// ============================================
// COMPONENT
// ============================================

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my')

  useEffect(() => {
    fetchData()
  }, [viewMode])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Auth error:', authError)
        return
      }

      setCurrentUserId(user.id)

      // Check admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const rawRole = profile?.role || ''
      const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')
      const hasAdminAccess = ['admin', 'super_admin'].includes(normalizedRole)
      setIsAdmin(hasAdminAccess)

      // Fetch rounds based on view mode
      let query = supabase
        .from('rounds')
        .select('*, courses(name), profiles(full_name)')
        .order('date_of_round', { ascending: false })
        .limit(100)

      // If viewing only my rounds, filter by user_id
      if (viewMode === 'my') {
        query = query.eq('user_id', user.id)
      }

      const { data: roundsData, error: roundsError } = await query

      if (roundsError) {
        console.error('Rounds error:', roundsError)
        setError(`Failed to load rounds: ${roundsError.message}`)
        return
      }

      setRounds((roundsData || []) as Round[])

    } catch (err) {
      console.error('Fetch error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (roundId: string) => {
    // Browser confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this round? This action cannot be undone.')

    if (!confirmed) return

    setDeletingId(roundId)

    try {
      const result = await deleteRound(roundId)

      if (result.success) {
        // Remove from local state
        setRounds(prev => prev.filter(r => r.id !== roundId))
      } else {
        alert(result.error || 'Failed to delete round')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('An unexpected error occurred while deleting')
    } finally {
      setDeletingId(null)
    }
  }

  // Check if user can delete a specific round
  const canDelete = (round: Round) => {
    if (isAdmin) return true
    return round.user_id === currentUserId
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
          <p className="text-white/60">Loading rounds...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
            Round History
          </h1>
          <p className="text-white/60 mt-1">
            {viewMode === 'my' ? 'Your recorded rounds' : 'All rounds in the system'}
          </p>
        </div>
        <Link
          href="/dashboard/add-round"
          className="btn-gold inline-flex items-center gap-2 text-sm py-2 px-4 self-start"
        >
          <PlusCircle className="w-4 h-4" />
          Add Round
        </Link>
      </div>

      {/* View Mode Toggle (Admin Only) */}
      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'my'
                ? 'text-[#0D4D2B]'
                : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10'
            }`}
            style={viewMode === 'my' ? { backgroundColor: '#C9A227' } : {}}
          >
            My Rounds
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'all'
                ? 'text-[#0D4D2B]'
                : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10'
            }`}
            style={viewMode === 'all' ? { backgroundColor: '#C9A227' } : {}}
          >
            All Rounds
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {/* Rounds Table */}
      {rounds.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <History className="w-8 h-8" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Rounds Found</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            {viewMode === 'my'
              ? "You haven't recorded any rounds yet. Start tracking your performance!"
              : "No rounds have been recorded in the system yet."
            }
          </p>
          <Link
            href="/dashboard/add-round"
            className="btn-gold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add Your First Round
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
              {viewMode === 'my' ? 'My Rounds' : 'All Rounds'}
            </h2>
            <span className="text-sm text-white/40">{rounds.length} rounds</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Date
                  </th>
                  {viewMode === 'all' && (
                    <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Player
                    </th>
                  )}
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Course
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Holes
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Weather
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Score
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr
                    key={round.id}
                    className="hover:bg-white/5 transition-colors"
                    style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.1)' }}
                  >
                    <td className="py-4 px-6 text-sm text-white/70">
                      {new Date(round.date_of_round).toLocaleDateString('en-IE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {viewMode === 'all' && (
                      <td className="py-4 px-6 text-sm text-white/70">
                        {round.profiles?.full_name || 'Unknown'}
                      </td>
                    )}
                    <td className="py-4 px-6 text-sm font-medium text-white">
                      {round.courses?.name || 'Unknown Course'}
                    </td>
                    <td className="py-4 px-6 text-center text-sm text-white/70">
                      {round.holes_played || 18}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {getWeatherIcon(round.weather)}
                        <div className="text-center">
                          <span className="text-xs text-white/70">{round.weather || '—'}</span>
                          {(round.temp_c !== null || round.wind_speed_kph !== null) && (
                            <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                              {round.temp_c !== null && (
                                <span className="flex items-center gap-0.5">
                                  <Thermometer className="w-3 h-3" />
                                  {round.temp_c}°
                                </span>
                              )}
                              {round.wind_speed_kph !== null && (
                                <span className="flex items-center gap-0.5">
                                  <Wind className="w-3 h-3" />
                                  {round.wind_speed_kph}kph
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className="inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-sm"
                        style={{
                          backgroundColor: 'rgba(201, 162, 39, 0.2)',
                          color: '#C9A227',
                        }}
                      >
                        {round.total_strokes ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {canDelete(round) && (
                        <button
                          onClick={() => handleDelete(round.id)}
                          disabled={deletingId === round.id}
                          className="p-2 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50"
                          title="Delete round"
                        >
                          {deletingId === round.id ? (
                            <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-400" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y" style={{ borderColor: 'rgba(201, 162, 39, 0.2)' }}>
            {rounds.map((round) => (
              <div key={round.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {round.courses?.name || 'Unknown Course'}
                    </p>
                    {viewMode === 'all' && (
                      <p className="text-sm text-white/60">
                        {round.profiles?.full_name || 'Unknown'}
                      </p>
                    )}
                    <p className="text-sm text-white/50">
                      {new Date(round.date_of_round).toLocaleDateString('en-IE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' • '}
                      {round.holes_played || 18} holes
                    </p>
                    {(round.weather || round.temp_c !== null || round.wind_speed_kph !== null) && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                        {getWeatherIcon(round.weather)}
                        <span>{round.weather || ''}</span>
                        {round.temp_c !== null && (
                          <span className="flex items-center gap-0.5">
                            <Thermometer className="w-3 h-3" />
                            {round.temp_c}°
                          </span>
                        )}
                        {round.wind_speed_kph !== null && (
                          <span className="flex items-center gap-0.5">
                            <Wind className="w-3 h-3" />
                            {round.wind_speed_kph}kph
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: '#C9A227' }}
                    >
                      {round.total_strokes ?? '—'}
                    </span>
                    {canDelete(round) && (
                      <button
                        onClick={() => handleDelete(round.id)}
                        disabled={deletingId === round.id}
                        className="p-2 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        title="Delete round"
                      >
                        {deletingId === round.id ? (
                          <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
