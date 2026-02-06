'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Flag, PlusCircle, Trash2, Pencil, X, Check, MapPin, TreePine, Loader2 } from 'lucide-react'
import { deleteCourse, updateCourse } from '@/app/actions/course-management'

// ============================================
// TYPES
// ============================================

interface Course {
  id: string
  name: string
  par: number | null
  rating: number | null
  slope: number | null
  location: string | null
  course_type: string | null
  tee_color: string | null
  rounds_count: number
}

interface EditFormData {
  name: string
  par: string
  rating: string
  slope: string
  location: string
  course_type: string
  tee_color: string
}

// ============================================
// CONSTANTS
// ============================================

const COURSE_TYPES = ['Parkland', 'Links', 'Heathland', 'Desert', 'Resort']
const TEE_COLORS = ['White', 'Blue', 'Yellow', 'Red', 'Green', 'Championship']

const PGC_GOLD = '#C9A227'
const PGC_DARK_GREEN = '#0D4D2B'

// ============================================
// COMPONENT
// ============================================

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    par: '',
    rating: '',
    slope: '',
    location: '',
    course_type: 'Parkland',
    tee_color: 'White',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Auth error:', authError)
        return
      }

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

      // Fetch all courses with course_type and tee_color
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, par, rating, slope, location, course_type, tee_color')
        .order('name', { ascending: true })

      if (coursesError) {
        console.error('Courses error:', coursesError)
        setError(`Failed to load courses: ${coursesError.message}`)
        return
      }

      // Count rounds for each course
      const coursesWithCounts: Course[] = []

      for (const course of (coursesData || [])) {
        const { count } = await supabase
          .from('rounds')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id)

        coursesWithCounts.push({
          ...course,
          rounds_count: count || 0,
        })
      }

      setCourses(coursesWithCounts)

    } catch (err) {
      console.error('Fetch error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (courseId: string, courseName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${courseName}"?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingId(courseId)

    try {
      const result = await deleteCourse(courseId)

      if (result.success) {
        setCourses(prev => prev.filter(c => c.id !== courseId))
      } else {
        alert(result.error || 'Failed to delete course')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('An unexpected error occurred while deleting')
    } finally {
      setDeletingId(null)
    }
  }

  const openEditModal = (course: Course) => {
    setEditingCourse(course)
    setEditForm({
      name: course.name || '',
      par: course.par?.toString() || '',
      rating: course.rating?.toString() || '',
      slope: course.slope?.toString() || '',
      location: course.location || '',
      course_type: course.course_type || 'Parkland',
      tee_color: course.tee_color || 'White',
    })
    setEditError('')
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingCourse(null)
    setEditForm({
      name: '',
      par: '',
      rating: '',
      slope: '',
      location: '',
      course_type: 'Parkland',
      tee_color: 'White',
    })
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editingCourse) return

    if (!editForm.name.trim()) {
      setEditError('Course name is required')
      return
    }

    setSavingEdit(true)
    setEditError('')

    try {
      const result = await updateCourse(editingCourse.id, {
        name: editForm.name.trim(),
        par: editForm.par ? parseInt(editForm.par) : undefined,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
        slope: editForm.slope ? parseInt(editForm.slope) : null,
        location: editForm.location.trim() || null,
        course_type: editForm.course_type || null,
        tee_color: editForm.tee_color || null,
      })

      if (result.success) {
        // Update local state
        setCourses(prev => prev.map(c =>
          c.id === editingCourse.id
            ? {
                ...c,
                name: editForm.name.trim(),
                par: editForm.par ? parseInt(editForm.par) : null,
                rating: editForm.rating ? parseFloat(editForm.rating) : null,
                slope: editForm.slope ? parseInt(editForm.slope) : null,
                location: editForm.location.trim() || null,
                course_type: editForm.course_type || null,
                tee_color: editForm.tee_color || null,
              }
            : c
        ))
        closeEditModal()
      } else {
        setEditError(result.error || 'Failed to update course')
      }
    } catch (err) {
      console.error('Update error:', err)
      setEditError('An unexpected error occurred while updating')
    } finally {
      setSavingEdit(false)
    }
  }

  // Get course type badge color
  const getCourseTypeColor = (type: string | null) => {
    switch (type) {
      case 'Links': return '#3B82F6'
      case 'Parkland': return '#22C55E'
      case 'Heathland': return '#A855F7'
      case 'Desert': return '#F59E0B'
      case 'Resort': return '#EC4899'
      default: return '#6B7280'
    }
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
            style={{ borderTopColor: PGC_GOLD }}
          />
          <p className="text-white/60">Loading courses...</p>
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
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: PGC_GOLD }}>
            Course Management
          </h1>
          <p className="text-white/60 mt-1">
            View and manage golf courses
          </p>
        </div>
        <Link
          href="/dashboard/add-course"
          className="btn-gold inline-flex items-center gap-2 text-sm py-2 px-4 self-start"
        >
          <PlusCircle className="w-4 h-4" />
          Add Course
        </Link>
      </div>

      {/* Admin Notice */}
      {!isAdmin && (
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: 'rgba(201, 162, 39, 0.15)',
            border: '1px solid rgba(201, 162, 39, 0.3)',
          }}
        >
          <p className="text-white/70 text-sm">
            Only administrators can edit or delete courses.
          </p>
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

      {/* Courses List */}
      {courses.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Flag className="w-8 h-8" style={{ color: PGC_GOLD }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Courses Found</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            No courses have been added yet. Add your first course to get started!
          </p>
          <Link
            href="/dashboard/add-course"
            className="btn-gold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add Course
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: PGC_GOLD }}>
              All Courses
            </h2>
            <span className="text-sm text-white/40">{courses.length} courses</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Course Name
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Type
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Par
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Rating
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Slope
                  </th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                    Rounds
                  </th>
                  {isAdmin && (
                    <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-white/5 transition-colors"
                    style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.1)' }}
                  >
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-sm font-medium text-white">{course.name}</p>
                        {course.location && (
                          <p className="text-xs text-white/50 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {course.location}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {course.course_type ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getCourseTypeColor(course.course_type)}20`,
                            color: getCourseTypeColor(course.course_type),
                          }}
                        >
                          <TreePine className="w-3 h-3" />
                          {course.course_type}
                        </span>
                      ) : (
                        <span className="text-white/30 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-white/70">
                      {course.par || '—'}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-white/70">
                      {course.rating?.toFixed(1) || '—'}
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-white/70">
                      {course.slope || '—'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: course.rounds_count > 0
                            ? 'rgba(201, 162, 39, 0.2)'
                            : 'rgba(255, 255, 255, 0.1)',
                          color: course.rounds_count > 0 ? PGC_GOLD : 'rgba(255, 255, 255, 0.5)',
                        }}
                      >
                        {course.rounds_count}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(course)}
                            className="p-2 rounded-lg transition-colors hover:bg-white/10"
                            title="Edit course"
                          >
                            <Pencil className="w-4 h-4" style={{ color: PGC_GOLD }} />
                          </button>
                          <button
                            onClick={() => handleDelete(course.id, course.name)}
                            disabled={deletingId === course.id || course.rounds_count > 0}
                            className="p-2 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={course.rounds_count > 0 ? 'Cannot delete - has rounds' : 'Delete course'}
                          >
                            {deletingId === course.id ? (
                              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y" style={{ borderColor: 'rgba(201, 162, 39, 0.2)' }}>
            {courses.map((course) => (
              <div key={course.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-white">{course.name}</p>
                    {course.location && (
                      <p className="text-xs text-white/50 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {course.location}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {course.course_type && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getCourseTypeColor(course.course_type)}20`,
                            color: getCourseTypeColor(course.course_type),
                          }}
                        >
                          <TreePine className="w-3 h-3" />
                          {course.course_type}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-white/50">
                      <span>Par: {course.par || '—'}</span>
                      <span>Rating: {course.rating?.toFixed(1) || '—'}</span>
                      <span>Slope: {course.slope || '—'}</span>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      {course.rounds_count} round{course.rounds_count !== 1 ? 's' : ''} played
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openEditModal(course)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/10"
                        title="Edit course"
                      >
                        <Pencil className="w-4 h-4" style={{ color: PGC_GOLD }} />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id, course.name)}
                        disabled={deletingId === course.id || course.rounds_count > 0}
                        className="p-2 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={course.rounds_count > 0 ? 'Cannot delete - has rounds' : 'Delete course'}
                      >
                        {deletingId === course.id ? (
                          <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Legend for delete restriction */}
          {isAdmin && (
            <div
              className="px-6 py-3 text-xs text-white/40"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.05)', borderTop: '1px solid rgba(201, 162, 39, 0.1)' }}
            >
              Courses with rounds cannot be deleted. Edit them instead.
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeEditModal}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: PGC_DARK_GREEN,
              border: `2px solid ${PGC_GOLD}`,
              boxShadow: '0 0 60px rgba(201, 162, 39, 0.2)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: PGC_GOLD }}>
                  Edit Course
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  Update course details
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Error Message */}
            {editError && (
              <div
                className="mb-4 p-3 rounded-lg"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}
              >
                <span className="text-red-200 text-sm">{editError}</span>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {/* Course Name */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Course Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2"
                  style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                  placeholder="Enter course name"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2"
                  style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                  placeholder="City, Country"
                />
              </div>

              {/* Course Type & Tee Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Course Type
                  </label>
                  <select
                    value={editForm.course_type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, course_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                  >
                    {COURSE_TYPES.map(type => (
                      <option key={type} value={type} style={{ backgroundColor: PGC_DARK_GREEN }}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Tee Color
                  </label>
                  <select
                    value={editForm.tee_color}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tee_color: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                  >
                    {TEE_COLORS.map(color => (
                      <option key={color} value={color} style={{ backgroundColor: PGC_DARK_GREEN }}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Par, Rating, Slope */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Par
                  </label>
                  <input
                    type="number"
                    value={editForm.par}
                    onChange={(e) => setEditForm(prev => ({ ...prev, par: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-white/30 text-center focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                    placeholder="72"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Rating
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.rating}
                    onChange={(e) => setEditForm(prev => ({ ...prev, rating: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-white/30 text-center focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                    placeholder="72.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Slope
                  </label>
                  <input
                    type="number"
                    value={editForm.slope}
                    onChange={(e) => setEditForm(prev => ({ ...prev, slope: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/10 text-white placeholder-white/30 text-center focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${PGC_GOLD}50`, '--tw-ring-color': PGC_GOLD } as React.CSSProperties}
                    placeholder="130"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-6" style={{ borderTop: `1px solid ${PGC_GOLD}30` }}>
              <button
                onClick={closeEditModal}
                disabled={savingEdit}
                className="flex-1 py-3 px-4 rounded-lg font-medium text-center transition-colors hover:bg-white/10 disabled:opacity-50"
                style={{ border: `2px solid ${PGC_GOLD}`, color: PGC_GOLD }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
