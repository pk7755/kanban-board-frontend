/**
 * router.tsx
 * App routes.
 *
 * /login         — public
 * /              — redirect to /boards
 * /boards/:id    — protected
 * /users         — protected + MANAGER only
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { LoginPage } from '@/pages/LoginPage'
import { BoardPage } from '@/pages/BoardPage'
import { UsersPage } from '@/pages/UsersPage'
import { AppLayoutWrapper } from '@/components/layout/AppLayoutWrapper'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayoutWrapper />,
        children: [
          {
            path: '/',
            element: <Navigate to="/boards" replace />,
          },
          {
            path: '/boards',
            element: <BoardPage />,
          },
          {
            path: '/boards/:boardId',
            element: <BoardPage />,
          },
          {
            element: <RoleGuard allowedRoles={['MANAGER']} />,
            children: [
              {
                path: '/users',
                element: <UsersPage />,
              },
            ],
          },
        ],
      },
    ],
  },
])
