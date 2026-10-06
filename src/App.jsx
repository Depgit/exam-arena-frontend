import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { SettingsProvider } from './context/SettingsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Every page is its own chunk: a player never downloads the admin console,
// and the first screen paints without waiting on pages nobody opened yet.
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))

const Dashboard = lazy(() => import('./pages/user/Dashboard'))
const Matchmaking = lazy(() => import('./pages/user/Matchmaking'))
const FriendMatch = lazy(() => import('./pages/user/FriendMatch'))
const LiveMatch = lazy(() => import('./pages/user/LiveMatch'))
const Practice = lazy(() => import('./pages/user/Practice'))
const Leaderboard = lazy(() => import('./pages/user/Leaderboard'))
const Profile = lazy(() => import('./pages/user/Profile'))
const Friends = lazy(() => import('./pages/user/Friends'))
const DailyChallenge = lazy(() => import('./pages/user/DailyChallenge'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const CreateQuestion = lazy(() => import('./pages/admin/CreateQuestion'))
const AdminStats = lazy(() => import('./pages/admin/AdminStats'))
const AdminFlags = lazy(() => import('./pages/admin/AdminFlags'))

const PageLoader = () => (
  <div className="page-center">
    <div className="spinner" />
  </div>
)

function RootRedirect() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/app/dashboard'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <WebSocketProvider>
            <Suspense fallback={<PageLoader />}>
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
                    <Route path="/app/profile/:userId" element={<Profile />} />
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
            </Suspense>
          </WebSocketProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
