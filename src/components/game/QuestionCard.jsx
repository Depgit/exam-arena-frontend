import { useEffect, useMemo, useRef } from 'react'
import FlagQuestionButton from '../FlagQuestionButton'
import { OPTION_KEYS, optionIndexForKey } from './game'

// One question UI for every mode — live match, practice and the daily
// challenge — so they look and behave the same: A–D key labels, the same
// keyboard shortcuts, the same selected/correct/incorrect states.

/** Options in display order (the server sends order_index, not array order). */
export function sortOptions(question) {
  return question ? question.options.slice().sort((a, b) => a.order_index - b.order_index) : []
}

/**
 * Shared keyboard controls for a question screen:
 *   A–D / 1–4  pick an option      Enter  primary action (lock in / check / next)
 *   ← →        previous / next question (when the mode allows jumping)
 *
 * Handlers are read through a ref, so callers can pass fresh closures every
 * render without re-binding the window listener.
 */
export function useAnswerKeys({ enabled = true, options = [], onPick, onEnter, onPrev, onNext }) {
  const ref = useRef(null)
  ref.current = { enabled, options, onPick, onEnter, onPrev, onNext }

  useEffect(() => {
    function onKey(e) {
      const h = ref.current
      if (!h?.enabled) return
      // Don't hijack typing in the flag/report form.
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Enter') {
        // Enter on a focused button should press that button, not ours too.
        if (tag === 'BUTTON' && !e.target.classList.contains('option-btn')) return
        if (h.onEnter) {
          e.preventDefault()
          h.onEnter()
        }
        return
      }
      if (e.key === 'ArrowLeft' && h.onPrev) return h.onPrev()
      if (e.key === 'ArrowRight' && h.onNext) return h.onNext()
      const idx = optionIndexForKey(e)
      if (idx !== -1 && h.options[idx]) h.onPick?.(h.options[idx].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * @param question     the question to show
 * @param index/total  for the "Q3/10" counter
 * @param selectedId   currently chosen option id ('' for none)
 * @param onSelect     (optionId) => void
 * @param locked       true once the answer can no longer change
 * @param resultFor    optional (option) => 'correct' | 'incorrect' | '' for graded modes
 * @param floater      optional { id, text, kind } score pop-up
 * @param children     footer (status line, hints, feedback)
 */
export default function QuestionCard({
  question,
  index,
  total,
  selectedId,
  onSelect,
  locked = false,
  resultFor,
  floater,
  children,
}) {
  const options = useMemo(() => sortOptions(question), [question])

  return (
    <div className="question-card">
      {floater && (
        <span key={floater.id} className={`score-floater ${floater.kind}`} aria-hidden="true">
          {floater.text}
        </span>
      )}
      <div className="question-card-head">
        {total != null && (
          <span className="q-counter">Q{index + 1}<small>/{total}</small></span>
        )}
        <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
        <FlagQuestionButton questionId={question.id} />
      </div>
      <p className="question-body">{question.body}</p>
      <div className="options">
        {options.map((opt, i) => {
          const result = resultFor?.(opt) || ''
          const isSelected = selectedId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              className={`option-btn ${isSelected ? 'selected' : ''} ${result}`}
              onClick={() => onSelect(opt.id)}
              disabled={locked}
              aria-pressed={isSelected}
            >
              <span className="option-key" aria-hidden="true">{OPTION_KEYS[i]}</span>
              <span className="option-text">{opt.option_text}</span>
            </button>
          )
        })}
      </div>
      {children}
    </div>
  )
}

/** Keyboard hint line shown under the options. */
export function KeyHint({ action = 'lock in', children }) {
  return (
    <div className="answer-actions">
      <p className="muted key-hint">
        <kbd>A</kbd>–<kbd>D</kbd> to pick · <kbd>Enter</kbd> to {action}
      </p>
      {children}
    </div>
  )
}

/**
 * Diamond progress markers, one per question. stateOf(q) returns
 * 'right' | 'wrong' | 'answered' | ''. Clickable when onJump is given.
 */
export function ProgressDots({ questions, current, stateOf, onJump }) {
  return (
    <div className="progress-dots">
      {questions.map((q, i) => (
        <button
          type="button"
          key={q.id}
          className={`dot ${stateOf(q) || ''} ${i === current ? 'active' : ''}`}
          onClick={onJump ? () => onJump(i) : undefined}
          disabled={!onJump}
          aria-label={`Question ${i + 1}`}
        />
      ))}
    </div>
  )
}
