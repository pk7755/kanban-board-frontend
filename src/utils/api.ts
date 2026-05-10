/**
 * api.ts
 * Single import point for all API calls.
 * Set VITE_USE_MOCK=true to use localStorage-backed mock.
 * Set VITE_USE_MOCK=false (or omit) to use the real backend.
 */

import * as real from './apiClient'
import * as mock from './mockApiClient'

const useMock = import.meta.env.VITE_USE_MOCK === 'true'

export const authApi = useMock ? mock.authApi : real.authApi
export const boardsApi = useMock ? mock.boardsApi : real.boardsApi
export const boardMembersApi = real.boardMembersApi
export const columnsApi = useMock ? mock.columnsApi : real.columnsApi
export const tasksApi = useMock ? mock.tasksApi : real.tasksApi
export const tagsApi = useMock ? mock.tagsApi : real.tagsApi
export const usersApi = useMock ? mock.usersApi : real.usersApi

export { configureApiClient } from './apiClient'
