'use client'

import { Target, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface Goal {
  id: string
  type: GoalType
  targetValue: number
  currentValue: number | null
}

export type GoalType =
  | 'par3_average'
  | 'par4_average'
  | 'par5_average'
  | 'score_average'
  | 'birdies_per_round'
  | 'pars_per_round'

export const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; unit: string; lowerIsBetter: boolean }> = {
  par3_average: { label: 'Par 3 Average', unit: '', lowerIsBetter: true },
  par4_average: { label: 'Par 4 Average', unit: '', lowerIsBetter: true },
  par5_average: { label: 'Par 5 Average', unit: '', lowerIsBetter: true },
  score_average: { label: 'Score Average', unit: '', lowerIsBetter: true },
  birdies_per_round: { label: 'Birdies per Round', unit: '', lowerIsBetter: false },
  pars_per_round: { label: 'Pars per Round', unit: '', lowerIsBetter: false },
}

interface GoalCardProps {
  goal: Goal
  onDelete?: (id: string) => void
}

// ============================================
// COMPONENT
// ============================================

export default function GoalCard({ goal, onDelete }: GoalCardProps) {
  const config = GOAL_TYPE_CONFIG[goal.type]
  const { currentValue, targetValue } = goal

  // Calculate progress percentage
  const calculateProgress = (): number => {
    if (currentValue === null) return 0

    if (config.lowerIsBetter) {
      // For metrics where lower is better (e.g., averages)
      // If current > target, we're behind (show partial progress)
      // If current <= target, we've achieved the goal (100%)
      if (currentValue <= targetValue) return 100
      // Calculate how far we are from target
      // Using a baseline that's reasonable (e.g., if target is 3.5, baseline might be 5.0)
      const baseline = targetValue * 1.5
      const progress = ((baseline - currentValue) / (baseline - targetValue)) * 100
      return Math.max(0, Math.min(100, progress))
    } else {
      // For metrics where higher is better (e.g., birdies per round)
      if (currentValue >= targetValue) return 100
      return Math.max(0, Math.min(100, (currentValue / targetValue) * 100))
    }
  }

  const progress = calculateProgress()
  const isGoalMet = currentValue !== null && (
    config.lowerIsBetter ? currentValue <= targetValue : currentValue >= targetValue
  )

  // Determine status color
  const getStatusColor = (): string => {
    if (currentValue === null) return '#6B7280' // Gray for no data
    if (isGoalMet) return '#22C55E' // Green for achieved
    if (progress >= 75) return '#C9A227' // Gold for close
    if (progress >= 50) return '#F59E0B' // Amber for moderate
    return '#EF4444' // Red for needs work
  }

  const statusColor = getStatusColor()

  // Determine trend indicator
  const getTrendIcon = () => {
    if (currentValue === null) return null
    if (isGoalMet) return <CheckCircle className="w-4 h-4 text-green-400" />
    if (config.lowerIsBetter) {
      return currentValue > targetValue
        ? <TrendingDown className="w-4 h-4 text-orange-400" />
        : <TrendingUp className="w-4 h-4 text-green-400" />
    }
    return currentValue < targetValue
      ? <TrendingUp className="w-4 h-4 text-orange-400" />
      : <TrendingDown className="w-4 h-4 text-green-400" />
  }

  return (
    <div className="glass-card p-4 relative group">
      {/* Delete button (appears on hover) */}
      {onDelete && (
        <button
          onClick={() => onDelete(goal.id)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all"
          title="Remove goal"
        >
          <span className="text-xs">✕</span>
        </button>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
        >
          <Target className="w-4 h-4" style={{ color: '#C9A227' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{config.label}</p>
        </div>
        {getTrendIcon()}
      </div>

      {/* Values */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs text-white/50 mb-1">Current</p>
          <p className="text-2xl font-bold" style={{ color: statusColor }}>
            {currentValue !== null ? currentValue.toFixed(1) : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/50 mb-1">Target</p>
          <p className="text-lg font-semibold" style={{ color: '#C9A227' }}>
            {targetValue.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/40">
            {currentValue !== null ? `${Math.round(progress)}% to goal` : 'No data yet'}
          </span>
          {isGoalMet && (
            <span className="text-green-400 font-medium">Achieved!</span>
          )}
        </div>
      </div>
    </div>
  )
}
