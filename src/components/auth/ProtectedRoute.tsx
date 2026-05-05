/**
 * ProtectedRoute.tsx
 * Redirects unauthenticated users to /login.
 * While auth is loading (silent refresh attempt), renders nothing.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { state } = useAuth()

  if (state.isLoading) return null

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
