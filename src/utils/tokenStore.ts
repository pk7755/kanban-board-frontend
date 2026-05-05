/**
 * tokenStore.ts
 * In-memory JWT storage. The token is never written to localStorage —
 * only the refresh token is persisted. This limits XSS exposure.
 *
 * AuthContext calls set() on login/logout.
 * apiClient calls get() to attach the Authorization header.
 */

let _token: string | null = null

export const tokenStore = {
  get: (): string | null => _token,
  set: (token: string | null): void => {
    _token = token
  },
}
