'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Trophy, CheckCircle } from 'lucide-react'
import { GeminiExtractedData } from '@/app/actions/gemini-upload'
import { saveRound } from '@/app/actions/save-round'

// ============================================
// TYPES
// ============================================

type RoundLength = 9 | 18

interface HoleEntry {
  hole: number
  par: number
  distance: number
  strokes: number | null
}

interface FormData {
  course_name: string
  date: string
  weather: string
  course_rating: number | null
  slope_rating: number | null
  holes: HoleEntry[]
  round_length: RoundLength
}

interface RoundEntryFormProps {
  initialData?: GeminiExtractedData | null
  onSave?: (data: FormData) => void
}

// ============================================
// HELPERS
// ============================================

const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Cold', 'Mild']

const createEmptyHoles = (length: RoundLength = 18): HoleEntry[] => {
  return Array.from({ length }, (_, i) => ({
    hole: i + 1,
    par: 4,
    distance: 0,
    strokes: null,
  }))
}

const initializeFormData = (initialData?: GeminiExtractedData | null): FormData => {
  if (!initialData) {
    return {
      course_name: '',
      date: new Date().toISOString().split('T')[0],
      weather: '',
      course_rating: null,
      slope_rating: null,
      holes: createEmptyHoles(18),
      round_length: 18,
    }
  }

  // Detect round length from extracted data
  const holeCount = initialData.hole_data.length
  const detectedLength: RoundLength = holeCount <= 9 ? 9 : 18

  // If 9-hole data, use it directly; if 18-hole, use all
  const holes = detectedLength === 9
    ? initialData.hole_data.slice(0, 9).map((h, i) => ({
        hole: i + 1,
        par: h.par,
        distance: h.distance,
        strokes: h.strokes,
      }))
    : initialData.hole_data.map((h) => ({
        hole: h.hole,
        par: h.par,
        distance: h.distance,
        strokes: h.strokes,
      }))

  return {
    course_name: initialData.round_details.course_name || '',
    date: initialData.round_details.date_of_round || new Date().toISOString().split('T')[0],
    weather: initialData.grounded_info.weather_conditions || '',
    course_rating: initialData.round_details.course_rating || null,
    slope_rating: initialData.round_details.slope_rating || null,
    holes,
    round_length: detectedLength,
  }
}

// ============================================
// COMPONENT
// ============================================

export default function RoundEntryForm({ initialData, onSave }: RoundEntryFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>(() => initializeFormData(initialData))
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ============================================
  // CALCULATIONS
  // ============================================

  const totals = useMemo(() => {
    const activeHoles = formData.holes.slice(0, formData.round_length)
    const totalPar = activeHoles.reduce((sum, h) => sum + h.par, 0)
    const totalStrokes = activeHoles.reduce((sum, h) => sum + (h.strokes || 0), 0)
    const holesPlayed = activeHoles.filter((h) => h.strokes !== null && h.strokes > 0).length
    const scoreToPar = holesPlayed > 0 ? totalStrokes - totalPar : 0

    return { totalPar, totalStrokes, holesPlayed, scoreToPar }
  }, [formData.holes, formData.round_length])

  // ============================================
  // HANDLERS
  // ============================================

  const updateField = (field: keyof FormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateHole = (index: number, field: keyof HoleEntry, value: number | null) => {
    setFormData((prev) => {
      const newHoles = [...prev.holes]
      newHoles[index] = { ...newHoles[index], [field]: value }
      return { ...prev, holes: newHoles }
    })
  }

  const handleRoundLengthChange = (length: RoundLength) => {
    setFormData((prev) => {
      // If switching to a longer round, add more holes
      if (length > prev.holes.length) {
        const additionalHoles = Array.from(
          { length: length - prev.holes.length },
          (_, i) => ({
            hole: prev.holes.length + i + 1,
            par: 4,
            distance: 0,
            strokes: null,
          })
        )
        return { ...prev, round_length: length, holes: [...prev.holes, ...additionalHoles] }
      }
      // If switching to shorter, just change round_length (keep data in case they switch back)
      return { ...prev, round_length: length }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const result = await saveRound(formData)

      if (result.success) {
        setShowSuccess(true)
        if (onSave) {
          onSave(formData)
        }
      } else {
        setErrorMessage(result.error || 'Failed to save round')
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save round')
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-redirect after success modal shows
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showSuccess, router])

  const handleSuccessClose = () => {
    setShowSuccess(false)
    router.push('/dashboard')
  }

  // ============================================
  // SCORE COLOR HELPER
  // ============================================

  const getScoreColor = (strokes: number | null, par: number): string => {
    if (strokes === null || strokes === 0) return 'text-white/40'
    if (strokes < par) return 'text-blue-400' // Under par - birdie or better
    if (strokes > par) return 'text-red-400' // Over par - bogey or worse
    return 'text-white' // Par
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header Fields */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(201, 162, 39, 0.3)',
        }}
      >
        {/* Round Length Toggle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-white/70 mb-3">Round Length</label>
          <div className="flex gap-2">
            {([9, 18] as RoundLength[]).map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => handleRoundLengthChange(length)}
                className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: formData.round_length === length ? '#C9A227' : 'rgba(255,255,255,0.1)',
                  color: formData.round_length === length ? '#1B4D3E' : 'rgba(255,255,255,0.7)',
                  border: formData.round_length === length ? '2px solid #C9A227' : '2px solid transparent',
                }}
              >
                {length} Holes
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => updateField('date', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-transparent text-white border-b-2 border-[#C9A227] focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          {/* Course Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Course Name</label>
            <input
              type="text"
              value={formData.course_name}
              onChange={(e) => updateField('course_name', e.target.value)}
              placeholder="Enter course name"
              className="w-full px-3 py-2 bg-transparent text-white border-b-2 border-[#C9A227] focus:outline-none focus:border-[#C9A227] placeholder:text-white/30"
            />
          </div>

          {/* Weather */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Weather</label>
            <select
              value={formData.weather}
              onChange={(e) => updateField('weather', e.target.value)}
              className="w-full px-3 py-2 bg-transparent text-white border-b-2 border-[#C9A227] focus:outline-none focus:border-[#C9A227]"
              style={{ backgroundColor: '#1B4D3E' }}
            >
              <option value="" className="bg-[#1B4D3E]">Select weather</option>
              {WEATHER_OPTIONS.map((w) => (
                <option key={w} value={w} className="bg-[#1B4D3E]">
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Course Rating & Slope (if available) */}
        {(formData.course_rating || formData.slope_rating) && (
          <div className="mt-4 pt-4 border-t border-white/10 flex gap-6">
            {formData.course_rating && (
              <div className="text-sm">
                <span className="text-white/60">Course Rating: </span>
                <span className="font-semibold" style={{ color: '#C9A227' }}>
                  {formData.course_rating}
                </span>
              </div>
            )}
            {formData.slope_rating && (
              <div className="text-sm">
                <span className="text-white/60">Slope: </span>
                <span className="font-semibold" style={{ color: '#C9A227' }}>
                  {formData.slope_rating}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scorecard Grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(201, 162, 39, 0.3)',
        }}
      >
        {/* Grid Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
            Scorecard
          </h2>
          {totals.holesPlayed > 0 && (
            <div
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.3)' }}
            >
              <span
                className={
                  totals.scoreToPar > 0
                    ? 'text-red-400'
                    : totals.scoreToPar < 0
                    ? 'text-blue-400'
                    : 'text-white'
                }
              >
                {totals.scoreToPar > 0 ? '+' : ''}
                {totals.scoreToPar}
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}>
                <th className="py-3 px-3 text-center font-semibold w-16" style={{ color: '#C9A227' }}>
                  Hole
                </th>
                <th className="py-3 px-3 text-center font-semibold w-20" style={{ color: '#C9A227' }}>
                  Par
                </th>
                <th className="py-3 px-3 text-center font-semibold w-24" style={{ color: '#C9A227' }}>
                  Distance
                </th>
                <th className="py-3 px-3 text-center font-semibold w-24" style={{ color: '#C9A227' }}>
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Front Nine */}
              {formData.holes.slice(0, 9).map((hole, index) => (
                <tr
                  key={hole.hole}
                  style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.15)' }}
                  className="hover:bg-white/5"
                >
                  <td className="py-2 px-3 text-center font-medium text-white">{hole.hole}</td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="3"
                      max="5"
                      value={hole.par}
                      onChange={(e) => updateHole(index, 'par', parseInt(e.target.value) || 4)}
                      className="w-12 p-1 rounded text-center bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={hole.distance || ''}
                      onChange={(e) => updateHole(index, 'distance', parseInt(e.target.value) || 0)}
                      className="w-16 p-1 rounded text-center bg-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                      placeholder="-"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={hole.strokes ?? ''}
                      onChange={(e) =>
                        updateHole(index, 'strokes', e.target.value ? parseInt(e.target.value) : null)
                      }
                      className={`w-14 p-1.5 rounded text-center bg-white/10 focus:outline-none focus:ring-1 focus:ring-[#C9A227] font-semibold ${getScoreColor(
                        hole.strokes,
                        hole.par
                      )}`}
                      placeholder="-"
                    />
                  </td>
                </tr>
              ))}

              {/* Front Nine Subtotal - Only show if 18 holes */}
              {formData.round_length === 18 && (
                <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                  <td className="py-2 px-3 text-center font-semibold text-white/80">OUT</td>
                  <td className="py-2 px-3 text-center font-semibold text-white">
                    {formData.holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}
                  </td>
                  <td className="py-2 px-3 text-center text-white/60">
                    {formData.holes.slice(0, 9).reduce((sum, h) => sum + h.distance, 0)}
                  </td>
                  <td className="py-2 px-3 text-center font-semibold text-white">
                    {formData.holes.slice(0, 9).reduce((sum, h) => sum + (h.strokes || 0), 0) || '-'}
                  </td>
                </tr>
              )}

              {/* Back Nine - Only show if 18 holes */}
              {formData.round_length === 18 && formData.holes.slice(9, 18).map((hole, index) => (
                <tr
                  key={hole.hole}
                  style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.15)' }}
                  className="hover:bg-white/5"
                >
                  <td className="py-2 px-3 text-center font-medium text-white">{hole.hole}</td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="3"
                      max="5"
                      value={hole.par}
                      onChange={(e) => updateHole(index + 9, 'par', parseInt(e.target.value) || 4)}
                      className="w-12 p-1 rounded text-center bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={hole.distance || ''}
                      onChange={(e) => updateHole(index + 9, 'distance', parseInt(e.target.value) || 0)}
                      className="w-16 p-1 rounded text-center bg-white/10 text-white/70 focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                      placeholder="-"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={hole.strokes ?? ''}
                      onChange={(e) =>
                        updateHole(index + 9, 'strokes', e.target.value ? parseInt(e.target.value) : null)
                      }
                      className={`w-14 p-1.5 rounded text-center bg-white/10 focus:outline-none focus:ring-1 focus:ring-[#C9A227] font-semibold ${getScoreColor(
                        hole.strokes,
                        hole.par
                      )}`}
                      placeholder="-"
                    />
                  </td>
                </tr>
              ))}

              {/* Back Nine Subtotal - Only show if 18 holes */}
              {formData.round_length === 18 && (
                <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                  <td className="py-2 px-3 text-center font-semibold text-white/80">IN</td>
                  <td className="py-2 px-3 text-center font-semibold text-white">
                    {formData.holes.slice(9, 18).reduce((sum, h) => sum + h.par, 0)}
                  </td>
                  <td className="py-2 px-3 text-center text-white/60">
                    {formData.holes.slice(9, 18).reduce((sum, h) => sum + h.distance, 0)}
                  </td>
                  <td className="py-2 px-3 text-center font-semibold text-white">
                    {formData.holes.slice(9, 18).reduce((sum, h) => sum + (h.strokes || 0), 0) || '-'}
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total Footer */}
            <tfoot>
              <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.3)' }}>
                <td className="py-3 px-3 text-center font-bold" style={{ color: '#C9A227' }}>
                  TOTAL
                </td>
                <td className="py-3 px-3 text-center font-bold text-white">{totals.totalPar}</td>
                <td className="py-3 px-3 text-center text-white/60">
                  {formData.holes.slice(0, formData.round_length).reduce((sum, h) => sum + h.distance, 0)}
                </td>
                <td className="py-3 px-3 text-center font-bold text-white">
                  {totals.totalStrokes || '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          className="p-4 rounded-xl flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-200 hover:text-white ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#C9A227', color: '#1B4D3E' }}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Round
          </>
        )}
      </button>

      {/* Success Modal - Champagne Styling */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleSuccessClose}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-sm rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300"
            style={{
              backgroundColor: '#0D4D2B',
              border: '2px solid #C9A227',
              boxShadow: '0 0 60px rgba(201, 162, 39, 0.3)',
            }}
          >
            {/* Decorative gold accent lines */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full"
              style={{ backgroundColor: '#C9A227' }}
            />

            {/* Trophy Icon */}
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
              style={{
                backgroundColor: 'rgba(201, 162, 39, 0.2)',
                border: '2px solid #C9A227',
              }}
            >
              <Trophy className="w-10 h-10" style={{ color: '#C9A227' }} />
            </div>

            {/* Success Message */}
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: '#C9A227' }}
            >
              Round Saved!
            </h2>
            <p className="text-white/70 mb-6">
              Your scorecard has been recorded successfully.
            </p>

            {/* Score Summary */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">
                  {totals.totalStrokes} strokes
                </span>
              </div>
              <p className="text-sm text-white/50">
                {totals.scoreToPar === 0
                  ? 'Even par'
                  : totals.scoreToPar > 0
                  ? `+${totals.scoreToPar} over par`
                  : `${totals.scoreToPar} under par`}
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleSuccessClose}
              className="w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: '#C9A227', color: '#0D4D2B' }}
            >
              Great!
            </button>

            {/* Auto-redirect notice */}
            <p className="text-white/40 text-xs mt-4">
              Redirecting to dashboard in 3 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
