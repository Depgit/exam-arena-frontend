import { useEffect, useState } from 'react'
import { flagQuestion } from '../api/endpoints'

const REASONS = [
  ['wrong_answer', 'The correct answer is wrong'],
  ['multiple_correct', 'More than one option is correct'],
  ['unclear', 'Question or options are unclear'],
  ['typo', 'Typo or formatting problem'],
  ['other', 'Something else'],
]

// Remembered per page load so re-visiting a question shows it as reported.
const reported = new Set()

// "Report" control shown at the top of every question. Opens a small form;
// the flag goes to the admin review queue.
export default function FlagQuestionButton({ questionId }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('wrong_answer')
  const [description, setDescription] = useState('')
  const [done, setDone] = useState(reported.has(questionId))
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setOpen(false)
    setError('')
    setDescription('')
    setDone(reported.has(questionId))
  }, [questionId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      await flagQuestion(questionId, { reason, description })
      reported.add(questionId)
      setDone(true)
      setOpen(false)
    } catch (err) {
      if (err.status === 409) {
        reported.add(questionId)
        setDone(true)
        setOpen(false)
      } else {
        setError(err.message)
      }
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return <span className="flag-done" title="Thanks — an admin will review this question">⚑ Reported</span>
  }

  return (
    <div className="flag-wrap">
      <button
        type="button"
        className="flag-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Report a problem with this question"
      >
        ⚑ Report
      </button>
      {open && (
        <form className="flag-panel" onSubmit={handleSubmit}>
          <strong>What's wrong with this question?</strong>
          {REASONS.map(([value, label]) => (
            <label key={value} className="flag-reason">
              <input
                type="radio"
                name={`flag-${questionId}`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              {label}
            </label>
          ))}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={reason === 'other' ? 'Describe the problem (required)' : 'Details (optional)'}
            maxLength={500}
            rows={2}
            required={reason === 'other'}
          />
          {error && <div className="alert-error">{error}</div>}
          <div className="flag-actions">
            <button type="submit" className="btn-primary small" disabled={sending}>
              {sending ? 'Sending…' : 'Submit report'}
            </button>
            <button type="button" className="btn-ghost small" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
