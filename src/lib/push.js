/**
 * Push notifications: friend challenges, streak and Mind Race Night
 * reminders, even when the app is closed (backend: internal/push; shown by
 * public/sw.js).
 *
 * Needs the service worker, so production builds only. On iPhone the
 * browser offers push only once MindRace is added to the home screen.
 */
import { getPushKey, subscribePush, unsubscribePush } from '../api/endpoints'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

/** iPhone in a Safari tab: push only works after "Add to Home Screen". */
export const needsHomeScreen = () => isIOS() && !isStandalone() && !pushSupported()

async function registration() {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration()) || null
}

// The server key arrives base64url-encoded; subscribe() wants bytes.
function keyBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

let keyPromise = null
function serverKey() {
  keyPromise ||= getPushKey()
    .then(({ data }) => (data?.enabled && data.public_key ? data.public_key : null))
    .catch(() => {
      keyPromise = null
      return null
    })
  return keyPromise
}

/**
 * 'unsupported' | 'unavailable' (server has no keys) | 'denied' | 'on' | 'off'
 */
export async function pushStatus() {
  const reg = await registration()
  if (!reg) return 'unsupported'
  if (!(await serverKey())) return 'unavailable'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

async function subscribeAndSave(reg, key) {
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  await subscribePush(sub.toJSON())
  return sub
}

/** Asks permission (must follow a tap) and turns notifications on. */
export async function enablePush() {
  const reg = await registration()
  const key = await serverKey()
  if (!reg || !key) throw new Error('Notifications are not available here')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications were blocked')
  await subscribeAndSave(reg, key)
}

export async function disablePush() {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await unsubscribePush(sub.endpoint).catch(() => {})
  await sub.unsubscribe()
}

/**
 * On each app start: if notifications are already allowed, make sure the
 * server has this device under the logged-in account (the browser may have
 * renewed the subscription, or another account used this device).
 */
export async function syncPush() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const [reg, key] = await Promise.all([registration(), serverKey()])
    if (reg && key) await subscribeAndSave(reg, key)
  } catch {
    // Best effort: the prompt offers to turn it on again if needed.
  }
}
