import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const api = axios.create({
  baseURL: BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('exam_arena_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Every backend response is wrapped in { success, data, error, meta }.
// This interceptor unwraps `data` on success and normalizes errors so
// callers can just `await api.get(...)` and use the result directly,
// or catch `err.message` for a human-readable error string.
api.interceptors.response.use(
  (response) => {
    const envelope = response.data
    return { data: envelope.data, meta: envelope.meta ?? null }
  },
  (error) => {
    const envelope = error.response?.data
    const message = envelope?.error || error.message || 'Something went wrong'
    return Promise.reject({ message, status: error.response?.status })
  }
)

export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080'
