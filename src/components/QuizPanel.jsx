import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './QuizPanel.module.css'
import { saveQuizAttempt } from '../lib/api'

function ProgressBar({ current, total }) {
  const pct = total > 0 ? (current / total) * 100 : 0
  return (
    <div className={styles.progressBar}>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.progressText}>{current} / {total}</span>
    </div>
  )
}

function OptionButton({ label, index, selected, correct, revealed, onClick }) {
  let stateClass = ''
  if (revealed) {
    if (index === correct) stateClass = styles.correct
    else if (index === selected) stateClass = styles.wrong
    else stateClass = styles.dimmed
  } else if (index === selected) {
    stateClass = styles.selected
  }

  const letters = ['A', 'B', 'C', 'D']

  return (
    <button
      className={`${styles.option} ${stateClass}`}
      onClick={() => onClick(index)}
      disabled={revealed}
    >
      <span className={styles.optionLetter}>{letters[index]}</span>
      <span className={styles.optionText}>{label}</span>
      {revealed && index === correct && <span className={styles.checkMark}>✓</span>}
      {revealed && index === selected && index !== correct && <span className={styles.xMark}>✗</span>}
    </button>
  )
}

function QuizCard({ question, questionIndex, total, onAnswer, onAskAI }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)

  // 문제 바뀌면 초기화
  useEffect(() => {
    setSelected(null)
    setRevealed(false)
    setShowExplanation(false)
  }, [question.id])

  const handleSelect = (idx) => {
    if (revealed) return
    setSelected(idx)
  }

  const handleSubmit = () => {
    if (selected === null) return
    setRevealed(true)
    setShowExplanation(true)
    onAnswer(selected === question.answer, selected)
  }

  const isCorrect = selected === question.answer

  return (
    <div className={styles.card}>
      {/* 상단: 문제 번호 + 카테고리 */}
      <div className={styles.cardHeader}>
        <span className={styles.qNumber}>Q{questionIndex + 1}</span>
        <ProgressBar current={questionIndex + 1} total={total} />
      </div>

      {/* 질문 */}
      <div className={styles.questionArea}>
        <p className={styles.questionText}>{question.question}</p>
      </div>

      {/* 선택지 */}
      <div className={styles.options}>
        {question.options.map((opt, i) => (
          <OptionButton
            key={i}
            label={opt}
            index={i}
            selected={selected}
            correct={question.answer}
            revealed={revealed}
            onClick={handleSelect}
          />
        ))}
      </div>

      {/* 해설 (정답 확인 후) */}
      {showExplanation && (
        <div className={`${styles.explanation} ${isCorrect ? styles.explanationCorrect : styles.explanationWrong}`}>
          <div className={styles.explanationHeader}>
            {isCorrect ? '정답이에요!' : '아쉬워요!'}
          </div>
          <p className={styles.explanationText}>{question.explanation}</p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className={styles.cardActions}>
        {!revealed && (
          <>
            <button
              className={styles.askAiBtn}
              onClick={() => onAskAI(question)}
              title="AI 도우미에게 설명을 요청합니다"
            >
              🤔 잘 모르겠어요
            </button>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={selected === null}
            >
              정답 확인
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ChapterComplete({ chapter, score, total, attemptNumber, improvement, onRetry, onNext, hasNext }) {
  const pct = Math.round((score / total) * 100)
  const isPerfect = score === total
  const isPassing = pct >= 80

  return (
    <div className={styles.completeCard}>
      <div className={`${styles.completeIcon} ${isPerfect ? styles.perfect : isPassing ? styles.passing : styles.failing}`}>
        {isPerfect ? '★' : isPassing ? '✓' : '↻'}
      </div>
      <h2 className={styles.completeTitle}>
        {isPerfect ? '완벽합니다!' : isPassing ? '통과!' : '다시 도전해보세요'}
      </h2>
      <p className={styles.completeSubtitle}>{chapter.title}</p>

      <div className={styles.scoreDisplay}>
        <span className={styles.scoreNumber}>{score}</span>
        <span className={styles.scoreDivider}>/</span>
        <span className={styles.scoreTotal}>{total}</span>
      </div>
      <div className={styles.scorePct}>{pct}% 정답</div>

      {/* 재시험 향상도 배지 (팀원 제안: '향상된 정도') */}
      {attemptNumber > 1 && (
        <div className={styles.attemptBadge}>
          {attemptNumber}차 시도
          {improvement !== null && improvement > 0 && (
            <span className={styles.improvementBadge}>+{improvement}점 향상</span>
          )}
          {improvement !== null && improvement === 0 && (
            <span className={styles.improvementBadgeNeutral}>이전과 동일</span>
          )}
        </div>
      )}

      {!isPassing && (
        <p className={styles.completeHint}>
          80% 이상 맞추면 다음 챕터가 열려요
        </p>
      )}

      <div className={styles.completeActions}>
        <button className={styles.retryBtn} onClick={onRetry}>
          다시 풀기
        </button>
        {isPassing && hasNext && (
          <button className={styles.nextBtn} onClick={onNext}>
            다음 챕터 →
          </button>
        )}
      </div>
    </div>
  )
}

export default function QuizPanel({
  chapter,          // { id, title, description, questions: [] }
  progress,         // { completed, score, total, first_score, best_score }
  onComplete,       // (chapterId, score, total, attemptNumber) => void
  onAskAI,          // (question, opts) => void  — 봇에 설명 요청 (opts: { asked_ai: true })
  onNextChapter,    // () => void
  hasNextChapter,
}) {
  const [currentQ, setCurrentQ] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [finished, setFinished] = useState(false)
  // 같은 챕터를 N번째 시도하는지 (재시험 추적 — 팀원 제안 '향상된 정도')
  const [attemptNumber, setAttemptNumber] = useState(1)
  // 문제별 시작 시각 (duration_ms 측정)
  const questionStartRef = useRef(Date.now())
  // 이 문제에서 AI 도움 요청했는지 (체크박스 역할)
  const askedAiRef = useRef(false)

  // 챕터 바뀌면 초기화
  useEffect(() => {
    setCurrentQ(0)
    setScore(0)
    setAnswered(0)
    setFinished(false)
    setAttemptNumber(1)
    questionStartRef.current = Date.now()
    askedAiRef.current = false
  }, [chapter?.id])

  // 다음 문제로 넘어갈 때마다 시간·AI 플래그 리셋
  useEffect(() => {
    questionStartRef.current = Date.now()
    askedAiRef.current = false
  }, [currentQ])

  const questions = chapter?.questions || []

  const handleAnswer = useCallback((isCorrect, selected) => {
    const newScore = score + (isCorrect ? 1 : 0)
    const newAnswered = answered + 1
    setScore(newScore)
    setAnswered(newAnswered)

    // ── DB 저장 (fire-and-forget) ──
    const q = questions[currentQ]
    if (q) {
      saveQuizAttempt({
        chapter_id:      chapter.id,
        question_id:     q.id,
        question_index:  currentQ,
        attempt_number:  attemptNumber,
        selected_answer: selected,
        correct_answer:  q.answer,
        is_correct:      isCorrect ? 1 : 0,
        asked_ai:        askedAiRef.current ? 1 : 0,
        duration_ms:     Date.now() - questionStartRef.current
      })
    }
  }, [score, answered, questions, currentQ, chapter?.id, attemptNumber])

  // AskAI wrapper — 클릭 시 askedAiRef 마킹 후 부모 전달
  const handleAskAI = useCallback((question) => {
    askedAiRef.current = true
    onAskAI?.(question, { asked_ai: true })
  }, [onAskAI])

  const handleNext = useCallback(() => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1)
    } else {
      // 챕터 완료 — attempt_number도 함께 전달
      setFinished(true)
      onComplete(chapter.id, score, questions.length, attemptNumber)
    }
  }, [currentQ, questions.length, chapter?.id, score, attemptNumber, onComplete])

  const handleRetry = useCallback(() => {
    setCurrentQ(0)
    setScore(0)
    setAnswered(0)
    setFinished(false)
    setAttemptNumber(n => n + 1)  // 재시험 = N차 시도
    questionStartRef.current = Date.now()
    askedAiRef.current = false
  }, [])

  if (!chapter) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📊</div>
          <h2 className={styles.emptyTitle}>챕터를 선택하세요</h2>
          <p className={styles.emptyDesc}>
            왼쪽에서 학습할 챕터를 선택하면<br />퀴즈가 시작됩니다
          </p>
        </div>
      </div>
    )
  }

  if (finished) {
    return (
      <div className={styles.panel}>
        <ChapterComplete
          chapter={chapter}
          score={score}
          total={questions.length}
          attemptNumber={attemptNumber}
          improvement={
            progress?.first_score != null
              ? score - progress.first_score
              : null
          }
          onRetry={handleRetry}
          onNext={onNextChapter}
          hasNext={hasNextChapter}
        />
      </div>
    )
  }

  const currentQuestion = questions[currentQ]
  if (!currentQuestion) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <p>이 챕터에 문제가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* 챕터 헤더 */}
      <div className={styles.chapterHeader}>
        <span className={styles.chapterTag}>{chapter.id}장</span>
        <h1 className={styles.chapterTitle}>{chapter.title}</h1>
        {chapter.description && (
          <p className={styles.chapterDesc}>{chapter.description}</p>
        )}
      </div>

      {/* 퀴즈 카드 */}
      <div className={styles.quizArea}>
        <QuizCard
          key={currentQuestion.id}
          question={currentQuestion}
          questionIndex={currentQ}
          total={questions.length}
          onAnswer={handleAnswer}
          onAskAI={handleAskAI}
        />

        {/* 다음 문제 버튼 (정답 확인 후) */}
        {answered > currentQ && !finished && (
          <button className={styles.nextQuestionBtn} onClick={handleNext}>
            {currentQ < questions.length - 1 ? '다음 문제 →' : '결과 보기'}
          </button>
        )}
      </div>
    </div>
  )
}
