'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'

// ============================================
// TYPES - STRICT SCHEMA MATCH
// ============================================

interface HoleInput {
  par: number
  strokeIndex: number
  distance: number
}

interface Course {
  id: string
  name: string
  par: number | null
  rating: number | null
  slope: number
  standard_scratch: number
  hole_count: 9 | 18
  location: string | null
  course_type: string | null
  tee_color: string | null
}

interface CourseHole {
  id: string
  course_id: string
  hole_number: number
  par: number
  stroke_index: number
  distance: number
}

// ============================================
// COMPONENT
// ============================================

export default function AddCoursePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state - course-level fields
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [teeColor, setTeeColor] = useState('White')
  const [courseType, setCourseType] = useState('Parkland')
  const [slope, setSlope] = useState<number | ''>('')
  const [standardScratch, setStandardScratch] = useState<number | ''>('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)

  // Hole data
  const [holes, setHoles] = useState<HoleInput[]>(
    Array.from({ length: 18 }, (_, i) => ({
      par: 4,
      strokeIndex: i + 1,
      distance: 0,
    }))
  )

  // When hole count changes, reset holes array
  const handleHoleCountChange = (count: 9 | 18) => {
    setHoleCount(count)
    setHoles(
      Array.from({ length: count }, (_, i) => ({
        par: 4,
        strokeIndex: i + 1,
        distance: 0,
      }))
    )
  }

  // Only use the rendered holes for calculations
  const renderedHoles = holes.slice(0, holeCount)
  const totalPar = renderedHoles.reduce((sum, h) => sum + h.par, 0)
  const frontNinePar = renderedHoles.slice(0, 9).reduce((sum, h) => sum + h.par, 0)
  const backNinePar = holeCount === 18 ? renderedHoles.slice(9, 18).reduce((sum, h) => sum + h.par, 0) : 0

  const updateHole = (index: number, field: keyof HoleInput, value: number) => {
    setHoles(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // ============================================
  // VALIDATION - form is valid only when everything is filled
  // ============================================

  const isFormComplete = useMemo(() => {
    if (!name.trim()) return false
    if (!teeColor.trim()) return false
    if (slope === '' || slope <= 0) return false
    if (standardScratch === '' || standardScratch <= 0) return false

    // Every rendered hole must have distance > 0
    for (let i = 0; i < holeCount; i++) {
      if (holes[i].distance <= 0) return false
    }

    // Stroke indexes must be unique 1-N
    const siValues = holes.slice(0, holeCount).map(h => h.strokeIndex)
    const uniqueSI = new Set(siValues)
    if (uniqueSI.size !== holeCount) return false
    if (siValues.some(si => si < 1 || si > holeCount)) return false

    return true
  }, [name, teeColor, slope, standardScratch, holeCount, holes])

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError('Course name is required')
      return false
    }
    if (!teeColor.trim()) {
      setError('Tee color is required')
      return false
    }
    if (slope === '' || slope <= 0) {
      setError('Slope is required and must be a positive number')
      return false
    }
    if (standardScratch === '' || standardScratch <= 0) {
      setError('Standard Scratch (SSS) is required and must be a positive number')
      return false
    }

    for (let i = 0; i < holeCount; i++) {
      if (holes[i].distance <= 0) {
        setError(`Hole ${i + 1} is missing a distance`)
        return false
      }
    }

    const siValues = holes.slice(0, holeCount).map(h => h.strokeIndex)
    const uniqueSI = new Set(siValues)
    if (uniqueSI.size !== holeCount) {
      setError(`Each stroke index must be unique (1-${holeCount}). Please check for duplicates.`)
      return false
    }
    if (siValues.some(si => si < 1 || si > holeCount)) {
      setError(`Stroke index must be between 1 and ${holeCount}`)
      return false
    }

    return true
  }

  // ============================================
  // SUBMIT HANDLER
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Supabase Error:', JSON.stringify(authError, null, 2))
        setError('You must be logged in to add a course')
        setIsSubmitting(false)
        return
      }

      // ============================================
      // STEP 1: INSERT INTO courses TABLE
      // ============================================
      const courseData = {
        name: name.trim(),
        location: location.trim() || null,
        tee_color: teeColor.trim(),
        par: totalPar,
        course_type: courseType,
        slope: Number(slope),
        standard_scratch: Number(standardScratch),
        hole_count: holeCount,
      }

      console.log('Inserting course:', JSON.stringify(courseData, null, 2))

      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert(courseData)
        .select('id')
        .single()

      if (courseError) {
        console.error('Supabase Error:', JSON.stringify(courseError, null, 2))
        setError(`Failed to save course: ${courseError.message || 'Unknown error'}`)
        setIsSubmitting(false)
        return
      }

      if (!course?.id) {
        console.error('Supabase Error: No course ID returned')
        setError('Failed to save course: No ID returned')
        setIsSubmitting(false)
        return
      }

      console.log('Course created with ID:', course.id)

      // ============================================
      // STEP 2: BULK INSERT INTO course_holes TABLE
      // ============================================
      const holesData = renderedHoles.map((hole, index) => ({
        course_id: course.id,
        hole_number: Number(index + 1),
        par: Number(hole.par),
        stroke_index: Number(hole.strokeIndex),
        distance: Number(hole.distance),
      }))

      console.log('Inserting holes:', JSON.stringify(holesData, null, 2))

      const { error: holesError } = await supabase
        .from('course_holes')
        .insert(holesData)

      if (holesError) {
        console.error('Supabase Error:', JSON.stringify(holesError, null, 2))
        setError(`Course saved but hole data failed: ${holesError.message || 'Unknown error'}`)
        setIsSubmitting(false)
        return
      }

      // ============================================
      // SUCCESS
      // ============================================
      console.log(`All ${holeCount} holes saved successfully`)
      setSuccess(`"${name}" added successfully with all ${holeCount} holes!`)

      setTimeout(() => {
        router.push('/dashboard/add-round')
      }, 2000)

    } catch (err) {
      console.error('Supabase Error:', JSON.stringify(err, null, 2))
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // SHARED STYLES
  // ============================================

  const inputStyle = { border: '1px solid rgba(201, 162, 39, 0.5)', '--tw-ring-color': '#C9A227' } as React.CSSProperties
  const selectCellStyle = { border: '1px solid rgba(201, 162, 39, 0.5)' }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1B4D3E' }}>
      {/* Back Link */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div
          className="rounded-2xl shadow-xl overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(201, 162, 39, 0.3)',
          }}
        >
          {/* Header */}
          <div
            className="px-6 py-5"
            style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
          >
            <h1 className="text-2xl font-bold" style={{ color: '#C9A227' }}>
              Add New Course
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Enter course details and hole-by-hole Par, Stroke Index & Distance
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {/* Error Message */}
            {error && (
              <div
                className="mb-6 p-4 rounded-lg flex items-start gap-3"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-red-200 text-sm">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div
                className="mb-6 p-4 rounded-lg flex items-start gap-3"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                }}
              >
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-green-200 text-sm">{success}</span>
              </div>
            )}

            {/* Course Details */}
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                Course Details
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Course Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="e.g., Portmarnock Golf Club"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="e.g., Portmarnock, Dublin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Slope <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={slope}
                    onChange={(e) => setSlope(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="e.g., 135"
                    min={55}
                    max={155}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Standard Scratch (SSS) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={standardScratch}
                    onChange={(e) => setStandardScratch(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2"
                    style={inputStyle}
                    placeholder="e.g., 72"
                    min={1}
                    max={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Course Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2"
                    style={inputStyle}
                  >
                    <option value="Parkland" className="bg-[#1B4D3E] text-white">Parkland</option>
                    <option value="Links" className="bg-[#1B4D3E] text-white">Links</option>
                    <option value="Heathland" className="bg-[#1B4D3E] text-white">Heathland</option>
                    <option value="Desert" className="bg-[#1B4D3E] text-white">Desert</option>
                    <option value="Resort" className="bg-[#1B4D3E] text-white">Resort</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Tee Color <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={teeColor}
                    onChange={(e) => setTeeColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2"
                    style={inputStyle}
                  >
                    <option value="White" className="bg-[#1B4D3E] text-white">White</option>
                    <option value="Blue" className="bg-[#1B4D3E] text-white">Blue</option>
                    <option value="Yellow" className="bg-[#1B4D3E] text-white">Yellow</option>
                    <option value="Red" className="bg-[#1B4D3E] text-white">Red</option>
                    <option value="Green" className="bg-[#1B4D3E] text-white">Green</option>
                    <option value="Championship" className="bg-[#1B4D3E] text-white">Championship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">
                    Holes <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleHoleCountChange(9)}
                      className="flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors"
                      style={
                        holeCount === 9
                          ? { backgroundColor: '#C9A227', color: '#1B4D3E' }
                          : { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(201, 162, 39, 0.5)' }
                      }
                    >
                      9 Holes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHoleCountChange(18)}
                      className="flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors"
                      style={
                        holeCount === 18
                          ? { backgroundColor: '#C9A227', color: '#1B4D3E' }
                          : { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(201, 162, 39, 0.5)' }
                      }
                    >
                      18 Holes
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hole-by-Hole Grid */}
            <div style={{ borderTop: '1px solid rgba(201, 162, 39, 0.3)' }} className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                  Hole Data (Par, S.I. & Distance)
                </h2>
                <div
                  className="text-sm font-medium px-3 py-1 rounded-full"
                  style={{ backgroundColor: '#C9A227', color: '#1B4D3E' }}
                >
                  Total Par: {totalPar}
                </div>
              </div>

              {/* Desktop Grid - Front 9 */}
              <div className="hidden md:block mb-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.3)' }}>
                      <th className="py-2 px-2 text-white font-medium text-left w-16">Hole</th>
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                        <th key={n} className="py-2 px-1 text-white font-medium text-center w-14">{n}</th>
                      ))}
                      <th className="py-2 px-2 font-medium text-center w-16" style={{ backgroundColor: '#C9A227', color: '#1B4D3E' }}>OUT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                      <td className="py-2 px-2 font-medium text-white/70">Par</td>
                      {holes.slice(0, 9).map((hole, i) => (
                        <td key={i} className="py-1 px-1">
                          <select
                            value={hole.par}
                            onChange={(e) => updateHole(i, 'par', parseInt(e.target.value, 10))}
                            className="w-full p-1 rounded text-center text-sm bg-white/10 text-white"
                            style={selectCellStyle}
                          >
                            <option value={3} className="bg-[#1B4D3E]">3</option>
                            <option value={4} className="bg-[#1B4D3E]">4</option>
                            <option value={5} className="bg-[#1B4D3E]">5</option>
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center font-bold" style={{ color: '#C9A227' }}>{frontNinePar}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2 font-medium text-white/70">S.I.</td>
                      {holes.slice(0, 9).map((hole, i) => (
                        <td key={i} className="py-1 px-1">
                          <select
                            value={hole.strokeIndex}
                            onChange={(e) => updateHole(i, 'strokeIndex', parseInt(e.target.value, 10))}
                            className="w-full p-1 rounded text-center text-sm bg-white/10 text-white"
                            style={selectCellStyle}
                          >
                            {Array.from({ length: holeCount }, (_, n) => (
                              <option key={n + 1} value={n + 1} className="bg-[#1B4D3E]">{n + 1}</option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-2"></td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}>
                      <td className="py-2 px-2 font-medium text-white/70">Dist</td>
                      {holes.slice(0, 9).map((hole, i) => (
                        <td key={i} className="py-1 px-1">
                          <input
                            type="number"
                            value={hole.distance || ''}
                            onChange={(e) => updateHole(i, 'distance', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                            className="w-full p-1 rounded text-center text-sm bg-white/10 text-white placeholder-white/30"
                            style={selectCellStyle}
                            placeholder="yds"
                            min={1}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Desktop Grid - Back 9 */}
              {holeCount === 18 && (
                <div className="hidden md:block">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.3)' }}>
                        <th className="py-2 px-2 text-white font-medium text-left w-16">Hole</th>
                        {[10,11,12,13,14,15,16,17,18].map(n => (
                          <th key={n} className="py-2 px-1 text-white font-medium text-center w-14">{n}</th>
                        ))}
                        <th className="py-2 px-2 font-medium text-center w-16" style={{ backgroundColor: '#C9A227', color: '#1B4D3E' }}>IN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                        <td className="py-2 px-2 font-medium text-white/70">Par</td>
                        {holes.slice(9, 18).map((hole, i) => (
                          <td key={i} className="py-1 px-1">
                            <select
                              value={hole.par}
                              onChange={(e) => updateHole(i + 9, 'par', parseInt(e.target.value, 10))}
                              className="w-full p-1 rounded text-center text-sm bg-white/10 text-white"
                              style={selectCellStyle}
                            >
                              <option value={3} className="bg-[#1B4D3E]">3</option>
                              <option value={4} className="bg-[#1B4D3E]">4</option>
                              <option value={5} className="bg-[#1B4D3E]">5</option>
                            </select>
                          </td>
                        ))}
                        <td className="py-2 px-2 text-center font-bold" style={{ color: '#C9A227' }}>{backNinePar}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-medium text-white/70">S.I.</td>
                        {holes.slice(9, 18).map((hole, i) => (
                          <td key={i} className="py-1 px-1">
                            <select
                              value={hole.strokeIndex}
                              onChange={(e) => updateHole(i + 9, 'strokeIndex', parseInt(e.target.value, 10))}
                              className="w-full p-1 rounded text-center text-sm bg-white/10 text-white"
                              style={selectCellStyle}
                            >
                              {Array.from({ length: holeCount }, (_, n) => (
                                <option key={n + 1} value={n + 1} className="bg-[#1B4D3E]">{n + 1}</option>
                              ))}
                            </select>
                          </td>
                        ))}
                        <td className="py-2 px-2"></td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}>
                        <td className="py-2 px-2 font-medium text-white/70">Dist</td>
                        {holes.slice(9, 18).map((hole, i) => (
                          <td key={i} className="py-1 px-1">
                            <input
                              type="number"
                              value={hole.distance || ''}
                              onChange={(e) => updateHole(i + 9, 'distance', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                              className="w-full p-1 rounded text-center text-sm bg-white/10 text-white placeholder-white/30"
                              style={selectCellStyle}
                              placeholder="yds"
                              min={1}
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Grid */}
              <div className="md:hidden space-y-6">
                {/* Front 9 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: '#C9A227' }}>Front 9</h3>
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-1 text-xs font-medium text-white/60 pb-1" style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}>
                      <span>Hole</span>
                      <span className="text-center">Par</span>
                      <span className="text-center">S.I.</span>
                      <span className="text-center">Dist</span>
                    </div>
                    {holes.slice(0, 9).map((hole, i) => (
                      <div key={i} className="grid grid-cols-4 gap-1 items-center">
                        <span className="text-sm font-medium text-white">{i + 1}</span>
                        <select
                          value={hole.par}
                          onChange={(e) => updateHole(i, 'par', parseInt(e.target.value, 10))}
                          className="text-xs p-1 rounded text-center bg-white/10 text-white"
                          style={selectCellStyle}
                        >
                          <option value={3} className="bg-[#1B4D3E]">3</option>
                          <option value={4} className="bg-[#1B4D3E]">4</option>
                          <option value={5} className="bg-[#1B4D3E]">5</option>
                        </select>
                        <select
                          value={hole.strokeIndex}
                          onChange={(e) => updateHole(i, 'strokeIndex', parseInt(e.target.value, 10))}
                          className="text-xs p-1 rounded text-center bg-white/10 text-white"
                          style={selectCellStyle}
                        >
                          {Array.from({ length: holeCount }, (_, n) => (
                            <option key={n + 1} value={n + 1} className="bg-[#1B4D3E]">{n + 1}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={hole.distance || ''}
                          onChange={(e) => updateHole(i, 'distance', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                          className="text-xs p-1 rounded text-center bg-white/10 text-white placeholder-white/30"
                          style={selectCellStyle}
                          placeholder="yds"
                          min={1}
                        />
                      </div>
                    ))}
                    <div className="pt-1 text-sm font-medium" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)', color: '#C9A227' }}>
                      Out: {frontNinePar}
                    </div>
                  </div>
                </div>

                {/* Back 9 */}
                {holeCount === 18 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#C9A227' }}>Back 9</h3>
                    <div className="space-y-1">
                      <div className="grid grid-cols-4 gap-1 text-xs font-medium text-white/60 pb-1" style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.2)' }}>
                        <span>Hole</span>
                        <span className="text-center">Par</span>
                        <span className="text-center">S.I.</span>
                        <span className="text-center">Dist</span>
                      </div>
                      {holes.slice(9, 18).map((hole, i) => (
                        <div key={i} className="grid grid-cols-4 gap-1 items-center">
                          <span className="text-sm font-medium text-white">{i + 10}</span>
                          <select
                            value={hole.par}
                            onChange={(e) => updateHole(i + 9, 'par', parseInt(e.target.value, 10))}
                            className="text-xs p-1 rounded text-center bg-white/10 text-white"
                            style={selectCellStyle}
                          >
                            <option value={3} className="bg-[#1B4D3E]">3</option>
                            <option value={4} className="bg-[#1B4D3E]">4</option>
                            <option value={5} className="bg-[#1B4D3E]">5</option>
                          </select>
                          <select
                            value={hole.strokeIndex}
                            onChange={(e) => updateHole(i + 9, 'strokeIndex', parseInt(e.target.value, 10))}
                            className="text-xs p-1 rounded text-center bg-white/10 text-white"
                            style={selectCellStyle}
                          >
                            {Array.from({ length: holeCount }, (_, n) => (
                              <option key={n + 1} value={n + 1} className="bg-[#1B4D3E]">{n + 1}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={hole.distance || ''}
                            onChange={(e) => updateHole(i + 9, 'distance', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                            className="text-xs p-1 rounded text-center bg-white/10 text-white placeholder-white/30"
                            style={selectCellStyle}
                            placeholder="yds"
                            min={1}
                          />
                        </div>
                      ))}
                      <div className="pt-1 text-sm font-medium" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)', color: '#C9A227' }}>
                        In: {backNinePar}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 mt-8 pt-6" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.3)' }}>
              <Link
                href="/dashboard"
                className="flex-1 py-3 px-4 rounded-lg font-medium text-center transition-colors hover:bg-white/10"
                style={{ border: '2px solid #C9A227', color: '#C9A227' }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !isFormComplete}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#C9A227', color: '#1B4D3E' }}
              >
                {isSubmitting ? 'Saving...' : 'Save Course'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
