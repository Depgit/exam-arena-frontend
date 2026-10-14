import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * App-styled confirmation popups, in place of the browser's window.confirm
 * (a grey "mindrace.in says…" box, worst of all inside the Android app).
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Log out?', confirmText: 'Log out', tone: 'danger' }))) return
 *
 * Resolves true on confirm, false on cancel, Esc or a tap outside.
 */
const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current?.(false) // a newer question replaces an open one
        resolver.current = resolve
        setDialog(typeof opts === 'string' ? { title: opts } : opts)
      }),
    []
  )

  const close = useCallback((answer) => {
    resolver.current?.(answer)
    resolver.current = null
    setDialog(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && <ConfirmDialog {...dialog} onAnswer={close} />}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

function ConfirmDialog({ title, message, confirmText = 'OK', cancelText = 'Cancel', tone = 'primary', icon, onAnswer }) {
  useModalBehaviour(() => onAnswer(false))
  const danger = tone === 'danger'
  return createPortal(
    <div className="modal-backdrop" onClick={() => onAnswer(false)} role="presentation">
      <div
        className={`modal-card modal-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal-icon" aria-hidden="true">{icon ?? (danger ? '⚠️' : '💡')}</span>
        <h2 id="confirm-title" className="modal-title">{title}</h2>
        {message && <p id="confirm-message" className="modal-message">{message}</p>}
        <div className="modal-actions">
          {/* The safe choice gets focus first, so Enter can't do harm by accident. */}
          <button type="button" className="btn-ghost" onClick={() => onAnswer(false)} autoFocus={danger}>
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => onAnswer(true)}
            autoFocus={!danger}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** While a popup is open: Esc closes it and the page behind doesn't scroll. */
export function useModalBehaviour(onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [])
}
