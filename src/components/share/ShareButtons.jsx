import { useState } from 'react'

/**
 * Share a result: the phone's share sheet (WhatsApp, Instagram, …) with an
 * image card when the browser supports sharing files, plus direct WhatsApp
 * and copy buttons. makeImage is an async () => Blob, called on demand.
 */
export default function ShareButtons({ text, makeImage, filename = 'mindrace.png', label = 'Share result' }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const flash = (msg) => {
    setNote(msg)
    setTimeout(() => setNote(''), 2000)
  }

  async function share() {
    setBusy(true)
    try {
      let file = null
      if (makeImage) {
        const blob = await makeImage()
        if (blob) file = new File([blob], filename, { type: 'image/png' })
      }
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
      } else {
        await navigator.share({ text })
      }
    } catch (err) {
      if (err?.name !== 'AbortError') flash("Couldn't open sharing — use Copy instead")
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      flash('✓ Copied — paste it anywhere')
    } catch {
      flash('Copy blocked by the browser')
    }
  }

  async function download() {
    setBusy(true)
    try {
      const blob = await makeImage()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-box">
      <div className="share-buttons">
        {canShare && (
          <button type="button" className="btn-primary share-main" onClick={share} disabled={busy}>
            {busy ? 'Preparing…' : `📤 ${label}`}
          </button>
        )}
        <a
          className="btn-ghost share-wa"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <button type="button" className="btn-ghost" onClick={copy}>
          Copy
        </button>
        {makeImage && !canShare && (
          <button type="button" className="btn-ghost" onClick={download} disabled={busy}>
            {busy ? 'Preparing…' : 'Save image'}
          </button>
        )}
      </div>
      {note && <p className="share-note" role="status">{note}</p>}
    </div>
  )
}
