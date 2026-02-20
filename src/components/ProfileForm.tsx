'use client'

import { useState } from 'react'
import { updateProfile, UpdateProfileData } from '@/app/actions/update-profile'

interface ProfileFormProps {
  initialData: UpdateProfileData
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialData.full_name)
  const [homeClub, setHomeClub] = useState(initialData.home_club)
  const [handicapIndex, setHandicapIndex] = useState(
    initialData.handicap_index !== null ? String(initialData.handicap_index) : ''
  )
  const [guiNumber, setGuiNumber] = useState(initialData.gui_number)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const result = await updateProfile({
      full_name: fullName,
      home_club: homeClub,
      handicap_index: handicapIndex ? parseFloat(handicapIndex) : null,
      gui_number: guiNumber,
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update profile' })
    }

    setSaving(false)
  }

  const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(201, 162, 39, 0.3)',
    color: 'white',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className="rounded-xl p-6 space-y-5"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(201, 162, 39, 0.2)',
        }}
      >
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#C9A227' }}>
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            style={inputStyle}
            placeholder="Your full name"
          />
        </div>

        {/* Home Club */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#C9A227' }}>
            Home Club
          </label>
          <input
            type="text"
            value={homeClub}
            onChange={(e) => setHomeClub(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            style={inputStyle}
            placeholder="Your home golf club"
          />
        </div>

        {/* Handicap Index */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#C9A227' }}>
            Handicap Index
          </label>
          <input
            type="number"
            step="0.1"
            value={handicapIndex}
            onChange={(e) => setHandicapIndex(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            style={inputStyle}
            placeholder="e.g. 12.4"
          />
        </div>

        {/* GUI Number */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#C9A227' }}>
            GUI Number
          </label>
          <input
            type="text"
            value={guiNumber}
            onChange={(e) => setGuiNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            style={inputStyle}
            placeholder="Your GUI number"
          />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: message.type === 'success'
              ? 'rgba(34, 197, 94, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
        style={{
          backgroundColor: '#C9A227',
          color: '#1B4D3E',
        }}
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  )
}
