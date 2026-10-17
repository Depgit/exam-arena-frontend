import { lazy, Suspense } from 'react'
import { ConfirmProvider } from './context/ConfirmContext'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { SettingsProvider } from './context/SettingsContext'
import { ChatProvider } from './context/ChatContext'
import { StreakProvider } from './context/StreakContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ServerWakeNotice from './components/ServerWakeNotice'
import PlayOnly from './components/PlayOnly'
import NotInMatch from './components/NotInMatch'

// Every page is its own chunk: a player never downloads the admin console,
// and the first screen paints without waiting on pages nobody opened yet.
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const Challenge = lazy(() => import('./pages/Challenge'))
const Privacy = lazy(() => import('./pages/Privacy'))
const About = lazy(() => import('./pages/About'))
const Result = lazy(() => import('./pages/Result'))
const Invite = lazy(() => import('./pages/Invite'))
const GroupInvite = lazy(() => import('./pages/GroupInvite'))
const InvitePage = lazy(() => import('./pages/user/InvitePage'))

// A new match id must get a fresh match screen. React Router keeps the same
// component when only :matchId changes — e.g. a rematch starting while the
// player is still on the last match's results — and the old results would
// stay on screen instead of the new match.
function LiveMatchPage() {
  const { matchId } = useParams()
  return <LiveMatch key={matchId} />
}

const Dashboard = lazy(() => import('./pages/user/Dashboard'))
const Matchmaking = lazy(() => import('./pages/user/Matchmaking'))
const FriendMatch = lazy(() => import('./pages/user/FriendMatch'))
const GroupRace = lazy(() => import('./pages/user/GroupRace'))
const LiveMatch = lazy(() => import('./pages/user/LiveMatch'))
const Practice = lazy(() => import('./pages/user/Practice'))
const Leaderboard = lazy(() => import('./pages/user/Leaderboard'))
const Profile = lazy(() => import('./pages/user/Profile'))
const Friends = lazy(() => import('./pages/user/Friends'))
const DailyChallenge = lazy(() => import('./pages/user/DailyChallenge'))
const Verify = lazy(() => import('./pages/user/Verify'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const CreateQuestion = lazy(() => import('./pages/admin/CreateQuestion'))
const AdminStats = lazy(() => import('./pages/admin/AdminStats'))
const AdminFlags = lazy(() => import('./pages/admin/AdminFlags'))
const AdminGrowth = lazy(() => import('./pages/admin/AdminGrowth'))
const AdminChat = lazy(() => import('./pages/admin/AdminChat'))
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'))
const Events = lazy(() => import('./pages/user/Events'))
const EventPage = lazy(() => import('./pages/user/EventPage'))

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
          <ChatProvider>
          <StreakProvider>
          <ConfirmProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/about" element={<About />} />
                <Route path="/c/:code" element={<Challenge />} />
                <Route path="/r/:matchId" element={<Result />} />
                <Route path="/i/:code" element={<Invite />} />
                <Route path="/g/:code" element={<GroupInvite />} />

                <Route element={<ProtectedRoute requireRole="user" />}>
                  <Route element={<Layout />}>
                    <Route path="/app/dashboard" element={<Dashboard />} />
                    <Route path="/app/matchmaking" element={<PlayOnly what="playing a match" demoTrial><NotInMatch><Matchmaking /></NotInMatch></PlayOnly>} />
                    <Route path="/app/friend" element={<PlayOnly what="playing a friend match"><NotInMatch><FriendMatch /></NotInMatch></PlayOnly>} />
                    <Route path="/app/group" element={<PlayOnly what="a Group Race"><NotInMatch><GroupRace /></NotInMatch></PlayOnly>} />
                    <Route path="/app/match/:matchId" element={<PlayOnly what="playing a match" demoTrial><LiveMatchPage /></PlayOnly>} />
                    <Route path="/app/practice" element={<PlayOnly what="practice"><Practice /></PlayOnly>} />
                    <Route path="/app/leaderboard" element={<Leaderboard />} />
                    <Route path="/app/about" element={<About />} />
                    <Route path="/app/events" element={<Events />} />
                    <Route path="/app/events/:eventId" element={<EventPage />} />
                    <Route path="/app/profile" element={<Profile />} />
                    <Route path="/app/profile/:userId" element={<Profile />} />
                    <Route path="/app/friends" element={<Friends />} />
                    <Route path="/app/verify" element={<Verify />} />
                    <Route path="/app/invite" element={<InvitePage />} />
                    <Route path="/app/daily" element={<PlayOnly what="the daily challenge"><DailyChallenge /></PlayOnly>} />
                  </Route>
                </Route>

                <Route element={<ProtectedRoute requireRole="admin" />}>
                  <Route element={<Layout />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/questions/new" element={<CreateQuestion />} />
                    <Route path="/admin/stats" element={<AdminStats />} />
                    <Route path="/admin/growth" element={<AdminGrowth />} />
                    <Route path="/admin/flags" element={<AdminFlags />} />
                    <Route path="/admin/chat" element={<AdminChat />} />
                    <Route path="/admin/events" element={<AdminEvents />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <ServerWakeNotice />
          </ConfirmProvider>
          </StreakProvider>
          </ChatProvider>
          </WebSocketProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
