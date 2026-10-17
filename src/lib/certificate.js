// Certificates for college events, drawn in the browser as a PNG
// (2000 × 1414, A4 landscape) — no server work, works offline once loaded.
//
//   const canvas = await drawCertificate({ name, place, eventName, ... })
//   await shareOrDownload(canvas, 'mindrace-certificate.png')

const W = 2000
const H = 1414

const KIND = {
  1: { title: 'CERTIFICATE OF ACHIEVEMENT', line: 'won 1st place in', badge: 'WINNER', medal: '🥇', color: '#b8860b' },
  2: { title: 'CERTIFICATE OF ACHIEVEMENT', line: 'won 2nd place in', badge: 'RUNNER-UP', medal: '🥈', color: '#6f7d8c' },
  3: { title: 'CERTIFICATE OF ACHIEVEMENT', line: 'won 3rd place in', badge: '3RD PLACE', medal: '🥉', color: '#a0522d' },
  0: { title: 'CERTIFICATE OF PARTICIPATION', line: 'took part in', badge: 'PARTICIPANT', medal: '🎓', color: '#6a46ff' },
}

/** Which certificate a player gets: 1–3 for the podium, 0 for taking part. */
export function certificatePlace(standing) {
  if (!standing || standing.matches < 1) return null
  return standing.rank <= 3 ? standing.rank : 0
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Shrink the font until text fits in maxWidth.
function fitText(ctx, text, maxWidth, size, weight, family) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
    s -= 4
  } while (s > 24)
  return s
}

/**
 * Draws one certificate. place: 1, 2, 3 or 0 (participation).
 * date: a Date for the event. Returns the canvas.
 */
export async function drawCertificate({ name, place, eventName, subject, date, wins, points, certId, logoSrc = '/icons/icon-512.png' }) {
  const kind = KIND[place] ?? KIND[0]
  const display = "'Chakra Petch', 'Outfit', system-ui, sans-serif"
  const body = "'Plus Jakarta Sans', system-ui, sans-serif"
  try {
    await Promise.all([
      document.fonts.load(`700 80px 'Chakra Petch'`),
      document.fonts.load(`600 40px 'Plus Jakarta Sans'`),
      document.fonts.load(`800 40px 'Plus Jakarta Sans'`),
    ])
  } catch { /* system fonts are fine */ }
  const logo = await loadImage(logoSrc)

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  // paper
  const paper = ctx.createLinearGradient(0, 0, W, H)
  paper.addColorStop(0, '#fffdf7')
  paper.addColorStop(1, '#f6f1e3')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  // soft brand glow in the corners
  for (const [x, y, col] of [[0, 0, 'rgba(124,92,255,0.10)'], [W, H, 'rgba(34,228,255,0.10)']]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 700)
    g.addColorStop(0, col)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // double border: gold outside, brand purple inside
  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 14
  ctx.strokeRect(40, 40, W - 80, H - 80)
  ctx.strokeStyle = 'rgba(106,70,255,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(72, 72, W - 144, H - 144)
  // corner flourishes
  ctx.fillStyle = '#c9a227'
  for (const [x, y] of [[72, 72], [W - 72, 72], [72, H - 72], [W - 72, H - 72]]) {
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const cx = W / 2

  // brand
  if (logo) ctx.drawImage(logo, cx - 70, 120, 140, 140)
  ctx.fillStyle = '#1b1840'
  ctx.font = `700 46px ${display}`
  ctx.fillText('MIND RACE', cx, 318)

  // title
  ctx.fillStyle = kind.color
  ctx.font = `700 64px ${display}`
  ctx.fillText(kind.title, cx, 430)
  ctx.fillStyle = '#c9a227'
  ctx.fillRect(cx - 160, 460, 320, 5)

  ctx.fillStyle = '#4a4766'
  ctx.font = `600 36px ${body}`
  ctx.fillText('This certifies that', cx, 560)

  // name
  ctx.fillStyle = '#1b1840'
  fitText(ctx, name, W - 520, 120, 700, display)
  ctx.fillText(name, cx, 700)
  ctx.fillStyle = 'rgba(27,24,64,0.25)'
  ctx.fillRect(cx - 520, 730, 1040, 3)

  ctx.fillStyle = '#4a4766'
  ctx.font = `600 38px ${body}`
  ctx.fillText(kind.line, cx, 812)

  // event
  ctx.fillStyle = '#6a46ff'
  fitText(ctx, eventName, W - 460, 66, 800, body)
  ctx.fillText(eventName, cx, 900)

  const when = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.fillStyle = '#4a4766'
  ctx.font = `600 34px ${body}`
  const stats = `${subject} battle · ${when} · ${wins} win${wins === 1 ? '' : 's'} · ${points.toLocaleString('en-IN')} points`
  fitText(ctx, stats, W - 460, 34, 600, body)
  ctx.fillText(stats, cx, 968)

  // badge (left) and signature (right)
  ctx.textAlign = 'center'
  ctx.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  ctx.fillText(kind.medal, 420, 1175)
  ctx.fillStyle = kind.color
  ctx.font = `700 34px ${display}`
  ctx.fillText(kind.badge, 420, 1240)

  ctx.fillStyle = '#1b1840'
  ctx.font = `700 46px ${display}`
  ctx.fillText('Mind Race', W - 420, 1170)
  ctx.fillStyle = 'rgba(27,24,64,0.35)'
  ctx.fillRect(W - 600, 1192, 360, 3)
  ctx.fillStyle = '#4a4766'
  ctx.font = `600 28px ${body}`
  ctx.fillText('mindrace.in', W - 420, 1238)

  // certificate id, small, centred at the bottom
  ctx.fillStyle = 'rgba(74,71,102,0.7)'
  ctx.font = `600 24px ${body}`
  ctx.fillText(`Certificate ID: ${certId}`, cx, H - 110)

  return c
}

/** Share the certificate (phones) or download it (desktop). */
export async function shareOrDownload(canvas, filename, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return // the user closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
