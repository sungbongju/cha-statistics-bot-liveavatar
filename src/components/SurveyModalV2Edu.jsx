import { useState, useRef, useEffect } from 'react'
import styles from './SurveyModal.module.css'
import { saveSurveyV2Edu } from '../lib/api'
import {
  EDU_QUESTIONS, OVERALL_QUESTION, CONSTRUCT_LABELS,
  MAJORS, MBTI_LIST, LIKERT_OPTIONS, PRIOR_STATS_LEVEL_OPTIONS, MODE_OPTIONS
} from '../lib/eduComponents'

const GRADE_OPTIONS = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: '4', label: '4학년' },
  { value: 'etc', label: '기타' },
]
const GENDER_OPTIONS = [
  { value: 'female', label: '여' },
  { value: 'male',   label: '남' },
  { value: 'no_answer', label: '응답하지 않음' },
]

export default function SurveyModalV2Edu({
  open,
  onClose,
  sessionId,
  modesUsed = [],   // ['ftf','sts','ttt']
}) {
  // 인구통계
  const [grade, setGrade]   = useState('')
  const [gender, setGender] = useState('')
  const [mbti, setMbti]     = useState('')
  const [major1, setMajor1] = useState('')
  const [major2, setMajor2] = useState('none')
  const [priorStatsLevel, setPriorStatsLevel] = useState(null)

  // Likert 13 + overall (1-5)
  const [answers, setAnswers] = useState({})    // { q_xxx: 1-5 }
  const [overall, setOverall] = useState(null)

  // 모드 사용 행동
  const [modePrimary,     setModePrimary]     = useState('')
  const [modeMostHelpful, setModeMostHelpful] = useState('')
  const [modeSwitched,    setModeSwitched]    = useState(null)  // 0|1

  // 자유응답
  const [freeHelpful,     setFreeHelpful]     = useState('')
  const [freeImprovement, setFreeImprovement] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone]   = useState(false)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (open) {
      startedAtRef.current = Date.now()
      setDone(false)
      setError('')
    }
  }, [open])

  if (!open) return null

  const handleAnswer = (code, value) => {
    setAnswers(prev => ({ ...prev, [code]: value }))
  }

  // 응답 진행률
  const totalLikert = EDU_QUESTIONS.length + 1  // 13 + overall
  const answeredLikert =
    EDU_QUESTIONS.filter(q => [1,2,3,4,5].includes(answers[q.code])).length
    + ([1,2,3,4,5].includes(overall) ? 1 : 0)

  const canSubmit =
    grade && gender && major1 && priorStatsLevel != null &&
    answeredLikert === totalLikert &&
    modePrimary && modeMostHelpful && modeSwitched !== null &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const duration_seconds = Math.round((Date.now() - startedAtRef.current) / 1000)

    const questionPayload = {}
    EDU_QUESTIONS.forEach(q => {
      questionPayload[q.code] = answers[q.code] ?? null
    })

    const payload = {
      session_id: sessionId || null,
      grade,
      gender,
      mbti: mbti || null,
      major1,
      major2: major2 === '' ? 'none' : major2,
      prior_stats_level: priorStatsLevel,
      ...questionPayload,
      q_overall: overall,
      mode_primary: modePrimary,
      mode_most_helpful: modeMostHelpful,
      mode_switched: modeSwitched,
      free_helpful: freeHelpful.trim() || null,
      free_improvement: freeImprovement.trim() || null,
      duration_seconds,
    }

    try {
      const r = await saveSurveyV2Edu(payload)
      if (r?.success) {
        setDone(true)
      } else {
        setError(r?.error || '저장에 실패했어요. 잠시 후 다시 시도해 주세요.')
      }
    } catch (e) {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  // 그룹화: construct별로 묶기
  const questionsByConstruct = ['A','B','C','D','E','F'].map(c => ({
    construct: c,
    questions: EDU_QUESTIONS.filter(q => q.construct === c),
  }))

  const renderLikert = (q, value, onSet, qNum) => (
    <div key={q.code} className={styles.question}>
      <div className={styles.qLabel}>
        <span className={styles.qNum}>Q{qNum}.</span> {q.text}
      </div>
      <div className={styles.likertRow}>
        {LIKERT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.likertBtn} ${value === opt.value ? styles.likertActive : ''}`}
            onClick={() => onSet(opt.value)}
            title={opt.label}
          >
            <span className={styles.likertNum}>{opt.value}</span>
            <span className={styles.likertLabel}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  if (done) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <div className={styles.modal}>
          <div className={styles.doneBox}>
            <h2>응답해 주셔서 감사합니다!</h2>
            <p>의견은 봇 개선과 연구 목적으로 소중히 활용됩니다.</p>
            <button className={styles.primaryBtn} onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    )
  }

  // qNum 카운터 — Part I demographics 끝나고 Part II 시작
  let qNum = 5  // Part I = Q1-Q5 (학년/성별/MBTI/전공1/전공2)
  // prior_stats_level = Q6
  // Likert 13문항 = Q7~Q19
  // overall = Q20

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>경영통계 AI 튜터 학습 경험 설문</h2>
          <button className={styles.skipBtn} onClick={onClose}>건너뛰기</button>
        </header>

        <p className={styles.intro}>
          본 설문은 방금 사용하신 <strong>퀴즈 연동형 멀티모달 AI 아바타 튜터</strong>에 대한
          익명 학습자 인식 조사입니다. 개인을 식별할 수 있는 정보는 수집하지 않습니다. 약 4~5분 소요됩니다.
        </p>

        {/* Part I 인구통계 */}
        <section className={styles.section}>
          <h3>Part I. 기본 정보</h3>

          <div className={styles.demoRow}>
            <label>Q1. 학년</label>
            <div className={styles.chipRow}>
              {GRADE_OPTIONS.map(o => (
                <button key={o.value} type="button"
                  className={`${styles.chip} ${grade === o.value ? styles.chipActive : ''}`}
                  onClick={() => setGrade(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className={styles.demoRow}>
            <label>Q2. 성별</label>
            <div className={styles.chipRow}>
              {GENDER_OPTIONS.map(o => (
                <button key={o.value} type="button"
                  className={`${styles.chip} ${gender === o.value ? styles.chipActive : ''}`}
                  onClick={() => setGender(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className={styles.demoRow}>
            <label>Q3. MBTI <span className={styles.optional}>(선택)</span></label>
            <select className={styles.select} value={mbti} onChange={e => setMbti(e.target.value)}>
              <option value="">모름 / 응답하지 않음</option>
              {MBTI_LIST.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className={styles.demoRow}>
            <label>Q4. 1전공</label>
            <select className={styles.select} value={major1} onChange={e => setMajor1(e.target.value)}>
              <option value="">선택해 주세요</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className={styles.demoRow}>
            <label>Q5. 2전공</label>
            <select className={styles.select} value={major2} onChange={e => setMajor2(e.target.value)}>
              <option value="none">없음</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className={styles.demoRow}>
            <label>Q6. 통계 사전 수준 자기평가</label>
            <div className={styles.chipRow}>
              {PRIOR_STATS_LEVEL_OPTIONS.map(o => (
                <button key={o.value} type="button"
                  className={`${styles.chip} ${priorStatsLevel === o.value ? styles.chipActive : ''}`}
                  onClick={() => setPriorStatsLevel(o.value)}
                  title={o.label}
                >
                  {o.value}. {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Part II 13문항 + 종합 (Likert 5점) */}
        <section className={styles.section}>
          <h3>Part II. 학습 경험 평가 (13문항 + 종합 1문항)</h3>
          <p className={styles.partIntro}>
            각 문항에 대해 본인의 느낀 정도를 <strong>1점(전혀 그렇지 않다) ~ 5점(매우 그렇다)</strong> 중에서 선택해 주세요.
          </p>
          {questionsByConstruct.map(({ construct, questions }) => (
            <div key={construct} className={styles.layerBlock}>
              <h4 className={styles.layerTitle}>
                {construct}. {CONSTRUCT_LABELS[construct]}
              </h4>
              {questions.map(q => {
                qNum += 1
                return renderLikert(q, answers[q.code] ?? null, (v) => handleAnswer(q.code, v), qNum)
              })}
            </div>
          ))}

          {/* 종합 */}
          <div className={styles.layerBlock}>
            <h4 className={styles.layerTitle}>종합</h4>
            {renderLikert(OVERALL_QUESTION, overall, setOverall, ++qNum)}
          </div>
        </section>

        {/* Part III 모드 사용 행동 */}
        <section className={styles.section}>
          <h3>Part III. 모드 사용 경험</h3>

          <div className={styles.demoRow}>
            <label>주로 사용한 모드</label>
            <div className={styles.chipRow}>
              {MODE_OPTIONS.map(o => (
                <button key={o.value} type="button"
                  className={`${styles.chip} ${modePrimary === o.value ? styles.chipActive : ''}`}
                  onClick={() => setModePrimary(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className={styles.demoRow}>
            <label>가장 도움이 된 모드</label>
            <div className={styles.chipRow}>
              {MODE_OPTIONS.map(o => (
                <button key={o.value} type="button"
                  className={`${styles.chip} ${modeMostHelpful === o.value ? styles.chipActive : ''}`}
                  onClick={() => setModeMostHelpful(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div className={styles.demoRow}>
            <label>모드를 전환해본 적이 있다</label>
            <div className={styles.chipRow}>
              <button type="button"
                className={`${styles.chip} ${modeSwitched === 1 ? styles.chipActive : ''}`}
                onClick={() => setModeSwitched(1)}>있다</button>
              <button type="button"
                className={`${styles.chip} ${modeSwitched === 0 ? styles.chipActive : ''}`}
                onClick={() => setModeSwitched(0)}>없다</button>
            </div>
          </div>
        </section>

        {/* Part IV 자유응답 */}
        <section className={styles.section}>
          <h3>Part IV. 자유 의견 <span className={styles.optional}>(선택)</span></h3>
          <div className={styles.freeRow}>
            <label>가장 도움이 되었던 점 한 가지</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={freeHelpful}
              onChange={e => setFreeHelpful(e.target.value)}
              maxLength={2000}
              placeholder="예: 퀴즈에서 모르는 부분을 챗봇에 물어볼 수 있어서 좋았다"
            />
          </div>
          <div className={styles.freeRow}>
            <label>개선했으면 하는 점 한 가지</label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={freeImprovement}
              onChange={e => setFreeImprovement(e.target.value)}
              maxLength={2000}
              placeholder="예: 답변 속도가 좀 더 빨랐으면 좋겠다"
            />
          </div>
        </section>

        {error && <div className={styles.error}>{error}</div>}

        <footer className={styles.footer}>
          <span className={styles.progress}>
            응답 {answeredLikert}/{totalLikert}
          </span>
          <button
            className={styles.primaryBtn}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </footer>
      </div>
    </div>
  )
}
