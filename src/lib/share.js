// Sharing results: the text people paste into WhatsApp, and an image card
// drawn on a canvas (1080×1350, Instagram's portrait size) for stories and
// chats. Everything happens in the browser — nothing is uploaded.

export const SITE = 'https://mindrace.in'

// Daily challenges are numbered from the first one (27 Sep 2026 = #1).
const FIRST_DAILY = Date.UTC(2026, 8, 27)
export function dailyNumber(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAILY) / 86_400_000) + 1
}

export function formatClock(ms) {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// 🟩 right · 🟥 wrong · ⬜ skipped, in question order.
export function emojiGrid(review) {
  return review.map((r) => (r.is_correct ? '🟩' : r.selected_option_id ? '🟥' : '⬜')).join('')
}

export function dailyShareText({ date, correct, total, timeMs, rank, participants, review }) {
  const n = dailyNumber(date)
  const lines = [`Mind Race Daily${n ? ` #${n}` : ''} 🧠 ${correct}/${total} · ${formatClock(timeMs)}`]
  if (review?.length) lines.push(emojiGrid(review))
  if (rank > 0) lines.push(`Rank #${rank} of ${participants}`)
  lines.push(`Can you beat it? ${SITE}`)
  return lines.join('\n')
}

const MODE = { ranked: 'Ranked', arena: 'Arena', friend: 'Friend', bot: 'Bot' }

// outcome: 'victory' | 'defeat' | 'draw'
export function matchShareText({ outcome, me, opponent, mode, isBot }) {
  const vs = isBot ? opponent?.username || 'a bot' : `@${opponent?.username || 'someone'}`
  const tally = me.correct != null && opponent?.correct != null ? `${me.correct}–${opponent.correct}` : `${me.score}–${opponent?.score ?? 0} pts`
  const where = mode && !isBot ? ` in a ${MODE[mode] || mode} match` : ''
  const rating = me.elo_delta > 0 ? ` (+${me.elo_delta} rating)` : ''
  const line =
    outcome === 'victory'
      ? `⚡ I beat ${vs} ${tally}${where} on Mind Race!${rating}`
      : outcome === 'draw'
        ? `🤝 ${tally} draw against ${vs}${where} on Mind Race!`
        : `⚔️ Lost a close one to ${vs} ${tally}${where} on Mind Race.`
  const ask = outcome === 'defeat' ? 'Rematch, anyone?' : 'Think you can beat me?'
  return `${line}\n${ask} ${SITE}`
}

// ── Image card ─────────────────────────────────────────────────────────

const W = 1080
const H = 1350
const PURPLE = '#7c5cff'
const PINK = '#c04bff'
const CYAN = '#22e4ff'

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 120px "Chakra Petch"'),
      document.fonts.load('600 40px "Plus Jakarta Sans"'),
    ])
  } catch {
    /* system fonts are fine */
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

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
 * Draws a result card and returns it as a PNG Blob.
 *   eyebrow  small line on top ("DAILY CHALLENGE #15")
 *   title    the big word ("VICTORY", "8/10")
 *   subtitle under it ("vs @kingdom · Ranked")
 *   grid     optional array of 'right' | 'wrong' | 'skip' squares
 *   stats    up to 3 [label, value] pairs
 *   accent   title colour
 */
export async function drawResultCard({ eyebrow, title, subtitle, grid, stats = [], accent = '#ffffff' }) {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const display = '"Chakra Petch", "Outfit", system-ui, sans-serif'
  const body = '"Plus Jakarta Sans", system-ui, sans-serif'

  // Background: deep navy with purple and cyan glows, faint grid.
  ctx.fillStyle = '#070914'
  ctx.fillRect(0, 0, W, H)
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(7,9,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  glow(W * 0.2, H * 0.12, 700, 'rgba(124,92,255,0.45)')
  glow(W * 0.95, H * 0.9, 650, 'rgba(34,228,255,0.18)')
  ctx.strokeStyle = 'rgba(148,163,184,0.06)'
  ctx.lineWidth = 2
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // Brand mark: hexagon with a bolt, and the wordmark.
  const hx = 120, hy = 130, hr = 48
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const px = hx + hr * Math.cos(a), py = hy + hr * Math.sin(a)
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
  const hex = ctx.createLinearGradient(hx - hr, hy - hr, hx + hr, hy + hr)
  hex.addColorStop(0, PURPLE); hex.addColorStop(1, PINK)
  ctx.fillStyle = hex
  ctx.fill()
  ctx.fillStyle = '#ffd43b'
  ctx.beginPath()
  ctx.moveTo(hx + 6, hy - 30); ctx.lineTo(hx - 16, hy + 4); ctx.lineTo(hx - 1, hy + 4)
  ctx.lineTo(hx - 8, hy + 30); ctx.lineTo(hx + 16, hy - 6); ctx.lineTo(hx + 1, hy - 6)
  ctx.closePath(); ctx.fill()
  ctx.font = `700 58px ${display}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f8fafc'
  ctx.fillText('MIND', 196, hy + 2)
  const mindW = ctx.measureText('MIND').width
  ctx.fillStyle = CYAN
  ctx.fillText('RACE', 196 + mindW + 10, hy + 2)

  // Eyebrow, title, subtitle.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 38px ${display}`
  ctx.fillStyle = '#a5b4fc'
  ctx.fillText((eyebrow || '').toUpperCase().split('').join(' '), W / 2, 330)

  const titleSize = fitText(ctx, title, W - 160, 190, 700, display)
  ctx.font = `700 ${titleSize}px ${display}`
  ctx.shadowColor = accent
  ctx.shadowBlur = 40
  ctx.fillStyle = accent
  ctx.fillText(title, W / 2, 330 + 40 + titleSize * 0.85)
  ctx.shadowBlur = 0
  let y = 330 + 40 + titleSize * 0.85

  if (subtitle) {
    const subSize = fitText(ctx, subtitle, W - 160, 48, 600, body)
    ctx.font = `600 ${subSize}px ${body}`
    ctx.fillStyle = '#cbd5e1'
    y += 90
    ctx.fillText(subtitle, W / 2, y)
  }

  // Answer grid: one rounded square per question.
  if (grid?.length) {
    const size = Math.min(76, Math.floor((W - 200) / grid.length) - 14)
    const gap = 14
    const totalW = grid.length * size + (grid.length - 1) * gap
    let gx = (W - totalW) / 2
    y += 70
    for (const g of grid) {
      roundRect(ctx, gx, y, size, size, 14)
      ctx.fillStyle = g === 'right' ? '#22c55e' : g === 'wrong' ? '#ef4444' : 'rgba(148,163,184,0.25)'
      ctx.fill()
      gx += size + gap
    }
    y += size
  }

  // Stat tiles.
  if (stats.length) {
    const n = stats.length
    const gap = 28
    const tileW = (W - 160 - gap * (n - 1)) / n
    const tileH = 190
    const ty = Math.max(y + 80, 900)
    stats.forEach(([label, value], i) => {
      const tx = 80 + i * (tileW + gap)
      roundRect(ctx, tx, ty, tileW, tileH, 26)
      ctx.fillStyle = 'rgba(20,24,52,0.85)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(124,92,255,0.45)'
      ctx.lineWidth = 3
      ctx.stroke()
      const vs = fitText(ctx, String(value), tileW - 40, 76, 700, display)
      ctx.font = `700 ${vs}px ${display}`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(value), tx + tileW / 2, ty + 100)
      ctx.font = `600 30px ${body}`
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(label, tx + tileW / 2, ty + 150)
    })
  }

  // Footer call to action.
  ctx.font = `600 40px ${body}`
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText('Think you’re faster?', W / 2, H - 120)
  ctx.font = `700 46px ${display}`
  ctx.fillStyle = CYAN
  ctx.fillText('mindrace.in', W / 2, H - 62)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}
