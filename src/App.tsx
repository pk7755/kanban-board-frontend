import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { ToastStack } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { router } from './router'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
          {/* ToastStack lives outside RouterProvider so toasts survive navigation */}
          <ToastStack />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
