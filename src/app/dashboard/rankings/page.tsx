'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Trophy } from 'lucide-react'

interface SquadMember {
  id: string
  full_name: string
  handicap_index: number | null
  home_club: string | null
}

export default function RankingsPage() {
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      setCurrentUserId(user.id)
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, handicap_index, home_club')
      .order('handicap_index', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Error fetching squad:', error)
    } else if (profiles) {
      setSquadMembers(profiles)
    }

    setIsLoading(false)
  }

  const getCategory = (handicap: number | null): { label: string; color: string } => {
    if (handicap === null) return { label: '—', color: '#9CA3AF' }
    if (handicap <= 0) return { label: 'Plus', color: '#7C3AED' }
    if (handicap <= 5) return { label: 'Cat 1', color: '#059669' }
    if (handicap <= 10) return { label: 'Cat 2', color: '#2563EB' }
    if (handicap <= 18) return { label: 'Cat 3', color: '#D97706' }
    if (handicap <= 28) return { label: 'Cat 4', color: '#DC2626' }
    return { label: 'Cat 5', color: '#6B7280' }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Squad Rankings</h1>
        <p className="text-gray-500 mt-1">Performance leaderboard</p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-[#1B4D3E]/20 border-t-[#1B4D3E] rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading rankings...</p>
        </div>
      ) : squadMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No squad members found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* ========== DESKTOP TABLE (hidden on mobile) ========== */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1B4D3E]">
                    <th className="w-16 py-4 px-4 text-center text-sm font-semibold text-white">Rank</th>
                    <th className="py-4 px-4 text-left text-sm font-semibold text-white">Player</th>
                    <th className="w-32 py-4 px-4 text-center text-sm font-semibold text-white">Handicap</th>
                    <th className="w-28 py-4 px-4 text-center text-sm font-semibold text-white">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {squadMembers.map((member, index) => {
                    const rank = index + 1
                    const isCurrentUser = member.id === currentUserId
                    const category = getCategory(member.handicap_index)

                    return (
                      <tr
                        key={member.id}
                        className={`border-b border-gray-100 last:border-0 ${isCurrentUser ? 'bg-[#C9A227]/10' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-4 px-4 text-center">
                          <span className="text-lg font-bold text-[#1B4D3E]">{rank}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">
                              {member.full_name || 'Unknown'}
                            </span>
                            {isCurrentUser && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#C9A227] text-white">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-lg font-semibold text-gray-900">
                            {member.handicap_index !== null ? member.handicap_index.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: category.color }}
                            ></span>
                            <span className="text-sm text-gray-600">{category.label}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ========== MOBILE CARDS (hidden on desktop) ========== */}
            <div className="md:hidden divide-y divide-gray-100">
              {squadMembers.map((member, index) => {
                const rank = index + 1
                const isCurrentUser = member.id === currentUserId
                const category = getCategory(member.handicap_index)

                return (
                  <div
                    key={member.id}
                    className={`p-4 flex items-center gap-4 ${isCurrentUser ? 'bg-[#C9A227]/10' : ''}`}
                  >
                    {/* Rank Badge */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                        rank <= 3 ? 'bg-[#C9A227]' : 'bg-[#1B4D3E]'
                      }`}
                    >
                      {rank}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {member.full_name || 'Unknown'}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#C9A227] text-white flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: category.color }}
                        ></span>
                        <span className="text-sm text-gray-500">{category.label}</span>
                      </div>
                    </div>

                    {/* Handicap */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-[#1B4D3E]">
                        {member.handicap_index !== null ? member.handicap_index.toFixed(1) : '—'}
                      </p>
                      <p className="text-xs text-gray-500">HCP</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-[#1B4D3E]">{squadMembers.length}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Members</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-[#C9A227]">
                {squadMembers[0]?.handicap_index?.toFixed(1) || '—'}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Lowest</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-[#1B4D3E]">
                {squadMembers.length > 0
                  ? (squadMembers.reduce((sum, m) => sum + (m.handicap_index || 0), 0) / squadMembers.length).toFixed(1)
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Average</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
