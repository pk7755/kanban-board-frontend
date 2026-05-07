/**
 * EmptyState.tsx
 * Centered empty state for blank board, column, and search results.
 */

import type { ReactNode } from 'react'
import '@/styles/components/EmptyState.css'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}
