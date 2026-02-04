'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Flag, PlusCircle, Trash2, Pencil, X, Check, MapPin } from 'lucide-react'
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
  rounds_count: number
}

// ============================================
// COMPONENT
// ============================================

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    par: string
    rating: string
    slope: string
    location: string
  }>({
    name: '',
    par: '',
    rating: '',
    slope: '',
    location: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

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

      // Fetch all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, par, rating, slope, location')
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

  const startEditing = (course: Course) => {
    setEditingId(course.id)
    setEditForm({
      name: course.name || '',
      par: course.par?.toString() || '',
      rating: course.rating?.toString() || '',
      slope: course.slope?.toString() || '',
      location: course.location || '',
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({ name: '', par: '', rating: '', slope: '', location: '' })
  }

  const saveEdit = async (courseId: string) => {
    if (!editForm.name.trim()) {
      alert('Course name is required')
      return
    }

    setSavingEdit(true)

    try {
      const result = await updateCourse(courseId, {
        name: editForm.name.trim(),
        par: editForm.par ? parseInt(editForm.par) : undefined,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
        slope: editForm.slope ? parseInt(editForm.slope) : null,
        location: editForm.location.trim() || null,
      })

      if (result.success) {
        // Update local state
        setCourses(prev => prev.map(c =>
          c.id === courseId
            ? {
                ...c,
                name: editForm.name.trim(),
                par: editForm.par ? parseInt(editForm.par) : null,
                rating: editForm.rating ? parseFloat(editForm.rating) : null,
                slope: editForm.slope ? parseInt(editForm.slope) : null,
                location: editForm.location.trim() || null,
              }
            : c
        ))
        setEditingId(null)
      } else {
        alert(result.error || 'Failed to update course')
      }
    } catch (err) {
      console.error('Update error:', err)
      alert('An unexpected error occurred while updating')
    } finally {
      setSavingEdit(false)
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
            style={{ borderTopColor: '#C9A227' }}
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
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
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
            <Flag className="w-8 h-8" style={{ color: '#C9A227' }} />
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
            <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
              All Courses
            </h2>
            <span className="text-sm text-white/40">{courses.length} courses</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Course Name
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Par
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Rating
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Slope
                  </th>
                  <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                    Rounds
                  </th>
                  {isAdmin && (
                    <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
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
                    {editingId === course.id ? (
                      // Edit mode row
                      <>
                        <td className="py-4 px-6">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-[#C9A227]"
                            placeholder="Course name"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            value={editForm.par}
                            onChange={(e) => setEditForm(prev => ({ ...prev, par: e.target.value }))}
                            className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                            placeholder="72"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.rating}
                            onChange={(e) => setEditForm(prev => ({ ...prev, rating: e.target.value }))}
                            className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                            placeholder="72.0"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <input
                            type="number"
                            value={editForm.slope}
                            onChange={(e) => setEditForm(prev => ({ ...prev, slope: e.target.value }))}
                            className="w-20 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                            placeholder="130"
                          />
                        </td>
                        <td className="py-4 px-6 text-center text-sm text-white/50">
                          {course.rounds_count}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => saveEdit(course.id)}
                              disabled={savingEdit}
                              className="p-2 rounded-lg transition-colors hover:bg-green-500/20 disabled:opacity-50"
                              title="Save changes"
                            >
                              {savingEdit ? (
                                <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                              ) : (
                                <Check className="w-4 h-4 text-green-400" />
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={savingEdit}
                              className="p-2 rounded-lg transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View mode row
                      <>
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
                        <td className="py-4 px-6 text-center text-sm text-white/70">
                          {course.par || '—'}
                        </td>
                        <td className="py-4 px-6 text-center text-sm text-white/70">
                          {course.rating?.toFixed(1) || '—'}
                        </td>
                        <td className="py-4 px-6 text-center text-sm text-white/70">
                          {course.slope || '—'}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: course.rounds_count > 0
                                ? 'rgba(201, 162, 39, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                              color: course.rounds_count > 0 ? '#C9A227' : 'rgba(255, 255, 255, 0.5)',
                            }}
                          >
                            {course.rounds_count}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => startEditing(course)}
                                className="p-2 rounded-lg transition-colors hover:bg-white/10"
                                title="Edit course"
                              >
                                <Pencil className="w-4 h-4" style={{ color: '#C9A227' }} />
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
                      </>
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
                {editingId === course.id ? (
                  // Edit mode card
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-[#C9A227]"
                      placeholder="Course name"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={editForm.par}
                        onChange={(e) => setEditForm(prev => ({ ...prev, par: e.target.value }))}
                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                        placeholder="Par"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={editForm.rating}
                        onChange={(e) => setEditForm(prev => ({ ...prev, rating: e.target.value }))}
                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                        placeholder="Rating"
                      />
                      <input
                        type="number"
                        value={editForm.slope}
                        onChange={(e) => setEditForm(prev => ({ ...prev, slope: e.target.value }))}
                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-center focus:outline-none focus:border-[#C9A227]"
                        placeholder="Slope"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        disabled={savingEdit}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(course.id)}
                        disabled={savingEdit}
                        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        style={{ backgroundColor: '#C9A227', color: '#0D4D2B' }}
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode card
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">{course.name}</p>
                      {course.location && (
                        <p className="text-xs text-white/50 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {course.location}
                        </p>
                      )}
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
                          onClick={() => startEditing(course)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="Edit course"
                        >
                          <Pencil className="w-4 h-4" style={{ color: '#C9A227' }} />
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
                )}
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
    </div>
  )
}
