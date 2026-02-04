'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ============================================
// THEME CONSTANTS
// ============================================

const COLORS = {
  darkGreen: '#1B4D3E',
  gold: '#C9A227',
  white: '#FFFFFF',
  gridStroke: 'rgba(255,255,255,0.1)',
}

// ============================================
// CUSTOM TOOLTIP STYLES
// ============================================

const tooltipStyle = {
  backgroundColor: COLORS.darkGreen,
  border: `2px solid ${COLORS.gold}`,
  borderRadius: '8px',
  padding: '8px 12px',
}

const tooltipLabelStyle = {
  color: COLORS.white,
  fontWeight: 600,
  marginBottom: '4px',
}

const tooltipItemStyle = {
  color: COLORS.gold,
}

// ============================================
// SCORE TREND CHART
// ============================================

interface ScoreTrendChartProps {
  data: { date: string; score: number }[]
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-white/60">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid stroke={COLORS.gridStroke} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fill: COLORS.white, fontSize: 12 }}
          tickLine={{ stroke: COLORS.white }}
          axisLine={{ stroke: COLORS.gridStroke }}
        />
        <YAxis
          tick={{ fill: COLORS.white, fontSize: 12 }}
          tickLine={{ stroke: COLORS.white }}
          axisLine={{ stroke: COLORS.gridStroke }}
          domain={['dataMin - 5', 'dataMax + 5']}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={{ stroke: COLORS.gold, strokeWidth: 1, strokeDasharray: '5 5' }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={COLORS.gold}
          strokeWidth={3}
          dot={{ fill: COLORS.gold, r: 4 }}
          activeDot={{ fill: COLORS.gold, r: 6, stroke: COLORS.white, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ============================================
// COURSE PERFORMANCE CHART
// ============================================

interface CoursePerformanceChartProps {
  data: { courseName: string; avgScore: number }[]
}

export function CoursePerformanceChart({ data }: CoursePerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-white/60">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid stroke={COLORS.gridStroke} strokeDasharray="3 3" />
        <XAxis
          dataKey="courseName"
          tick={{ fill: COLORS.white, fontSize: 12 }}
          tickLine={{ stroke: COLORS.white }}
          axisLine={{ stroke: COLORS.gridStroke }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fill: COLORS.white, fontSize: 12 }}
          tickLine={{ stroke: COLORS.white }}
          axisLine={{ stroke: COLORS.gridStroke }}
          domain={['dataMin - 5', 'dataMax + 5']}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={{ fill: 'rgba(201, 162, 39, 0.1)' }}
        />
        <Bar
          dataKey="avgScore"
          fill={COLORS.gold}
          radius={[4, 4, 0, 0]}
          name="Avg Score"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
