// Mind Race Night helpers: countdown text and "add to calendar" links that
// repeat every day.

const pad = (n) => String(n).padStart(2, '0')

// "2h 14m", "14m 05s", "45s"
export function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(sec)}s`
  return `${sec}s`
}

// 8 → "8 PM", 20 → "8 PM", 9 → "9 AM"
export function hourLabel(h) {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr} ${suffix}`
}

const utcStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

const TITLE = 'Mind Race Night ⚡'
const DETAILS = 'Everyone plays at once — 1v1 math & logic battles against real people. Join at https://mindrace.in'

// Google Calendar "new event" link, repeating daily from the next night.
export function googleCalendarLink(startIso, minutes) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + minutes * 60_000)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    details: DETAILS,
    location: 'https://mindrace.in',
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
    recur: 'RRULE:FREQ=DAILY',
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

// .ics file (Apple Calendar, Outlook…) with a daily repeat and a
// 10-minute reminder.
export function downloadIcs(startIso, minutes) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + minutes * 60_000)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mind Race//Night//EN',
    'BEGIN:VEVENT',
    `UID:mindrace-night@mindrace.in`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAILS}`,
    'URL:https://mindrace.in',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE} starts in 10 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'mind-race-night.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
