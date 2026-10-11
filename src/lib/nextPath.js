// Where to go after logging in or signing up, from ?next=/c/AB12CD.
// Only same-site paths are accepted, so a link can't bounce people
// to another website after login.
export function nextPath(search, fallback) {
  const next = new URLSearchParams(search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next
  return fallback
}
