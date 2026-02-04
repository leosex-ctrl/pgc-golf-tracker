'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Target, Check } from 'lucide-react'
import GoalCard, { Goal, GoalType, GOAL_TYPE_CONFIG } from './GoalCard'

// ============================================
// TYPES
// ============================================

interface HoleScore {
  par: number
  strokes: number
  round_id: string
}

interface GoalStats {
  par3Avg: number | null
  par4Avg: number | null
  par5Avg: number | null
  scoreAvg: number | null
  birdiesPerRound: number | null
  parsPerRound: number | null
}

// ============================================
// LOCAL STORAGE KEY
// ============================================

const GOALS_STORAGE_KEY = 'pgc_user_goals'

// ============================================
// COMPONENT
// ============================================

export default function GoalsSection() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [stats, setStats] = useState<GoalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Form state for new goal
  const [newGoalType, setNewGoalType] = useState<GoalType>('par3_average')
  const [newGoalTarget, setNewGoalTarget] = useState<string>('')

  useEffect(() => {
    loadGoals()
    fetchStats()
  }, [])

  // Update goals with current stats when stats change
  useEffect(() => {
    if (stats) {
      setGoals(prevGoals =>
        prevGoals.map(goal => ({
          ...goal,
          currentValue: getStatForGoalType(goal.type, stats),
        }))
      )
    }
  }, [stats])

  // ============================================
  // DATA LOADING
  // ============================================

  const loadGoals = () => {
    try {
      const stored = localStorage.getItem(GOALS_STORAGE_KEY)
      if (stored) {
        setGoals(JSON.parse(stored))
      }
    } catch (err) {
      console.error('Error loading goals:', err)
    }
  }

  const saveGoals = (newGoals: Goal[]) => {
    try {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals))
      setGoals(newGoals)
    } catch (err) {
      console.error('Error saving goals:', err)
    }
  }

  const fetchStats = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      // Fetch last 10 rounds
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('id, total_strokes')
        .eq('user_id', user.id)
        .order('date_of_round', { ascending: false })
        .limit(10)

      if (roundsError || !rounds || rounds.length === 0) {
        setStats(null)
        setIsLoading(false)
        return
      }

      const roundIds = rounds.map(r => r.id)

      // Fetch round_scores for these rounds
      const { data: scores, error: scoresError } = await supabase
        .from('round_scores')
        .select('par, strokes, round_id')
        .in('round_id', roundIds)

      if (scoresError) {
        console.error('Error fetching scores:', JSON.stringify(scoresError, null, 2))
        setIsLoading(false)
        return
      }

      // Calculate stats
      const calculatedStats = calculateStats(scores as HoleScore[], rounds)
      setStats(calculatedStats)

    } catch (err) {
      console.error('Error fetching stats:', JSON.stringify(err, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // CALCULATIONS
  // ============================================

  const calculateStats = (scores: HoleScore[], rounds: { id: string; total_strokes: number | null }[]): GoalStats => {
    const validScores = scores.filter(s => s.strokes && s.strokes > 0 && s.par)

    // Group scores by par type
    const par3Scores: number[] = []
    const par4Scores: number[] = []
    const par5Scores: number[] = []

    // Count birdies and pars per round
    const roundBirdies = new Map<string, number>()
    const roundPars = new Map<string, number>()

    validScores.forEach(score => {
      // Group by par type
      if (score.par === 3) par3Scores.push(score.strokes)
      else if (score.par === 4) par4Scores.push(score.strokes)
      else if (score.par === 5) par5Scores.push(score.strokes)

      // Count scoring outcomes
      const diff = score.strokes - score.par
      if (diff <= -1) {
        // Birdie or better
        roundBirdies.set(score.round_id, (roundBirdies.get(score.round_id) || 0) + 1)
      }
      if (diff === 0) {
        // Par
        roundPars.set(score.round_id, (roundPars.get(score.round_id) || 0) + 1)
      }
    })

    // Calculate averages
    const calcAvg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null

    // Calculate total strokes average
    const validRounds = rounds.filter(r => r.total_strokes && r.total_strokes > 0)
    const scoreAvg = validRounds.length > 0
      ? Math.round((validRounds.reduce((sum, r) => sum + r.total_strokes!, 0) / validRounds.length) * 10) / 10
      : null

    // Calculate birdies/pars per round
    const roundCount = rounds.length
    const totalBirdies = Array.from(roundBirdies.values()).reduce((a, b) => a + b, 0)
    const totalPars = Array.from(roundPars.values()).reduce((a, b) => a + b, 0)

    return {
      par3Avg: calcAvg(par3Scores),
      par4Avg: calcAvg(par4Scores),
      par5Avg: calcAvg(par5Scores),
      scoreAvg,
      birdiesPerRound: roundCount > 0 ? Math.round((totalBirdies / roundCount) * 10) / 10 : null,
      parsPerRound: roundCount > 0 ? Math.round((totalPars / roundCount) * 10) / 10 : null,
    }
  }

  const getStatForGoalType = (type: GoalType, stats: GoalStats): number | null => {
    switch (type) {
      case 'par3_average': return stats.par3Avg
      case 'par4_average': return stats.par4Avg
      case 'par5_average': return stats.par5Avg
      case 'score_average': return stats.scoreAvg
      case 'birdies_per_round': return stats.birdiesPerRound
      case 'pars_per_round': return stats.parsPerRound
      default: return null
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  const handleCreateGoal = () => {
    const target = parseFloat(newGoalTarget)
    if (isNaN(target) || target <= 0) return

    const newGoal: Goal = {
      id: Date.now().toString(),
      type: newGoalType,
      targetValue: target,
      currentValue: stats ? getStatForGoalType(newGoalType, stats) : null,
    }

    saveGoals([...goals, newGoal])
    setShowModal(false)
    setNewGoalTarget('')
    setNewGoalType('par3_average')
  }

  const handleDeleteGoal = (id: string) => {
    saveGoals(goals.filter(g => g.id !== id))
  }

  // Get suggested target based on goal type and current value
  const getSuggestedTarget = (): string => {
    if (!stats) return ''
    const current = getStatForGoalType(newGoalType, stats)
    if (current === null) return ''

    const config = GOAL_TYPE_CONFIG[newGoalType]
    if (config.lowerIsBetter) {
      // Suggest 5% improvement for lower-is-better metrics
      return (current * 0.95).toFixed(1)
    } else {
      // Suggest 20% improvement for higher-is-better metrics
      return (current * 1.2).toFixed(1)
    }
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
            My Goals
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div
            className="w-8 h-8 border-4 border-white/20 rounded-full animate-spin"
            style={{ borderTopColor: '#C9A227' }}
          />
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <div className="glass-card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: '#C9A227' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
              My Goals
            </h2>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: '#C9A227' }}
            title="Add new goal"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Goals Grid or Empty State */}
        {goals.length === 0 ? (
          <div className="text-center py-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
            >
              <Target className="w-6 h-6" style={{ color: '#C9A227' }} />
            </div>
            <p className="text-white/60 text-sm mb-3">No goals set yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm font-medium hover:underline"
              style={{ color: '#C9A227' }}
            >
              Set your first goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={handleDeleteGoal}
              />
            ))}
            {/* Add Goal Card */}
            <button
              onClick={() => setShowModal(true)}
              className="glass-card p-4 flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(201, 162, 39, 0.3)' }}
            >
              <Plus className="w-8 h-8 mb-2" style={{ color: '#C9A227' }} />
              <span className="text-sm text-white/60">Add Goal</span>
            </button>
          </div>
        )}

        {/* Stats Summary (last 10 rounds) */}
        {stats && (
          <div
            className="mt-4 pt-4 text-xs text-white/40"
            style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}
          >
            Based on your last 10 rounds
          </div>
        )}
      </div>

      {/* Create Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: '#1a4d3e' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#C9A227' }}>
                Set New Goal
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Goal Type
                </label>
                <select
                  value={newGoalType}
                  onChange={(e) => {
                    setNewGoalType(e.target.value as GoalType)
                    setNewGoalTarget('')
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-[#C9A227]"
                  style={{ backgroundColor: '#153c30' }}
                >
                  {Object.entries(GOAL_TYPE_CONFIG).map(([type, config]) => (
                    <option key={type} value={type} className="bg-[#153c30]">
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Value */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Target Value
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder={getSuggestedTarget() || 'Enter target...'}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A227]"
                />
                {stats && getStatForGoalType(newGoalType, stats) !== null && (
                  <p className="text-xs text-white/50 mt-2">
                    Current: {getStatForGoalType(newGoalType, stats)?.toFixed(1)}
                    {getSuggestedTarget() && (
                      <button
                        onClick={() => setNewGoalTarget(getSuggestedTarget())}
                        className="ml-2 underline"
                        style={{ color: '#C9A227' }}
                      >
                        Suggest: {getSuggestedTarget()}
                      </button>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 px-4 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGoal}
                disabled={!newGoalTarget || parseFloat(newGoalTarget) <= 0}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: '#C9A227', color: '#153c30' }}
              >
                <Check className="w-5 h-5" />
                Set Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
