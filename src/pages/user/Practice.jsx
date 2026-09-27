import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSubjects, startPractice, submitPracticeAnswer, endPractice } from '../../api/endpoints'
import FlagQuestionButton from '../../components/FlagQuestionButton'

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
  const startRef = useRef(Date.now())
  const navigate = useNavigate()

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
    } catch (err) {
      setError(err.message)
    }
  }

  // Choosing an option is a draft; "Check answer" submits it.
  function handleSelect(optionId) {
    if (feedback) return
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

  if (!session) {
    return (
      <div className="page">
        <h1>Practice Mode</h1>
        {error && <div className="alert-error">{error}</div>}
        {summary && (
          <div className="alert-success">
            Session complete — {summary.correct}/{summary.answered} correct.
          </div>
        )}
        <div className="form-card">
          <label>
            Exam category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {subjects && subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Number of questions
            <input
              type="number"
              min={1}
              max={50}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
            />
          </label>
          <button className="btn-primary" onClick={handleStart} disabled={!categoryId}>
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
      <div className="page">
        <h1>Session complete</h1>
        <p>{summary.correct}/{summary.answered} correct.</p>
        <button className="btn-primary" onClick={handleFinish}>Done</button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Practice — Question {current + 1} / {session.questions.length}</h1>
      {error && <div className="alert-error">{error}</div>}
      <div className="question-card">
        <div className="question-card-head">
          <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>
          <FlagQuestionButton questionId={question.id} />
        </div>
        <p className="question-body">{question.body}</p>
        <div className="options">
          {question?.options
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((opt) => {
              const isSelected = selected === opt.id
              const showResult = !!feedback && isSelected
              return (
                <button
                  key={opt.id}
                  className={`option-btn ${isSelected ? 'selected' : ''} ${showResult ? (feedback.is_correct ? 'correct' : 'incorrect') : ''
                    }`}
                  onClick={() => handleSelect(opt.id)}
                  disabled={!!feedback}
                  aria-pressed={isSelected}
                >
                  {opt.option_text}
                </button>
              )
            })}
        </div>
        {!feedback && selected && (
          <div className="answer-actions">
            <p className="muted">You can change your answer until you check it.</p>
            <button type="button" className="btn-ghost small" onClick={() => setSelected('')}>
              Clear selection
            </button>
          </div>
        )}
        {feedback && (
          <div className={`feedback-box ${feedback.is_correct ? 'correct' : 'incorrect'}`}>
            <strong>{feedback.is_correct ? 'Correct!' : 'Not quite.'}</strong>
            {feedback.explanation && <p>{feedback.explanation}</p>}
          </div>
        )}
      </div>
      <div className="match-nav">
        {!feedback && (
          <button className="btn-primary" onClick={handleCheck} disabled={!selected}>
            Check answer
          </button>
        )}
        {feedback && !isLast && <button className="btn-primary" onClick={handleNext}>Next question</button>}
        {feedback && isLast && <button className="btn-primary" onClick={handleFinish}>Finish session</button>}
        <button className="btn-ghost" onClick={handleFinish}>Quit early</button>
      </div>
    </div>
  )
}
