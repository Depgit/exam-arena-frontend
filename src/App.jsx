import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import Dashboard from './pages/user/Dashboard'
import Matchmaking from './pages/user/Matchmaking'
import FriendMatch from './pages/user/FriendMatch'
import LiveMatch from './pages/user/LiveMatch'
import Practice from './pages/user/Practice'
import Leaderboard from './pages/user/Leaderboard'
import Profile from './pages/user/Profile'
import Friends from './pages/user/Friends'
import DailyChallenge from './pages/user/DailyChallenge'

import AdminDashboard from './pages/admin/AdminDashboard'
import CreateQuestion from './pages/admin/CreateQuestion'
import AdminStats from './pages/admin/AdminStats'
import AdminFlags from './pages/admin/AdminFlags'

function RootRedirect() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <div className="page-center">Loading…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/app/dashboard'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute requireRole="user" />}>
              <Route element={<Layout />}>
                <Route path="/app/dashboard" element={<Dashboard />} />
                <Route path="/app/matchmaking" element={<Matchmaking />} />
                <Route path="/app/friend" element={<FriendMatch />} />
                <Route path="/app/match/:matchId" element={<LiveMatch />} />
                <Route path="/app/practice" element={<Practice />} />
                <Route path="/app/leaderboard" element={<Leaderboard />} />
                <Route path="/app/profile" element={<Profile />} />
                <Route path="/app/friends" element={<Friends />} />
                <Route path="/app/daily" element={<DailyChallenge />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute requireRole="admin" />}>
              <Route element={<Layout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/questions/new" element={<CreateQuestion />} />
                <Route path="/admin/stats" element={<AdminStats />} />
                <Route path="/admin/flags" element={<AdminFlags />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
