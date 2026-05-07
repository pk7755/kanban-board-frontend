/**
 * Badge.tsx
 * Compact label badge for priorities, tags, and status markers.
 */

import '@/styles/components/Badge.css'

interface BadgeProps {
  label: string
  color?: string
  variant?: 'priority' | 'tag' | 'status'
}

export function Badge({ label, color, variant = 'status' }: BadgeProps) {
  const priorityClass =
    variant === 'priority' ? `badge--priority-${label.trim().toLowerCase()}` : ''

  const style =
    variant === 'tag' && color
      ? {
          backgroundColor: `${color}20`,
          color,
        }
      : undefined

  return (
    <span className={['badge', `badge--${variant}`, priorityClass].filter(Boolean).join(' ')} style={style}>
      {label}
    </span>
  )
}
