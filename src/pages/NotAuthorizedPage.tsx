/**
 * NotAuthorizedPage.tsx
 * Shown when a team member tries to access a manager-only route.
 * Spec: "typing /users in URL shows 'Not authorized'"
 */

export function NotAuthorizedPage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--space-4)',
        color: 'var(--text-secondary)',
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>Not Authorized</h1>
      <p style={{ fontSize: 'var(--text-base)' }}>You do not have permission to view this page.</p>
    </main>
  )
}
