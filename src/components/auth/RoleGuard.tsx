/**
 * RoleGuard.tsx
 * Renders NotAuthorizedPage if current user role is not in allowedRoles.
 * Spec: "do not rely on hiding the link alone — also block render"
 */

import { Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { NotAuthorizedPage } from '@/pages/NotAuthorizedPage'
import type { Role } from '@/types/entities'

interface RoleGuardProps {
  allowedRoles: Role[]
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { state } = useAuth()
  const role = state.user?.role

  if (!role || !allowedRoles.includes(role)) {
    return <NotAuthorizedPage />
  }

  return <Outlet />
}
