import RoomOne from './RoomOne'

type Choice = {
  text: string
  correct: boolean
}

type Question = {
  category: string
  prompt: string
  hint: string
  fragment: string
  choices: Choice[]
}

const questions: Question[] = [
  {
    category: 'SELF-AWARENESS',
    prompt: '“Tell me about a weakness you’re working on.”',
    hint: 'Choose an honest answer that shows what you’re doing to improve.',
    fragment: 'CON',
    choices: [
      { text: '“I care too much about doing a great job.”', correct: false },
      {
        text: '“I used to take on too much, so I’ve been learning to prioritize and ask for help sooner.”',
        correct: true,
      },
      { text: '“I don’t really have any weaknesses.”', correct: false },
    ],
  },
  {
    category: 'TEAMWORK',
    prompt: '“Tell me about a time you disagreed with a teammate.”',
    hint: 'Show that you listened, stayed respectful, and worked toward a shared solution.',
    fragment: 'FI',
    choices: [
      { text: '“I explained why they were wrong and got the team to agree with me.”', correct: false },
      {
        text: '“I listened to their perspective, shared my concerns, and we found a solution together.”',
        correct: true,
      },
      { text: '“I avoid disagreements, so I let them make the decision.”', correct: false },
    ],
  },
  {
    category: 'PROBLEM SOLVING',
    prompt: '“What would you do if you were asked to do something you haven’t done before?”',
    hint: 'A strong answer pairs curiosity with a practical plan to learn.',
    fragment: 'DEN',
    choices: [
      { text: '“I’d wait until someone showed me exactly what to do.”', correct: false },
      {
        text: '“I’d clarify the goal, research what I need to know, and ask focused questions as I go.”',
        correct: true,
      },
      { text: '“I’d try to figure it out without telling anyone I was unsure.”', correct: false },
    ],
  },
  {
    category: 'MOTIVATION',
    prompt: '“Why should we choose you for this role?”',
    hint: 'Connect a relevant strength to what the team needs, and keep it specific.',
    fragment: 'T',
    choices: [
      {
        text: '“My experience in organizing projects fits your needs, and I’m excited to help the team deliver great work.”',
        correct: true,
      },
      { text: '“I need a job, and I’m available to start immediately.”', correct: false },
      { text: '“I’m probably the best candidate you’ll interview.”', correct: false },
    ],
  },
]

function App() {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [complete, setComplete] = useState(false)

  const question = questions[questionIndex]
  const correctCount = questionIndex + (answered && feedback === 'correct' ? 1 : 0)
  const fragments = questions
    .slice(0, questionIndex + (answered && feedback === 'correct' ? 1 : 0))
    .map((item) => item.fragment)
  const password = fragments.join('')

  function submitAnswer() {
    if (selectedChoice === null || answered) return

    const isCorrect = question.choices[selectedChoice].correct
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setAnswered(isCorrect)
  }

  function continueGame() {
    if (questionIndex === questions.length - 1) {
      setComplete(true)
      return
    }

    setQuestionIndex((current) => current + 1)
    setSelectedChoice(null)
    setAnswered(false)
    setFeedback(null)
    setShowHint(false)
  }

  function playAgain() {
    setQuestionIndex(0)
    setSelectedChoice(null)
    setAnswered(false)
    setFeedback(null)
    setShowHint(false)
    setComplete(false)
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="brand" href="#room" aria-label="Escape Room Online home">
          <span className="brand-mark" aria-hidden="true">E</span>
          <span>ESCAPE<span className="brand-light">ROOM</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#rooms">Rooms</a>
          <a href="#room">Leaderboard</a>
          <a href="#room">How to play</a>
        </nav>
        <div className="player-chip">
          <span className="online-dot" />
          <span>PLAYER 01</span>
          <span className="player-avatar" aria-hidden="true">H</span>
        </div>
      </header>

      <section className="game-content" id="room">
        <div className="room-heading">
          <div>
            <a className="back-link" href="#room"><span aria-hidden="true">←</span> ALL ROOMS</a>
            <div className="title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> ROOM 02 <span className="eyebrow-dot">/</span> THE INTERVIEW</div>
                <h1>The Interview</h1>
                <p className="room-subtitle">Every answer brings you closer to the exit.</p>
              </div>
            </div>
          </div>
          <div className="room-status"><span className="status-dot" /> ROOM IN PROGRESS</div>
        </div>

        <div className="game-grid">
          <section className="office-scene" aria-label="A mysterious interview room">
            <div className="scene-topline">
              <span><span className="live-indicator" /> LIVE SCENE</span>
              <span className="scene-coordinate">NIGHT SHIFT <span>·</span> 09:41 PM</span>
            </div>
            <div className="window-frame">
              <div className="window-glow" />
              <div className="window-mullion" />
              <div className="city-light city-light-one" />
              <div className="city-light city-light-two" />
              <div className="city-light city-light-three" />
              <div className="city-light city-light-four" />
            </div>
            <div className="shelf">
              <span /><span /><span /><span /><span />
            </div>
            <div className="portrait">
              <span className="portrait-head" />
              <span className="portrait-body" />
            </div>
            <div className="lamp">
              <span className="lamp-shade" />
              <span className="lamp-neck" />
              <span className="lamp-base" />
            </div>
            <div className="scene-person">
              <div className="person-halo" />
              <div className="person-head">
                <span className="person-hair" />
                <span className="person-face">
                  <i className="eye eye-left" />
                  <i className="eye eye-right" />
                </span>
                <span className="person-ear" />
              </div>
              <div className="person-neck" />
              <div className="person-suit">
                <span className="shirt" />
                <span className="tie" />
                <span className="lapel lapel-left" />
                <span className="lapel lapel-right" />
              </div>
              <div className="person-label"><span className="label-dot" /> THE INTERVIEWER</div>
            </div>
            <div className="desk">
              <div className="desk-edge" />
              <div className="desk-object desk-folder" />
              <div className="desk-object desk-paper" />
              <div className="desk-object desk-cup"><span /></div>
              <div className="desk-front" />
            </div>
            <div className="scene-caption">
              <span className="caption-icon">◈</span>
              <span>“Take your time. The right answer is already in you.”</span>
            </div>
            <div className="scene-vignette" />
          </section>

          <aside className="progress-card">
            <div className="card-kicker">YOUR PROGRESS <span>✦</span></div>
            <div className="progress-heading">
              <strong>{String(Math.min(questionIndex + 1, questions.length)).padStart(2, '0')}</strong>
              <span> / {String(questions.length).padStart(2, '0')}</span>
              <span className="progress-label">QUESTIONS</span>
            </div>
            <div className="progress-track" aria-label={`${Math.round((correctCount / questions.length) * 100)}% complete`}>
              <span style={{ width: `${(correctCount / questions.length) * 100}%` }} />
            </div>
            <div className="step-list">
              {questions.map((item, index) => {
                const isSolved = index < correctCount
                const isCurrent = index === questionIndex && !complete
                return (
                  <div className={`step-item${isSolved ? ' is-solved' : ''}${isCurrent ? ' is-current' : ''}`} key={item.category}>
                    <span className="step-icon">{isSolved ? '✓' : String(index + 1).padStart(2, '0')}</span>
                    <span className="step-name">{item.category}</span>
                    <span className="step-state">{isSolved ? 'SOLVED' : isCurrent ? 'IN PLAY' : 'LOCKED'}</span>
                  </div>
                )
              })}
            </div>
            <div className="divider" />
            <div className="password-title"><span>▣</span> PASSWORD FRAGMENTS</div>
            <p className="password-caption">Collect every fragment to unlock the door.</p>
            <div className="password-slots" aria-label={`Password collected: ${password || 'none yet'}`}>
              {questions.map((item, index) => (
                <span className={`password-slot${index < fragments.length ? ' is-filled' : ''}`} key={item.fragment}>
                  {fragments[index] ?? '•••'}
                </span>
              ))}
            </div>
            <div className="room-tip"><span className="tip-icon">✧</span><span>Think clearly. A great answer is honest, thoughtful, and specific.</span></div>
          </aside>
        </div>

        <section className="question-card" aria-live="polite">
          {!complete ? (
            <>
              <div className="question-main">
                <div className="question-meta">
                  <span className="question-number">QUESTION {String(questionIndex + 1).padStart(2, '0')}</span>
                  <span className="meta-divider" />
                  <span className="question-category">{question.category}</span>
                </div>
                <h2>{question.prompt}</h2>
                <div className="answer-list" role="group" aria-label="Choose your answer">
                  {question.choices.map((choice, index) => {
                    const isSelected = selectedChoice === index
                    const isCorrect = answered && choice.correct
                    const isWrong = feedback === 'incorrect' && isSelected
                    return (
                      <button
                        className={`answer-option${isSelected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`}
                        key={choice.text}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={answered}
                        onClick={() => {
                          setSelectedChoice(index)
                          setFeedback(null)
                        }}
                      >
                        <span className="choice-marker">{String.fromCharCode(65 + index)}</span>
                        <span className="choice-text">{choice.text}</span>
                        <span className="choice-check">{isCorrect ? '✓' : isWrong ? '×' : '↗'}</span>
                      </button>
                    )
                  })}
                </div>
                {feedback === 'incorrect' && (
                  <p className="feedback feedback-error"><span>↻</span> Not quite. Try another response, or use a hint to rethink what the interviewer is looking for.</p>
                )}
                {feedback === 'correct' && (
                  <p className="feedback feedback-success"><span>✦</span> That’s a thoughtful answer. You found a password fragment: <strong>{question.fragment}</strong></p>
                )}
              </div>
              <div className="question-footer">
                <button className="hint-button" type="button" onClick={() => setShowHint((visible) => !visible)} aria-expanded={showHint}>
                  <span className="bulb-icon">✧</span> {showHint ? 'HIDE HINT' : 'NEED A HINT?'}
                </button>
                {showHint && <p className="hint-message">{question.hint}</p>}
                <div className="footer-actions">
                  {!answered ? (
                    <button className="primary-button" type="button" onClick={submitAnswer} disabled={selectedChoice === null}>
                      SUBMIT ANSWER <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button" type="button" onClick={continueGame}>
                      {questionIndex === questions.length - 1 ? 'UNLOCK THE EXIT' : 'NEXT QUESTION'} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="completion-panel">
              <span className="completion-spark">✦</span>
              <div className="question-meta"><span className="question-number">ROOM COMPLETE</span></div>
              <h2>You nailed the interview.</h2>
              <p>You collected every fragment and unlocked the next room.</p>
              <div className="completion-password"><span>EXIT CODE</span><strong>{questions.map((item) => item.fragment).join('')}</strong><span className="completion-unlocked">DOOR UNLOCKED ✓</span></div>
              <button className="primary-button" type="button" onClick={playAgain}>PLAY AGAIN <span aria-hidden="true">↻</span></button>
            </div>
          )}
        </section>
        <footer className="game-footer">
          <span>ESCAPE ROOM ONLINE <span className="footer-separator">/</span> ROOM 02</span>
          <span><span className="footer-lock">▣</span> ROOM 02 · THE INTERVIEW</span>
        </footer>
      </section>
    </main>
  )
}

export default App
