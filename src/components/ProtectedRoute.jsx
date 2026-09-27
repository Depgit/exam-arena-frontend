import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// requireRole: 'admin' | 'user' | undefined (any authenticated role)
export default function ProtectedRoute({ requireRole }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading) return <div className="page-center">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (requireRole === 'admin' && !isAdmin) return <Navigate to="/app/dashboard" replace />
  if (requireRole === 'user' && isAdmin) return <Navigate to="/admin/dashboard" replace />

  return <Outlet />
}
