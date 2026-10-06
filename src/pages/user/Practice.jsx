import { useEffect, useRef, useState } from 'react'
import { getSubjects, startPractice, submitPracticeAnswer, endPractice } from '../../api/endpoints'
import QuestionCard, { KeyHint, ProgressDots, sortOptions, useAnswerKeys } from '../../components/game/QuestionCard'
import * as sfx from '../../lib/sfx'
import { haptic, HAPTIC } from '../../lib/haptics'

const DIFFICULTIES = [['', 'Mixed'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
const COUNTS = [5, 10, 20, 30]

export default function Practice() {
  const [subjects, setSubjects] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [session, setSession] = useState(null) // { session_id, questions }
  const [current, setCurrent] = useState(0)
  const [feedback, setFeedback] = useState(null) // { is_correct, explanation }
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null) // { answered, correct }
  const [results, setResults] = useState({}) // questionId → is_correct, for the progress dots
  const startRef = useRef(Date.now())

  useEffect(() => {
    getSubjects().then(({ data }) => {
      setSubjects(data)
      if (data.length) setCategoryId(data[0].id)
    })
  }, [])

  useEffect(() => {
    startRef.current = Date.now()
  }, [current])

  async function handleStart() {
    setError('')
    try {
      const { data } = await startPractice({
        exam_category_id: categoryId,
        topic_id: null,
        difficulty: difficulty || null,
        question_count: Number(questionCount),
      })
      setSession(data)
      setCurrent(0)
      setFeedback(null)
      setSummary({ answered: 0, correct: 0 })
      setResults({})
    } catch (err) {
      setError(err.message)
    }
  }

  // Choosing an option is a draft; "Check answer" submits it.
  function handleSelect(optionId) {
    if (feedback) return
    sfx.play('select')
    setSelected(optionId)
  }

  async function handleCheck() {
    if (feedback || !selected) return
    const question = session.questions[current]
    try {
      const { data } = await submitPracticeAnswer(session.session_id, {
        question_id: question.id,
        option_id: selected,
        time_taken_ms: Date.now() - startRef.current,
      })
      setFeedback(data)
      setResults((r) => ({ ...r, [question.id]: data.is_correct }))
      sfx.play(data.is_correct ? 'correct' : 'wrong')
      haptic(data.is_correct ? HAPTIC.success : HAPTIC.error)
      setSummary((s) => ({ answered: s.answered + 1, correct: s.correct + (data.is_correct ? 1 : 0) }))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleNext() {
    setSelected('')
    setFeedback(null)
    setCurrent((c) => c + 1)
  }

  async function handleFinish() {
    try {
      await endPractice(session.session_id)
    } finally {
      setSession(null)
    }
  }

  const activeQuestion = session?.questions[current]
  const onLast = session ? current >= session.questions.length - 1 : false
  useAnswerKeys({
    enabled: !!activeQuestion,
    options: sortOptions(activeQuestion),
    onPick: handleSelect,
    onEnter: !feedback ? (selected ? handleCheck : undefined) : onLast ? handleFinish : handleNext,
  })

  if (!session) {
    return (
      <div className="page">
        <header className="page-head">
          <span className="eyebrow">Training ground</span>
          <h1>Practice</h1>
          <p className="muted">Solo drills with instant feedback. Your rating is never affected.</p>
        </header>
        {error && <div className="alert-error">{error}</div>}
        {summary && (
          <div className="alert-success">
            Session complete — {summary.correct}/{summary.answered} correct.
          </div>
        )}

        <section>
          <h2>Exam category</h2>
          <div className="tile-picker">
            {subjects && subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`tile-option ${categoryId === s.id ? 'selected' : ''}`}
                aria-pressed={categoryId === s.id}
                onClick={() => setCategoryId(s.id)}
              >
                <strong>{s.name}</strong>
                {s.code && <span>{s.code}</span>}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Difficulty</h2>
          <div className="segmented">
            {DIFFICULTIES.map(([v, label]) => (
              <button
                key={v || 'mixed'}
                type="button"
                className={`segmented-btn ${v ? `seg-${v}` : ''} ${difficulty === v ? 'selected' : ''}`}
                aria-pressed={difficulty === v}
                onClick={() => setDifficulty(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Questions</h2>
          <div className="segmented">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`segmented-btn ${Number(questionCount) === n ? 'selected' : ''}`}
                aria-pressed={Number(questionCount) === n}
                onClick={() => setQuestionCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <div className="find-bar">
          <div>
            <strong>{subjects.find((s) => s.id === categoryId)?.name || 'Pick a category'}</strong>
            <span className="muted"> · {difficulty || 'mixed'} · {questionCount} questions</span>
          </div>
          <button className="btn-primary btn-xl" onClick={handleStart} disabled={!categoryId}>
            Start practice
          </button>
        </div>
      </div>
    )
  }

  const question = session.questions[current]
  const isLast = current >= session.questions.length - 1

  if (!question) {
    return (
      <div className="page match-results-page outcome-victory">
        <div className="results-header">
          <div className="results-trophy" aria-hidden="true">🎯</div>
          <h1 className="results-title">Session complete</h1>
          <p className="muted">{summary.correct}/{summary.answered} correct</p>
        </div>
        <div className="results-actions">
          <button className="btn-primary btn-xl" onClick={handleFinish}>Done</button>
        </div>
      </div>
    )
  }

  const accuracy = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : null

  return (
    <div className="page match-page">
      <div className="practice-hud">
        <span className="eyebrow">🎯 Practice</span>
        <div className="match-progress">
          <span style={{ width: `${(summary.answered / session.questions.length) * 100}%` }} />
        </div>
        <span className="practice-score">
          ✓ {summary.correct}
          {accuracy != null && <small> · {accuracy}%</small>}
        </span>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <QuestionCard
        key={question.id}
        question={question}
        index={current}
        total={session.questions.length}
        selectedId={selected}
        onSelect={handleSelect}
        locked={!!feedback}
        resultFor={(opt) => (feedback && opt.id === selected ? (feedback.is_correct ? 'correct' : 'incorrect') : '')}
      >
        {!feedback && (
          <KeyHint action="check">
            {selected && (
              <button type="button" className="btn-ghost small" onClick={() => setSelected('')}>
                Clear
              </button>
            )}
          </KeyHint>
        )}
        {feedback && (
          <div className={`feedback-box ${feedback.is_correct ? 'correct' : 'incorrect'}`}>
            <strong>{feedback.is_correct ? 'Correct!' : 'Not quite.'}</strong>
            {feedback.explanation && <p>{feedback.explanation}</p>}
          </div>
        )}
      </QuestionCard>
      <div className="match-nav">
        <ProgressDots
          questions={session.questions}
          current={current}
          stateOf={(q) => (results[q.id] == null ? '' : results[q.id] ? 'right' : 'wrong')}
        />
        <div className="nav-buttons">
        <button className="btn-ghost" onClick={handleFinish}>Quit</button>
        {!feedback && (
          <button className="btn-primary btn-lg" onClick={handleCheck} disabled={!selected}>
            Check answer
          </button>
        )}
        {feedback && !isLast && <button className="btn-primary btn-lg" onClick={handleNext}>Next question →</button>}
        {feedback && isLast && <button className="btn-primary btn-lg" onClick={handleFinish}>Finish session</button>}
        </div>
      </div>
    </div>
  )
}
