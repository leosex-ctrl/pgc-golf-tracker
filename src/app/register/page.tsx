'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface FormData {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  dateOfBirth: string
  homeClub: string
  handicapIndex: string
  guiNumber: string
  disclaimerAccepted: boolean
}

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
  dateOfBirth?: string
  homeClub?: string
  handicapIndex?: string
  guiNumber?: string
  disclaimerAccepted?: string
  general?: string
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    homeClub: '',
    handicapIndex: '',
    guiNumber: '',
    disclaimerAccepted: false,
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required'
    }

    if (!formData.homeClub.trim()) {
      newErrors.homeClub = 'Home club is required'
    }

    if (!formData.handicapIndex.trim()) {
      newErrors.handicapIndex = 'Handicap index is required'
    } else {
      const handicap = parseFloat(formData.handicapIndex)
      if (isNaN(handicap) || handicap < -10 || handicap > 54) {
        newErrors.handicapIndex = 'Please enter a valid handicap index (-10 to 54)'
      }
    }

    if (!formData.guiNumber.trim()) {
      newErrors.guiNumber = 'GUI membership number is required'
    }

    if (!formData.disclaimerAccepted) {
      newErrors.disclaimerAccepted = 'You must accept the data retention disclaimer to register'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})
    setStatusMessage('Starting registration...')

    try {
      const supabase = createClient()

      // Step 1: Sign up user with Supabase Auth
      setStatusMessage('Creating auth account...')
      console.log('Attempting auth.signUp with email:', formData.email)

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      })

      if (signUpError) {
        console.error('Auth signUp error:', signUpError)
        setStatusMessage(`Auth error: ${signUpError.message}`)
        throw signUpError
      }

      console.log('Auth signUp successful:', authData)
      console.log('User ID:', authData.user?.id)

      if (!authData.user) {
        const errorMsg = 'No user returned from signup'
        console.error(errorMsg)
        setStatusMessage(errorMsg)
        throw new Error(errorMsg)
      }

      // Step 2: Wait for auth record to be fully committed
      // This prevents foreign key violation (23503) race condition
      setStatusMessage('Finalizing account...')
      console.log('Waiting 2 seconds for auth record to commit...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 3: Insert profile data into profiles table
      setStatusMessage('Creating profile record...')

      const userId = authData.user.id
      console.log('Using auth user ID for profile:', userId)

      // Column names exactly match Supabase schema
      const profileData = {
        id: userId,
        full_name: formData.fullName,
        email_address: formData.email,
        date_of_birth: formData.dateOfBirth,
        home_club: formData.homeClub,
        handicap_index: parseFloat(formData.handicapIndex),
        gui_number: formData.guiNumber,
        disclaimer_accepted: true,
      }

      console.log('Inserting profile data:', JSON.stringify(profileData, null, 2))

      // Retry logic for profile insert
      const maxRetries = 3
      let profileResult = null
      let profileError = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Profile insert attempt ${attempt} of ${maxRetries}`)
        setStatusMessage(`Creating profile (attempt ${attempt})...`)

        const insertResult = await supabase
          .from('profiles')
          .insert(profileData)
          .select()

        profileResult = insertResult.data
        profileError = insertResult.error

        if (!profileError) {
          console.log('Profile insert successful on attempt', attempt)
          break
        }

        // Check if it's a foreign key or schema cache error worth retrying
        const isRetryableError =
          profileError.code === '23503' || // Foreign key violation
          profileError.code === 'PGRST204' || // Schema cache
          profileError.message?.includes('Could not find')

        if (isRetryableError && attempt < maxRetries) {
          console.log(`Retryable error (${profileError.code}), waiting 2s before retry...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          break
        }
      }

      if (profileError) {
        console.error('Profile insert error after all retries:', profileError)
        console.error('Profile error details:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        })
        setStatusMessage(`Profile error: ${profileError.message}`)
        throw profileError
      }

      console.log('Profile insert successful:', profileResult)
      setStatusMessage('Registration successful!')
      setSubmitSuccess(true)

    } catch (error) {
      console.error('Registration error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.'
      setErrors({
        general: errorMessage,
      })
      setStatusMessage(`Error: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f9fafb' }}>
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0D4D2B' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#0D4D2B' }}>Registration Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your registration has been submitted for approval. You will receive an email notification once your account has been reviewed.
          </p>
          <Link
            href="/"
            className="inline-block btn-primary"
            style={{ backgroundColor: '#0D4D2B' }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#f9fafb' }}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#0D4D2B' }}>
            PGC Performance Tracker
          </h1>
          <p className="text-gray-600">Create your account</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: '#0D4D2B' }}>
            Registration
          </h2>

          {/* Status Message */}
          {statusMessage && (
            <div className={`mb-6 p-4 rounded-lg ${
              statusMessage.includes('error') || statusMessage.includes('Error')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : statusMessage.includes('successful')
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
            }`}>
              <p className="text-sm font-medium">{statusMessage}</p>
            </div>
          )}

          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className={`input-field ${errors.fullName ? 'border-red-500' : ''}`}
                placeholder="Enter your full name"
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`input-field ${errors.password ? 'border-red-500' : ''}`}
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`input-field ${errors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className={`input-field ${errors.dateOfBirth ? 'border-red-500' : ''}`}
              />
              {errors.dateOfBirth && (
                <p className="mt-1 text-sm text-red-500">{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label htmlFor="homeClub" className="block text-sm font-medium text-gray-700 mb-1">
                Home Club <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="homeClub"
                name="homeClub"
                value={formData.homeClub}
                onChange={handleInputChange}
                className={`input-field ${errors.homeClub ? 'border-red-500' : ''}`}
                placeholder="Enter your home golf club"
              />
              {errors.homeClub && (
                <p className="mt-1 text-sm text-red-500">{errors.homeClub}</p>
              )}
            </div>

            <div>
              <label htmlFor="handicapIndex" className="block text-sm font-medium text-gray-700 mb-1">
                Handicap Index <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="handicapIndex"
                name="handicapIndex"
                value={formData.handicapIndex}
                onChange={handleInputChange}
                className={`input-field ${errors.handicapIndex ? 'border-red-500' : ''}`}
                placeholder="e.g., 12.4"
              />
              {errors.handicapIndex && (
                <p className="mt-1 text-sm text-red-500">{errors.handicapIndex}</p>
              )}
            </div>

            <div>
              <label htmlFor="guiNumber" className="block text-sm font-medium text-gray-700 mb-1">
                GUI Membership Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="guiNumber"
                name="guiNumber"
                value={formData.guiNumber}
                onChange={handleInputChange}
                className={`input-field ${errors.guiNumber ? 'border-red-500' : ''}`}
                placeholder="Enter your Golf Ireland membership number"
              />
              {errors.guiNumber && (
                <p className="mt-1 text-sm text-red-500">{errors.guiNumber}</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-3" style={{ color: '#0D4D2B' }}>
                Data Retention Disclaimer
              </h3>
              <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: '#f0f7f4', border: '1px solid #0D4D2B20' }}>
                <p className="text-sm text-gray-700 leading-relaxed">
                  By registering for this application, you consent to Portmarnock Golf Club retaining your data for the purpose of strategic analysis around inter-club competitions with a focus on the success of Portmarnock Golf Club. Your data will be used to analyse performance trends, support team selection, and improve competitive outcomes.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="disclaimerAccepted"
                  checked={formData.disclaimerAccepted}
                  onChange={handleInputChange}
                  className="checkbox-custom mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  I have read and accept the data retention disclaimer <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.disclaimerAccepted && (
                <p className="mt-2 text-sm text-red-500">{errors.disclaimerAccepted}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary mt-6"
              style={{ backgroundColor: '#0D4D2B' }}
            >
              {isSubmitting ? 'Submitting...' : 'Register'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium" style={{ color: '#0D4D2B' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
