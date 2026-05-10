import { useState, useCallback, useRef } from 'react'
import { Camera } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usersApi } from '@/utils/api'
import { useToast } from '@/context/ToastContext'
import '@/styles/pages/ProfilePage.css'
import '@/styles/pages/ProfilePage.form.css'

/* ─── Password strength ───────────────────────────────────────────── */

const PW_LABELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const

function scorePassword(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

/* ─── Avatar initials ─────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/* ─── Compress image to base64 (max 256×256, quality 0.8) ────────── */

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const SIZE = 256
      const canvas = document.createElement('canvas')
      const scale = Math.min(SIZE / img.width, SIZE / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Invalid image'))
    }
    img.src = url
  })
}

/* ─── Validation helpers ──────────────────────────────────────────── */

function validateProfile(name: string, email: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = 'Name is required'
  if (!email.trim()) errors.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address'
  return errors
}

function validatePassword(current: string, next: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!current) errors.currentPassword = 'Current password is required'
  if (!next) errors.newPassword = 'New password is required'
  else if (next.length < 8) errors.newPassword = 'Password must be at least 8 characters'
  if (next && confirm !== next) errors.confirmPassword = 'Passwords do not match'
  return errors
}

/* ─── Component ───────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { state: authState, updateProfile } = useAuth()
  const { showToast } = useToast()
  const user = authState.user!

  /* ── Avatar state ───────────────────────────────────────── */
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  /* ── Profile form state ─────────────────────────────────── */
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)

  /* ── Password form state ────────────────────────────────── */
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const pwScore = scorePassword(newPassword)

  /* ── Save profile ───────────────────────────────────────── */
  /* ── Avatar upload ──────────────────────────────────────── */
  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        showToast({ message: 'Please select an image file', variant: 'error' })
        return
      }
      setAvatarUploading(true)
      try {
        const compressed = await compressImage(file)
        setAvatarUrl(compressed)
        await usersApi.updateMe(user.id, {
          name: profileName.trim(),
          email: profileEmail.trim().toLowerCase(),
          avatarUrl: compressed,
        })
        updateProfile(profileName.trim(), profileEmail.trim().toLowerCase(), compressed)
        showToast({ message: 'Avatar updated', variant: 'success' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to upload avatar'
        showToast({ message: msg, variant: 'error' })
      } finally {
        setAvatarUploading(false)
        // reset so same file can be re-selected
        if (avatarInputRef.current) avatarInputRef.current.value = ''
      }
    },
    [user.id, profileName, profileEmail, updateProfile, showToast],
  )

  /* ── Save profile ───────────────────────────────────────── */
  const handleSaveProfile = useCallback(async () => {
    const errors = validateProfile(profileName, profileEmail)
    setProfileErrors(errors)
    if (Object.keys(errors).length > 0) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setProfileSaving(true)

    try {
      await usersApi.updateMe(
        user.id,
        { name: profileName.trim(), email: profileEmail.trim().toLowerCase(), avatarUrl },
        { signal: abortRef.current.signal },
      )
      updateProfile(profileName.trim(), profileEmail.trim().toLowerCase(), avatarUrl)
      showToast({ message: 'Profile updated successfully', variant: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile'
      showToast({ message: msg, variant: 'error' })
    } finally {
      setProfileSaving(false)
    }
  }, [profileName, profileEmail, avatarUrl, user.id, updateProfile, showToast])

  /* ── Change password ────────────────────────────────────── */
  const handleChangePassword = useCallback(async () => {
    const errors = validatePassword(currentPassword, newPassword, confirmPassword)
    setPasswordErrors(errors)
    if (Object.keys(errors).length > 0) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setPasswordSaving(true)

    try {
      await usersApi.updateMe(
        user.id,
        { currentPassword, password: newPassword },
        { signal: abortRef.current.signal },
      )
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordErrors({})
      showToast({ message: 'Password changed successfully', variant: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password'
      setPasswordErrors({ currentPassword: msg })
    } finally {
      setPasswordSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword, user.id, showToast])

  const roleLabel = user.role === 'MANAGER' ? 'Manager' : 'Team Member'
  const roleMod = user.role === 'MANAGER' ? 'manager' : 'member'

  return (
    <main className="profile-page" aria-label="User profile">
      <h1 className="profile-page__heading">My Profile</h1>

      {/* ── Account overview ──────────────────────────────── */}
      <section className="profile-card" aria-labelledby="profile-overview-title">
        <h2 id="profile-overview-title" className="profile-card__title">
          Account
        </h2>

        <div className="profile-avatar-row">
          {/* Hidden file input */}
          <input
            ref={avatarInputRef}
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="profile-avatar-input"
            aria-label="Upload profile picture"
            onChange={handleAvatarChange}
          />

          <label
            htmlFor="avatar-upload"
            className={`profile-avatar profile-avatar--clickable${avatarUploading ? ' profile-avatar--loading' : ''}`}
            title="Click to change profile picture"
            aria-label="Change profile picture"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${profileName || user.name}'s avatar`}
                className="profile-avatar__img"
              />
            ) : (
              <span className="profile-avatar__initials" aria-hidden="true">
                {initials(profileName || user.name)}
              </span>
            )}
            <span className="profile-avatar__overlay" aria-hidden="true">
              <Camera size={18} />
            </span>
          </label>

          <div className="profile-avatar-info">
            <span className="profile-avatar-name">{profileName || user.name}</span>
            <span className={`profile-role-badge profile-role-badge--${roleMod}`}>{roleLabel}</span>
          </div>
        </div>

        {/* ── Editable fields ─────────────────────────────── */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void handleSaveProfile()
          }}
        >
          <div className="profile-form__fields">
            <div className="profile-form__field">
              <label htmlFor="profile-name" className="profile-form__label">
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                className={`profile-form__input${profileErrors.name ? ' profile-form__input--error' : ''}`}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                aria-invalid={Boolean(profileErrors.name)}
                aria-describedby={profileErrors.name ? 'profile-name-error' : undefined}
                autoComplete="name"
              />
              {profileErrors.name && (
                <span id="profile-name-error" className="profile-form__error" role="alert">
                  {profileErrors.name}
                </span>
              )}
            </div>

            <div className="profile-form__field">
              <label htmlFor="profile-email" className="profile-form__label">
                Email address
              </label>
              <input
                id="profile-email"
                type="email"
                className={`profile-form__input${profileErrors.email ? ' profile-form__input--error' : ''}`}
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                aria-invalid={Boolean(profileErrors.email)}
                aria-describedby={profileErrors.email ? 'profile-email-error' : undefined}
                autoComplete="email"
              />
              {profileErrors.email && (
                <span id="profile-email-error" className="profile-form__error" role="alert">
                  {profileErrors.email}
                </span>
              )}
            </div>

            <div className="profile-form__field">
              <label htmlFor="profile-role" className="profile-form__label">
                Role
              </label>
              <input
                id="profile-role"
                type="text"
                className="profile-form__input"
                value={roleLabel}
                disabled
                aria-readonly="true"
              />
              <span className="profile-form__hint">Role is assigned by your manager</span>
            </div>
          </div>

          <div className="profile-card__footer">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={profileSaving}
              aria-busy={profileSaving}
            >
              {profileSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Change password ───────────────────────────────── */}
      <section className="profile-card" aria-labelledby="profile-pw-title">
        <h2 id="profile-pw-title" className="profile-card__title">
          Change password
        </h2>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void handleChangePassword()
          }}
        >
          <div className="profile-form__fields">
            <div className="profile-form__field profile-form__field--full">
              <label htmlFor="profile-current-pw" className="profile-form__label">
                Current password
              </label>
              <input
                id="profile-current-pw"
                type="password"
                className={`profile-form__input${passwordErrors.currentPassword ? ' profile-form__input--error' : ''}`}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={Boolean(passwordErrors.currentPassword)}
                aria-describedby={
                  passwordErrors.currentPassword ? 'profile-current-pw-error' : undefined
                }
              />
              {passwordErrors.currentPassword && (
                <span id="profile-current-pw-error" className="profile-form__error" role="alert">
                  {passwordErrors.currentPassword}
                </span>
              )}
            </div>

            <div className="profile-form__field">
              <label htmlFor="profile-new-pw" className="profile-form__label">
                New password
              </label>
              <input
                id="profile-new-pw"
                type="password"
                className={`profile-form__input${passwordErrors.newPassword ? ' profile-form__input--error' : ''}`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordErrors.newPassword)}
                aria-describedby="profile-new-pw-error profile-pw-strength"
              />
              {newPassword && (
                <div id="profile-pw-strength" className="pw-strength">
                  <div className="pw-strength__bar" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`pw-strength__segment${i < pwScore ? ` pw-strength__segment--filled-${pwScore}` : ''}`}
                      />
                    ))}
                  </div>
                  <span className="pw-strength__label">{PW_LABELS[pwScore]}</span>
                </div>
              )}
              {passwordErrors.newPassword && (
                <span id="profile-new-pw-error" className="profile-form__error" role="alert">
                  {passwordErrors.newPassword}
                </span>
              )}
            </div>

            <div className="profile-form__field">
              <label htmlFor="profile-confirm-pw" className="profile-form__label">
                Confirm new password
              </label>
              <input
                id="profile-confirm-pw"
                type="password"
                className={`profile-form__input${passwordErrors.confirmPassword ? ' profile-form__input--error' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                aria-describedby={
                  passwordErrors.confirmPassword ? 'profile-confirm-pw-error' : undefined
                }
              />
              {passwordErrors.confirmPassword && (
                <span id="profile-confirm-pw-error" className="profile-form__error" role="alert">
                  {passwordErrors.confirmPassword}
                </span>
              )}
            </div>
          </div>

          <div className="profile-card__footer">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={passwordSaving}
              aria-busy={passwordSaving}
            >
              {passwordSaving ? 'Updating…' : 'Change password'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
