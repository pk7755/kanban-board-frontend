/**
 * auth.ts
 * Auth state shapes and related types.
 */

import type { AuthUser, Role } from './entities'

export interface AuthState {
  user: AuthUser | null
  /** JWT stored in memory (not localStorage) for XSS protection */
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  role: Role
}

export interface PasswordResetResult {
  temporaryPassword: string
}
