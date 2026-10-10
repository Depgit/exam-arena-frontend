import { useEffect, useRef } from 'react'

/**
 * Six one-digit boxes for a verification code. Typing moves to the next
 * box, Backspace goes back, and pasting (or the phone's "fill from SMS /
 * email" suggestion) fills them all at once.
 */
export default function CodeInput({ value, onChange, onComplete, disabled, invalid, length = 6 }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  // After a wrong code the boxes are cleared and re-enabled: start again at the first.
  useEffect(() => {
    if (!disabled && value === '') focus(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  function set(next) {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  function handleInput(i, e) {
    const typed = e.target.value.replace(/\D/g, '')
    if (!typed) return
    // One digit, or several at once (autofill / paste into one box).
    const next = (value.slice(0, i) + typed + value.slice(i + typed.length)).slice(0, length)
    const clean = set(next)
    focus(Math.min(i + typed.length, clean.length))
  }

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) set(value.slice(0, i) + value.slice(i + 1))
      else if (i > 0) {
        set(value.slice(0, i - 1) + value.slice(i))
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') focus(i - 1)
    else if (e.key === 'ArrowRight') focus(i + 1)
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return
    e.preventDefault()
    const clean = set(pasted)
    focus(clean.length)
  }

  return (
    <div className={`code-input ${invalid ? 'invalid' : ''}`} role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`code-box ${d ? 'filled' : ''}`}
          value={d}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Digit ${i + 1}`}
          autoFocus={i === 0}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
