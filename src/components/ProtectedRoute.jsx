import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// requireRole: 'admin' | 'user' | undefined (any authenticated role)
export default function ProtectedRoute({ requireRole }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <div className="page-center">Loading…</div>
  // Come back here after logging in (e.g. a shared profile link).
  if (!isAuthenticated) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />

  if (requireRole === 'admin' && !isAdmin) return <Navigate to="/app/dashboard" replace />
  if (requireRole === 'user' && isAdmin) return <Navigate to="/admin/dashboard" replace />

  return <Outlet />
}
