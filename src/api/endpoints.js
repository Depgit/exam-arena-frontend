import { api } from './client'

// ---- Auth ----
export const registerUser = (body) => api.post('/api/v1/auth/register', body)
export const loginUser = (body) => api.post('/api/v1/auth/login', body)
export const getMe = () => api.get('/api/v1/auth/me')

// ---- Users ----
export const getUserProfile = (id) => api.get(`/api/v1/users/${id}`)
export const getUserStats = (id) => api.get(`/api/v1/users/${id}/stats`)
export const getUserMatchHistory = (id) => api.get(`/api/v1/users/${id}/matches`)

// ---- Friends ----
export const getFriends = () => api.get('/api/v1/friends')
export const sendFriendRequest = (username) => api.post('/api/v1/friends/requests', { username })
export const acceptFriendRequest = (id) => api.post(`/api/v1/friends/requests/${id}/accept`)
export const declineFriendRequest = (id) => api.post(`/api/v1/friends/requests/${id}/decline`)
export const removeFriend = (userId) => api.delete(`/api/v1/friends/${userId}`)
export const challengeFriend = (userId, body) => api.post(`/api/v1/friends/${userId}/challenge`, body)
// Declines (invited friend) or cancels (challenger) an open challenge.
export const closeChallenge = (matchId) => api.delete(`/api/v1/friends/challenges/${matchId}`)

// ---- Subjects ----
export const getSubjects = () => api.get('/api/v1/subjects')

// ---- Topics ----
// Pass a category id to get only that category's topics (the usual case).
export const getTopics = (categoryId) =>
  api.get('/api/v1/topics', { params: categoryId ? { exam_category_id: categoryId } : undefined })
export const getTopic = (id) => api.get(`/api/v1/topics/${id}`)

// ---- Matchmaking ----
export const joinQueue = (body) => api.post('/api/v1/matches/queue', body)
export const leaveQueue = () => api.delete('/api/v1/matches/queue')
export const getQueueStats = () => api.get('/api/v1/matches/queue/stats')

// ---- Matches ----
export const getMatch = (id) => api.get(`/api/v1/matches/${id}`)
export const createFriendMatch = (body) => api.post('/api/v1/matches/friend', body)
export const joinFriendMatch = (body) => api.post('/api/v1/matches/friend/join', body)

// ---- Daily challenge ----
export const getDailyChallenge = () => api.get('/api/v1/daily-challenge')
export const startDailyChallenge = () => api.post('/api/v1/daily-challenge/start')
export const submitDailyChallenge = (answers) => api.post('/api/v1/daily-challenge/submit', { answers })

// ---- Question flags ----
export const flagQuestion = (questionId, body) => api.post(`/api/v1/questions/${questionId}/flag`, body)

// ---- Practice ----
export const startPractice = (body) => api.post('/api/v1/practice/start', body)
export const submitPracticeAnswer = (id, body) => api.post(`/api/v1/practice/${id}/answer`, body)
export const endPractice = (id) => api.post(`/api/v1/practice/${id}/end`)
export const getPractice = (id) => api.get(`/api/v1/practice/${id}`)

// ---- Leaderboard ----
export const getLeaderboard = (categoryCode, params) =>
  api.get(`/api/v1/leaderboard/${categoryCode}`, { params })

// ---- Admin ----
export const createTopic = (body) => api.post('/api/v1/admin/topics', body)
export const createQuestion = (body) => api.post('/api/v1/admin/questions', body)
export const publishQuestion = (id) => api.put(`/api/v1/admin/questions/${id}/publish`)
export const getAdminStats = () => api.get('/api/v1/admin/stats')
export const getFlaggedQuestions = (status = 'open') => api.get('/api/v1/admin/flags', { params: { status } })
export const reviewQuestionFlags = (questionId, body) => api.put(`/api/v1/admin/flags/${questionId}`, body)
export const setCategorySortOrder = (id, sortOrder) =>
  api.put(`/api/v1/admin/categories/${id}/sort-order`, { sort_order: sortOrder })
