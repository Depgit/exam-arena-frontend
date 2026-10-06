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

// fresh: skip any cached copy and refetch (the result is still cached for
// the next normal caller). Used by screens that poll on purpose.
function cachedGet(url, { params, ttl, fresh = false }) {
  const key = params ? `${url}?${new URLSearchParams(params)}` : url
  const hit = cache.get(key)
  if (!fresh && hit && Date.now() - hit.at < hit.ttl) return hit.promise
  const promise = api.get(url, params ? { params } : undefined).catch((err) => {
    // Never cache a failure — the next caller should retry.
    if (cache.get(key)?.promise === promise) cache.delete(key)
    throw err
  })
  cache.set(key, { at: Date.now(), ttl, promise })
  return promise
}

/** Drops every cached read whose URL starts with one of the prefixes. */
export function invalidate(...prefixes) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key)
  }
}

export function clearCache() {
  cache.clear()
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
export const getMe = () => api.get('/api/v1/auth/me')

// ---- Users ----
export const getUserProfile = (id) => cachedGet(`${USERS}${id}`, { ttl: 60 * SEC })
export const getUserStats = (id) => cachedGet(`${USERS}${id}/stats`, { ttl: 60 * SEC })
export const getUserMatchHistory = (id) => cachedGet(`${USERS}${id}/matches`, { ttl: 60 * SEC })

// ---- Friends ----
// Short TTL: online status changes without a push event.
export const getFriends = () => cachedGet(FRIENDS, { ttl: 15 * SEC })
export const sendFriendRequest = (username) => writes([FRIENDS], api.post('/api/v1/friends/requests', { username }))
export const acceptFriendRequest = (id) => writes([FRIENDS], api.post(`/api/v1/friends/requests/${id}/accept`))
export const declineFriendRequest = (id) => writes([FRIENDS], api.post(`/api/v1/friends/requests/${id}/decline`))
export const removeFriend = (userId) => writes([FRIENDS], api.delete(`/api/v1/friends/${userId}`))
export const challengeFriend = (userId, body) => api.post(`/api/v1/friends/${userId}/challenge`, body)
// Declines (invited friend) or cancels (challenger) an open challenge.
export const closeChallenge = (matchId) => api.delete(`/api/v1/friends/challenges/${matchId}`)

// ---- Subjects ----
// Categories almost never change; keep them for the whole session.
export const getSubjects = () => cachedGet('/api/v1/subjects', { ttl: Infinity })

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
export const createFriendMatch = (body) => api.post('/api/v1/matches/friend', body)
export const joinFriendMatch = (body) => api.post('/api/v1/matches/friend/join', body)

// ---- Daily challenge ----
export const getDailyChallenge = () => cachedGet(DAILY, { ttl: 30 * SEC })
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
// Always live — rankings should never look stale.
export const getLeaderboard = (categoryCode, params) =>
  api.get(`/api/v1/leaderboard/${categoryCode}`, { params })

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
