/**
 * usePermissions.ts
 * Single place for all role-based permission checks.
 * Every UI gate in the app goes through this hook — no scattered
 * `if (user.role === 'MANAGER')` in components.
 *
 * Usage:
 *   const { canEditTask, canManageUsers, canReassign } = usePermissions()
 */

import { useAuth } from '@/context/AuthContext'
import type { Task } from '@/types/entities'

interface Permissions {
  /** Current user can edit the given task (manager or own task) */
  canEditTask: (task: Task) => boolean
  /** Current user can drag the given task (same as canEditTask) */
  canDragTask: (task: Task) => boolean
  /** Current user can delete the given task */
  canDeleteTask: (task: Task) => boolean
  /** Current user can reassign any task */
  canReassign: (task: Task) => boolean
  /** Current user can manage users (MANAGER only) */
  canManageUsers: boolean
  /** Current user can create tasks for any assignee (MANAGER only) */
  canAssignToAnyone: boolean
  /** True when the current user is a MANAGER */
  isManager: boolean
}

export function usePermissions(): Permissions {
  const { state } = useAuth()
  const user = state.user

  const isManager = user?.role === 'MANAGER'

  const canEditTask = (task: Task): boolean => {
    if (!user) return false
    if (isManager) return true
    return task.assigneeId === user.id
  }

  const canDragTask = canEditTask

  const canDeleteTask = (task: Task): boolean => {
    if (!user) return false
    if (isManager) return true
    return task.assigneeId === user.id
  }

  const canReassign = (_task: Task): boolean => isManager

  return {
    canEditTask,
    canDragTask,
    canDeleteTask,
    canReassign,
    canManageUsers: isManager,
    canAssignToAnyone: isManager,
    isManager,
  }
}
