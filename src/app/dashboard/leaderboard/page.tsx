'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Trophy, Medal, Award } from 'lucide-react'
import Link from 'next/link'

interface LeaderboardEntry {
  id: string
  full_name: string
  handicap_index: number | null
  rounds_played: number
  lowest_score: number | null
  avg_score: number | null
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboardData()
  }, [])

  const fetchLeaderboardData = async () => {
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, handicap_index')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      setIsLoading(false)
      return
    }

    // Fetch all rounds with scores
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('user_id, total_strokes')

    if (roundsError) {
      console.error('Error fetching rounds:', roundsError)
      setIsLoading(false)
      return
    }

    // Calculate stats per player
    const playerStats = new Map<string, { scores: number[] }>()

    rounds?.forEach((round) => {
      if (round.total_strokes && round.total_strokes > 0) {
        if (!playerStats.has(round.user_id)) {
          playerStats.set(round.user_id, { scores: [] })
        }
        playerStats.get(round.user_id)!.scores.push(round.total_strokes)
      }
    })

    // Build leaderboard entries
    const entries: LeaderboardEntry[] = (profiles || []).map((profile) => {
      const stats = playerStats.get(profile.id)
      const scores = stats?.scores || []

      return {
        id: profile.id,
        full_name: profile.full_name || 'Unknown Player',
        handicap_index: profile.handicap_index,
        rounds_played: scores.length,
        lowest_score: scores.length > 0 ? Math.min(...scores) : null,
        avg_score: scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
      }
    })

    // Filter to only players with rounds, then sort by lowest score ascending
    const ranked = entries
      .filter((e) => e.lowest_score !== null)
      .sort((a, b) => (a.lowest_score ?? 999) - (b.lowest_score ?? 999))

    setLeaderboard(ranked)
    setIsLoading(false)
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return {
        bg: 'linear-gradient(135deg, #C9A227 0%, #E8C547 100%)',
        text: '#153c30',
        label: 'Gold',
        icon: Trophy,
      }
    }
    if (rank === 2) {
      return {
        bg: 'linear-gradient(135deg, #A8A8A8 0%, #D4D4D4 100%)',
        text: '#1f2937',
        label: 'Silver',
        icon: Medal,
      }
    }
    if (rank === 3) {
      return {
        bg: 'linear-gradient(135deg, #CD7F32 0%, #E8A862 100%)',
        text: '#1f2937',
        label: 'Bronze',
        icon: Award,
      }
    }
    return null
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
            Leaderboard
          </h1>
          <p className="text-white/60 mt-1">
            Ranked by lowest gross score
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
        >
          <Trophy className="w-6 h-6" style={{ color: '#C9A227' }} />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="glass-card p-12 text-center">
          <div
            className="w-10 h-10 border-4 border-white/20 rounded-full animate-spin mx-auto mb-4"
            style={{ borderTopColor: '#C9A227' }}
          />
          <p className="text-white/60">Loading leaderboard...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Trophy className="w-8 h-8" style={{ color: '#C9A227' }} />
          </div>
          <p className="text-white/60 mb-4">No rounds recorded yet.</p>
          <Link
            href="/dashboard/add-round"
            className="btn-gold inline-flex items-center gap-2 text-sm py-2 px-4"
          >
            Add your first round
          </Link>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards (Desktop) */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {[2, 1, 3].map((position) => {
              const entry = leaderboard[position - 1]
              if (!entry) return <div key={position} />

              const style = getRankStyle(position)!
              const Icon = style.icon
              const isCurrentUser = entry.id === currentUserId

              return (
                <div
                  key={entry.id}
                  className={`glass-card p-6 text-center relative overflow-hidden ${position === 1 ? 'md:-mt-4 md:pb-8' : ''}`}
                  style={{
                    border: isCurrentUser ? '2px solid #C9A227' : undefined,
                  }}
                >
                  {/* Rank Badge */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                    style={{ background: style.bg }}
                  >
                    <Icon className="w-7 h-7" style={{ color: style.text }} />
                  </div>

                  {/* Player Name */}
                  <h3 className="font-bold text-white text-lg truncate">
                    {entry.full_name}
                  </h3>
                  {isCurrentUser && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded mt-1 inline-block"
                      style={{ backgroundColor: '#C9A227', color: '#153c30' }}
                    >
                      You
                    </span>
                  )}

                  {/* Stats */}
                  <div className="mt-4 space-y-2">
                    <div>
                      <p className="text-3xl font-bold" style={{ color: '#C9A227' }}>
                        {entry.lowest_score}
                      </p>
                      <p className="text-xs text-white/50 uppercase tracking-wide">Best Score</p>
                    </div>
                    <div className="flex justify-center gap-4 text-sm">
                      <div>
                        <span className="text-white font-medium">{entry.rounds_played}</span>
                        <span className="text-white/50 ml-1">Rounds</span>
                      </div>
                      <div>
                        <span className="text-white font-medium">{entry.avg_score}</span>
                        <span className="text-white/50 ml-1">Avg</span>
                      </div>
                    </div>
                  </div>

                  {/* Rank Number */}
                  <div
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: style.bg, color: style.text }}
                  >
                    {position}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Full Leaderboard Table */}
          <div className="glass-card overflow-hidden">
            <div
              className="px-4 md:px-6 py-4"
              style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
            >
              <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                Full Rankings
              </h2>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                    <th className="w-16 px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Player Name
                    </th>
                    <th className="w-24 px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Handicap
                    </th>
                    <th className="w-24 px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Rounds
                    </th>
                    <th className="w-28 px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Best Score
                    </th>
                    <th className="w-28 px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Avg Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1
                    const isCurrentUser = entry.id === currentUserId
                    const rankStyle = getRankStyle(rank)

                    return (
                      <tr
                        key={entry.id}
                        className="transition-colors"
                        style={{
                          backgroundColor: isCurrentUser
                            ? 'rgba(201, 162, 39, 0.1)'
                            : rank <= 3
                              ? 'rgba(201, 162, 39, 0.05)'
                              : 'transparent',
                          borderBottom: '1px solid rgba(201, 162, 39, 0.1)',
                        }}
                      >
                        <td className="px-6 py-4 text-center">
                          {rankStyle ? (
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm"
                              style={{ background: rankStyle.bg, color: rankStyle.text }}
                            >
                              {rank}
                            </span>
                          ) : (
                            <span className="text-white/70 font-medium">{rank}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{entry.full_name}</span>
                            {isCurrentUser && (
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded"
                                style={{ backgroundColor: '#C9A227', color: '#153c30' }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-white/70">
                            {entry.handicap_index !== null ? entry.handicap_index.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-white/70">{entry.rounds_played}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className="inline-flex items-center justify-center w-14 h-8 rounded-lg font-bold text-sm"
                            style={{
                              backgroundColor: rank <= 3 ? 'rgba(201, 162, 39, 0.3)' : 'rgba(201, 162, 39, 0.15)',
                              color: '#C9A227',
                            }}
                          >
                            {entry.lowest_score ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-white/70">{entry.avg_score ?? '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'rgba(201, 162, 39, 0.2)' }}>
              {leaderboard.map((entry, index) => {
                const rank = index + 1
                const isCurrentUser = entry.id === currentUserId
                const rankStyle = getRankStyle(rank)

                return (
                  <div
                    key={entry.id}
                    className="p-4"
                    style={{
                      backgroundColor: isCurrentUser
                        ? 'rgba(201, 162, 39, 0.1)'
                        : rank <= 3
                          ? 'rgba(201, 162, 39, 0.05)'
                          : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank Badge */}
                      {rankStyle ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background: rankStyle.bg, color: rankStyle.text }}
                        >
                          {rank}
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)', color: '#C9A227' }}
                        >
                          {rank}
                        </div>
                      )}

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{entry.full_name}</span>
                          {isCurrentUser && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0"
                              style={{ backgroundColor: '#C9A227', color: '#153c30' }}
                            >
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
                          <span>HCP: {entry.handicap_index?.toFixed(1) ?? '—'}</span>
                          <span>{entry.rounds_played} rounds</span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold" style={{ color: '#C9A227' }}>
                          {entry.lowest_score}
                        </p>
                        <p className="text-xs text-white/50">Avg: {entry.avg_score}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: '#C9A227' }}>
                {leaderboard.length}
              </p>
              <p className="text-xs text-white/50 uppercase tracking-wide">Players</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {leaderboard.reduce((sum, e) => sum + e.rounds_played, 0)}
              </p>
              <p className="text-xs text-white/50 uppercase tracking-wide">Total Rounds</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: '#C9A227' }}>
                {leaderboard[0]?.lowest_score ?? '—'}
              </p>
              <p className="text-xs text-white/50 uppercase tracking-wide">Best Score</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
