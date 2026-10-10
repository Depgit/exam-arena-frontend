import { api } from './client'

// ── Read cache ─────────────────────────────────────────────────────────
// React keeps a page's data only while that page is mounted, so without
// this every navigation re-downloads everything. Reads are cached in memory
// for a short TTL: revisiting a page is instant, a full browser refresh
// starts clean. Identical concurrent requests share one network call.
//
// Deliberately NOT cached (always live): the leaderboard, queue counts,
// an in-progress match or practice session, and the auth check.
//
// Staleness is handled by invalidation, not by guessing a short TTL:
//   - our own writes invalidate what they change (below, per endpoint)
//   - server push events invalidate before any page sees them
//     (invalidateForEvent, called from WebSocketContext)
//   - login/logout clear everything (AuthContext)
const SEC = 1000
const cache = new Map() // key → { at, ttl, promise }

const keyOf = (url, params) => (params ? `${url}?${new URLSearchParams(params)}` : url)

// ── Last-known data (stale-while-revalidate) ───────────────────────────
// Every read's last successful response is also kept on the device, so a
// page can draw immediately from the previous visit — even after a full
// reload — and swap in fresh data when it arrives. With the backend far
// away (each request ~0.5–1.5s on free hosting), this is what makes the app
// feel instant. Cleared on login/logout so accounts never see each other's.
const STORE_KEY = 'exam-arena:last-known:v1'
let lastKnown = {}
try {
  lastKnown = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}
} catch {
  lastKnown = {}
}
let saveTimer = null
function remember(key, res) {
  lastKnown[key] = { data: res.data, meta: res.meta ?? null }
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(lastKnown))
    } catch {
      // Storage full or blocked: in-memory last-known still works this session.
    }
  }, 300)
}

/** Last successful response for a read, or undefined. Never hits the network. */
const peekKey = (key) => lastKnown[key]

function rememberedGet(url, params) {
  const key = keyOf(url, params)
  return api.get(url, params ? { params } : undefined).then((res) => {
    remember(key, res)
    return res
  })
}

// fresh: skip any cached copy and refetch (the result is still cached for
// the next normal caller). Used by screens that poll on purpose.
function cachedGet(url, { params, ttl, fresh = false }) {
  const key = keyOf(url, params)
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < hit.ttl) return hit.promise
  const promise = rememberedGet(url, params).catch((err) => {
    // Never cache a failure — the next caller should retry.
    if (cache.get(key)?.promise === promise) cache.delete(key)
    throw err
  })
  cache.set(key, { at: Date.now(), ttl, promise })
  return promise
}

/** Gives a read function a .peek(...sameArgs) for its last-known data. */
function withPeek(fn, keyFor) {
  fn.peek = (...args) => peekKey(keyFor(...args))
  return fn
}

/** Drops every cached read whose URL starts with one of the prefixes. */
export function invalidate(...prefixes) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key)
  }
}

export function clearCache() {
  cache.clear()
  lastKnown = {}
  clearTimeout(saveTimer)
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // ignore
  }
}

const USERS = '/api/v1/users/'
const FRIENDS = '/api/v1/friends'
const DAILY = '/api/v1/daily-challenge'
const TOPICS = '/api/v1/topics'
const ADMIN_STATS = '/api/v1/admin/stats'
const ADMIN_FLAGS = '/api/v1/admin/flags'

// Server push → which cached reads it makes stale.
const EVENT_INVALIDATES = {
  friend_request: [FRIENDS],
  friend_request_accepted: [FRIENDS],
  friend_challenge: [FRIENDS],
  friend_challenge_cancelled: [FRIENDS],
  friend_challenge_declined: [FRIENDS],
  match_end: [USERS],
}

export function invalidateForEvent(type) {
  const prefixes = EVENT_INVALIDATES[type]
  if (prefixes) invalidate(...prefixes)
}

/** Runs a write, then invalidates the reads it changed (only on success). */
const writes = (prefixes, request) =>
  request.then((res) => {
    invalidate(...prefixes)
    return res
  })

// ---- Auth ----
export const registerUser = (body) => api.post('/api/v1/auth/register', body)
export const loginUser = (body) => api.post('/api/v1/auth/login', body)
// One-click demo: the server creates a fresh guest account for this visitor.
export const loginGuest = () => api.post('/api/v1/auth/guest')
export const getMe = () => api.get('/api/v1/auth/me')
// Change your own details (display name; the username is permanent).
export const updateMe = (body) => api.patch('/api/v1/users/me', body)
// Sign in with Google's ID token; a new player gets { needs_username } and
// sends it again with { username }.
export const loginGoogle = (body) => api.post('/api/v1/auth/google', body)
// Email verification: send (or resend, optionally to a corrected address) and check the code.
export const sendVerificationCode = (email) => api.post('/api/v1/auth/verify-email/send', email ? { email } : {})
export const verifyEmailCode = (code) => api.post('/api/v1/auth/verify-email', { code })

// ---- Users ----
export const getUserProfile = withPeek((id) => cachedGet(`${USERS}${id}`, { ttl: 60 * SEC }), (id) => `${USERS}${id}`)
export const getUserStats = withPeek((id) => cachedGet(`${USERS}${id}/stats`, { ttl: 60 * SEC }), (id) => `${USERS}${id}/stats`)
// Player search for "add a friend" suggestions (always live, never cached).
export const searchPlayers = (q) => api.get('/api/v1/users/search', { params: { q } })
export const getUserMatchHistory = (id) => cachedGet(`${USERS}${id}/matches`, { ttl: 60 * SEC })

// ---- Friends ----
// Short TTL: online status changes without a push event.
export const getFriends = withPeek(() => cachedGet(FRIENDS, { ttl: 15 * SEC }), () => FRIENDS)
export const sendFriendRequest = (username) => writes([FRIENDS], api.post('/api/v1/friends/requests', { username }))
export const acceptFriendRequest = (id) => writes([FRIENDS], api.post(`/api/v1/friends/requests/${id}/accept`))
export const declineFriendRequest = (id) => writes([FRIENDS], api.post(`/api/v1/friends/requests/${id}/decline`))
export const removeFriend = (userId) => writes([FRIENDS], api.delete(`/api/v1/friends/${userId}`))
export const challengeFriend = (userId, body) => api.post(`/api/v1/friends/${userId}/challenge`, body)
// Declines (invited friend) or cancels (challenger) an open challenge.
export const closeChallenge = (matchId) => api.delete(`/api/v1/friends/challenges/${matchId}`)

// ---- Global chat ----
// Recent messages (always live); new ones arrive as "chat_message" events.
export const getChat = () => api.get('/api/v1/chat')
export const sendChat = (body) => api.post('/api/v1/chat', { body })

// ---- Subjects ----
// Categories almost never change; keep them for the whole session.
export const getSubjects = withPeek(() => cachedGet('/api/v1/subjects', { ttl: Infinity }), () => '/api/v1/subjects')

// ---- Topics ----
// Pass a category id to get only that category's topics (the usual case).
export const getTopics = (categoryId) =>
  cachedGet(TOPICS, { params: categoryId ? { exam_category_id: categoryId } : undefined, ttl: 5 * 60 * SEC })
export const getTopic = (id) => cachedGet(`${TOPICS}/${id}`, { ttl: 5 * 60 * SEC })

// ---- Matchmaking ----
export const joinQueue = (body) => api.post('/api/v1/matches/queue', body)
export const leaveQueue = () => api.delete('/api/v1/matches/queue')
export const getQueueStats = () => api.get('/api/v1/matches/queue/stats')

// ---- Matches ----
export const getMatch = (id) => api.get(`/api/v1/matches/${id}`)
// { match_id } of the match this player is in right now, or { match_id: null }.
export const getCurrentMatch = () => api.get('/api/v1/matches/current')
// Give up a live match: the opponent wins (and it counts as a loss when rated).
export const leaveMatch = (id) => api.post(`/api/v1/matches/${id}/leave`)
export const createFriendMatch = (body) => api.post('/api/v1/matches/friend', body)
// Unrated match against a bot; the match arrives as a match_start event.
export const playBot = (body) => api.post('/api/v1/matches/bot', body)
export const joinFriendMatch = (body) => api.post('/api/v1/matches/friend/join', body)

// ---- Daily challenge ----
export const getDailyChallenge = withPeek(() => cachedGet(DAILY, { ttl: 30 * SEC }), () => DAILY)
export const startDailyChallenge = () => writes([DAILY], api.post(`${DAILY}/start`))
export const submitDailyChallenge = (answers) =>
  writes([DAILY, USERS], api.post(`${DAILY}/submit`, { answers }))

// ---- Question flags ----
export const flagQuestion = (questionId, body) =>
  writes([ADMIN_FLAGS, ADMIN_STATS], api.post(`/api/v1/questions/${questionId}/flag`, body))

// ---- Practice ----
export const startPractice = (body) => api.post('/api/v1/practice/start', body)
export const submitPracticeAnswer = (id, body) => api.post(`/api/v1/practice/${id}/answer`, body)
export const endPractice = (id) => writes([USERS], api.post(`/api/v1/practice/${id}/end`))
export const getPractice = (id) => api.get(`/api/v1/practice/${id}`)

// ---- Leaderboard ----
// Always fetched live — rankings should never be served from cache. The
// last result is remembered only so the page can show it while loading.
export const getLeaderboard = withPeek(
  (categoryCode, params) => rememberedGet(`/api/v1/leaderboard/${categoryCode}`, params),
  (categoryCode, params) => keyOf(`/api/v1/leaderboard/${categoryCode}`, params)
)

// ---- Admin ----
export const createTopic = (body) => writes([TOPICS], api.post('/api/v1/admin/topics', body))
export const createQuestion = (body) => writes([ADMIN_STATS], api.post('/api/v1/admin/questions', body))
export const publishQuestion = (id) => writes([ADMIN_STATS], api.put(`/api/v1/admin/questions/${id}/publish`))
// Navigation reuses this for 15s; AdminDashboard's 15s poll passes
// { fresh: true } so a tick landing just before expiry can't show old numbers.
export const getAdminStats = ({ fresh = false } = {}) => cachedGet(ADMIN_STATS, { ttl: 15 * SEC, fresh })
export const getFlaggedQuestions = (status = 'open') => cachedGet(ADMIN_FLAGS, { params: { status }, ttl: 30 * SEC })
export const reviewQuestionFlags = (questionId, body) =>
  writes([ADMIN_FLAGS, ADMIN_STATS], api.put(`/api/v1/admin/flags/${questionId}`, body))
export const setCategorySortOrder = (id, sortOrder) =>
  api
    .put(`/api/v1/admin/categories/${id}/sort-order`, { sort_order: sortOrder })
    .then((res) => {
      invalidate('/api/v1/subjects')
      return res
    })
