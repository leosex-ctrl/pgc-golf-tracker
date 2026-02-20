'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Trophy, CheckCircle, Search, ChevronDown } from 'lucide-react'
import { GeminiExtractedData } from '@/app/actions/gemini-upload'
import { saveRound } from '@/app/actions/save-round'
import { createClient } from '@/lib/supabase'

// ============================================
// TYPES
// ============================================

type RoundLength = 9 | 18

interface CourseOption {
  id: string
  name: string
  hole_count: 9 | 18
  slope: number | null
  standard_scratch: number | null
  location: string | null
}

interface CourseHoleData {
  hole_number: number
  par: number
  stroke_index: number
  distance: number
}

interface HoleEntry {
  hole: number
  par: number
  distance: number
  strokeIndex: number
  strokes: number | null
}

interface FormData {
  course_id: string
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

// ============================================
// COMPONENT
// ============================================

export default function RoundEntryForm({ initialData, onSave }: RoundEntryFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Course selection state
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Form state
  const [date, setDate] = useState(
    initialData?.round_details?.date_of_round || new Date().toISOString().split('T')[0]
  )
  const [weather, setWeather] = useState(
    initialData?.grounded_info?.weather_conditions || ''
  )
  const [holes, setHoles] = useState<HoleEntry[]>([])

  // AI-extracted strokes to apply after course selection
  const [aiStrokes, setAiStrokes] = useState<Map<number, number> | null>(null)

  // ============================================
  // FETCH COURSES ON MOUNT
  // ============================================

  useEffect(() => {
    const fetchCourses = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, hole_count, slope, standard_scratch, location')
        .order('name')

      if (!error && data) {
        setCourses(data as CourseOption[])
      }
      setCoursesLoading(false)
    }
    fetchCourses()
  }, [])

  // If AI data provided, stash the strokes for later
  useEffect(() => {
    if (initialData?.hole_data) {
      const strokesMap = new Map<number, number>()
      initialData.hole_data.forEach((h) => {
        if (h.strokes != null) {
          strokesMap.set(h.hole, h.strokes)
        }
      })
      setAiStrokes(strokesMap)

      // Try to auto-select a matching course by name
      if (initialData.round_details?.course_name) {
        setCourseSearch(initialData.round_details.course_name)
      }
    }
  }, [initialData])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ============================================
  // COURSE SELECTION
  // ============================================

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses
    const q = courseSearch.toLowerCase()
    return courses.filter((c) => c.name.toLowerCase().includes(q))
  }, [courses, courseSearch])

  const handleSelectCourse = async (course: CourseOption) => {
    setSelectedCourse(course)
    setCourseSearch(course.name)
    setDropdownOpen(false)

    // Fetch hole data for this course
    const supabase = createClient()
    const { data: courseHoles, error } = await supabase
      .from('course_holes')
      .select('hole_number, par, stroke_index, distance')
      .eq('course_id', course.id)
      .order('hole_number')

    if (!error && courseHoles) {
      const holeEntries: HoleEntry[] = (courseHoles as CourseHoleData[]).map((ch) => ({
        hole: ch.hole_number,
        par: ch.par,
        distance: ch.distance,
        strokeIndex: ch.stroke_index,
        strokes: aiStrokes?.get(ch.hole_number) ?? null,
      }))
      setHoles(holeEntries)
    }
  }

  // ============================================
  // CALCULATIONS
  // ============================================

  const roundLength = selectedCourse?.hole_count ?? 18
  const activeHoles = holes.slice(0, roundLength)

  const totals = useMemo(() => {
    const totalPar = activeHoles.reduce((sum, h) => sum + h.par, 0)
    const filledHoles = activeHoles.filter((h) => h.strokes !== null && h.strokes > 0)
    const totalStrokes = filledHoles.reduce((sum, h) => sum + (h.strokes || 0), 0)
    const holesPlayed = filledHoles.length
    const scoreToPar = holesPlayed > 0 ? totalStrokes - filledHoles.reduce((s, h) => s + h.par, 0) : 0

    return { totalPar, totalStrokes, holesPlayed, scoreToPar }
  }, [activeHoles])

  // ============================================
  // HANDLERS
  // ============================================

  const updateHoleStrokes = (index: number, value: number | null) => {
    setHoles((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], strokes: value }
      return updated
    })
  }

  const handleSave = async () => {
    if (!selectedCourse) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      // Apply triple bogey rule: blank holes = par + 3
      const finalHoles = activeHoles.map((h) => ({
        hole: h.hole,
        par: h.par,
        distance: h.distance,
        strokeIndex: h.strokeIndex,
        strokes: h.strokes !== null && h.strokes > 0 ? h.strokes : h.par + 3,
      }))

      const formData: FormData = {
        course_id: selectedCourse.id,
        course_name: selectedCourse.name,
        date,
        weather,
        course_rating: null,
        slope_rating: selectedCourse.slope,
        holes: finalHoles,
        round_length: roundLength,
      }

      const result = await saveRound(formData)

      if (result.success) {
        setShowSuccess(true)
        if (onSave) onSave(formData)
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
    if (strokes < par) return 'text-blue-400'
    if (strokes > par) return 'text-red-400'
    return 'text-white'
  }

  // ============================================
  // RENDER
  // ============================================

  // Compute totals for the success modal using triple bogey rule
  const finalTotals = useMemo(() => {
    const filled = activeHoles.map((h) => ({
      strokes: h.strokes !== null && h.strokes > 0 ? h.strokes : h.par + 3,
      par: h.par,
    }))
    const totalStrokes = filled.reduce((s, h) => s + h.strokes, 0)
    const totalPar = filled.reduce((s, h) => s + h.par, 0)
    return { totalStrokes, scoreToPar: totalStrokes - totalPar }
  }, [activeHoles])

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Course Searchable Dropdown */}
          <div className="md:col-span-3" ref={dropdownRef}>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Course <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => {
                    setCourseSearch(e.target.value)
                    setDropdownOpen(true)
                    if (selectedCourse && e.target.value !== selectedCourse.name) {
                      setSelectedCourse(null)
                      setHoles([])
                    }
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={coursesLoading ? 'Loading courses...' : 'Search for a course...'}
                  disabled={coursesLoading}
                  className="w-full pl-10 pr-10 py-2 bg-transparent text-white border-b-2 border-[#C9A227] focus:outline-none focus:border-[#C9A227] placeholder:text-white/30"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              </div>

              {dropdownOpen && filteredCourses.length > 0 && (
                <div
                  className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg shadow-xl"
                  style={{
                    backgroundColor: '#1B4D3E',
                    border: '1px solid rgba(201, 162, 39, 0.5)',
                  }}
                >
                  {filteredCourses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => handleSelectCourse(course)}
                      className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex justify-between items-center"
                      style={{
                        borderBottom: '1px solid rgba(201, 162, 39, 0.15)',
                      }}
                    >
                      <div>
                        <div className="text-white font-medium text-sm">{course.name}</div>
                        {course.location && (
                          <div className="text-white/50 text-xs">{course.location}</div>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)', color: '#C9A227' }}>
                        {course.hole_count}H
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {dropdownOpen && !coursesLoading && filteredCourses.length === 0 && courseSearch.trim() && (
                <div
                  className="absolute z-50 w-full mt-1 rounded-lg shadow-xl p-4 text-center"
                  style={{
                    backgroundColor: '#1B4D3E',
                    border: '1px solid rgba(201, 162, 39, 0.5)',
                  }}
                >
                  <p className="text-white/50 text-sm">No courses found</p>
                  <p className="text-white/30 text-xs mt-1">Add a course first from the Courses page</p>
                </div>
              )}
            </div>

            {/* Selected course info badges */}
            {selectedCourse && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#C9A227' }}>
                  {selectedCourse.hole_count} Holes
                </span>
                {selectedCourse.slope && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#C9A227' }}>
                    Slope: {selectedCourse.slope}
                  </span>
                )}
                {selectedCourse.standard_scratch && (
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)', color: '#C9A227' }}>
                    SSS: {selectedCourse.standard_scratch}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 bg-transparent text-white border-b-2 border-[#C9A227] focus:outline-none focus:border-[#C9A227]"
            />
          </div>

          {/* Weather */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Weather</label>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
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
      </div>

      {/* Scorecard Grid - only render when a course is selected */}
      {selectedCourse && holes.length > 0 && (
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
            <div className="flex items-center gap-3">
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
          </div>

          {/* Blank score hint */}
          <div className="px-6 py-2" style={{ backgroundColor: 'rgba(201, 162, 39, 0.08)' }}>
            <p className="text-white/40 text-xs">
              Leave a score blank to record a scratched hole (Par + 3)
            </p>
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
                    Dist (yds)
                  </th>
                  <th className="py-3 px-3 text-center font-semibold w-24" style={{ color: '#C9A227' }}>
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Front Nine */}
                {activeHoles.slice(0, 9).map((hole, index) => (
                  <tr
                    key={hole.hole}
                    style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.15)' }}
                    className="hover:bg-white/5"
                  >
                    <td className="py-2 px-3 text-center font-medium text-white">{hole.hole}</td>
                    <td className="py-2 px-3 text-center text-white/70">{hole.par}</td>
                    <td className="py-2 px-3 text-center text-white/50">{hole.distance || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={hole.strokes ?? ''}
                        onChange={(e) =>
                          updateHoleStrokes(index, e.target.value ? parseInt(e.target.value) : null)
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
                {roundLength === 18 && (
                  <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                    <td className="py-2 px-3 text-center font-semibold text-white/80">OUT</td>
                    <td className="py-2 px-3 text-center font-semibold text-white">
                      {activeHoles.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}
                    </td>
                    <td className="py-2 px-3 text-center text-white/60">
                      {activeHoles.slice(0, 9).reduce((sum, h) => sum + h.distance, 0)}
                    </td>
                    <td className="py-2 px-3 text-center font-semibold text-white">
                      {activeHoles.slice(0, 9).reduce((sum, h) => sum + (h.strokes || 0), 0) || '-'}
                    </td>
                  </tr>
                )}

                {/* Back Nine - Only show if 18 holes */}
                {roundLength === 18 && activeHoles.slice(9, 18).map((hole, index) => (
                  <tr
                    key={hole.hole}
                    style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.15)' }}
                    className="hover:bg-white/5"
                  >
                    <td className="py-2 px-3 text-center font-medium text-white">{hole.hole}</td>
                    <td className="py-2 px-3 text-center text-white/70">{hole.par}</td>
                    <td className="py-2 px-3 text-center text-white/50">{hole.distance || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={hole.strokes ?? ''}
                        onChange={(e) =>
                          updateHoleStrokes(index + 9, e.target.value ? parseInt(e.target.value) : null)
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
                {roundLength === 18 && (
                  <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                    <td className="py-2 px-3 text-center font-semibold text-white/80">IN</td>
                    <td className="py-2 px-3 text-center font-semibold text-white">
                      {activeHoles.slice(9, 18).reduce((sum, h) => sum + h.par, 0)}
                    </td>
                    <td className="py-2 px-3 text-center text-white/60">
                      {activeHoles.slice(9, 18).reduce((sum, h) => sum + h.distance, 0)}
                    </td>
                    <td className="py-2 px-3 text-center font-semibold text-white">
                      {activeHoles.slice(9, 18).reduce((sum, h) => sum + (h.strokes || 0), 0) || '-'}
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
                    {activeHoles.reduce((sum, h) => sum + h.distance, 0)}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-white">
                    {totals.totalStrokes || '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Prompt to select course if none selected */}
      {!selectedCourse && (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px dashed rgba(201, 162, 39, 0.3)',
          }}
        >
          <p className="text-white/40 text-sm">Select a course above to load the scorecard</p>
        </div>
      )}

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
        disabled={isSaving || !selectedCourse}
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

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleSuccessClose}
          />
          <div
            className="relative w-full max-w-sm rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300"
            style={{
              backgroundColor: '#0D4D2B',
              border: '2px solid #C9A227',
              boxShadow: '0 0 60px rgba(201, 162, 39, 0.3)',
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full"
              style={{ backgroundColor: '#C9A227' }}
            />
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
              style={{
                backgroundColor: 'rgba(201, 162, 39, 0.2)',
                border: '2px solid #C9A227',
              }}
            >
              <Trophy className="w-10 h-10" style={{ color: '#C9A227' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#C9A227' }}>
              Round Saved!
            </h2>
            <p className="text-white/70 mb-6">
              Your scorecard has been recorded successfully.
            </p>
            <div
              className="rounded-xl p-4 mb-6"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">
                  {finalTotals.totalStrokes} strokes
                </span>
              </div>
              <p className="text-sm text-white/50">
                {finalTotals.scoreToPar === 0
                  ? 'Even par'
                  : finalTotals.scoreToPar > 0
                  ? `+${finalTotals.scoreToPar} over par`
                  : `${finalTotals.scoreToPar} under par`}
              </p>
            </div>
            <button
              onClick={handleSuccessClose}
              className="w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: '#C9A227', color: '#0D4D2B' }}
            >
              Great!
            </button>
            <p className="text-white/40 text-xs mt-4">
              Redirecting to dashboard in 3 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
