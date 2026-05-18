import { useState, useRef, useEffect } from 'react'
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import styles from './ChatPanel.module.css'

// $$...$$ (block) 또는 $...$ (inline) 수식을 KaTeX 로 렌더,
// 일반 텍스트는 그대로. 수식 파싱 실패하면 원본 문자열 fallback.
function MathText({ text }) {
  if (!text || typeof text !== 'string') return text
  // 블록 수식 $$...$$ 먼저, 그 다음 인라인 $...$
  // (?:^|[^\\]) 으로 \\$ escape 회피
  const parts = []
  let i = 0
  const re = /(\$\$([\s\S]+?)\$\$)|(\$([^\$\n]+?)\$)/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push({ t: 'text', v: text.slice(i, m.index) })
    if (m[1]) parts.push({ t: 'block', v: m[2] })
    else      parts.push({ t: 'inline', v: m[4] })
    i = m.index + m[0].length
  }
  if (i < text.length) parts.push({ t: 'text', v: text.slice(i) })
  return parts.map((p, idx) => {
    if (p.t === 'text')  return <span key={idx}>{p.v}</span>
    if (p.t === 'inline') {
      try { return <InlineMath key={idx} math={p.v} /> }
      catch { return <span key={idx}>${p.v}$</span> }
    }
    if (p.t === 'block') {
      try { return <BlockMath key={idx} math={p.v} /> }
      catch { return <span key={idx}>{`$$${p.v}$$`}</span> }
    }
    return null
  })
}

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      <span /><span /><span />
    </div>
  )
}

function ContactCard({ contact }) {
  if (!contact) return null
  const { dept, phone, homepage, chairEmail, note } = contact
  return (
    <div className={styles.contactCard}>
      <div className={styles.contactHead}>
        <span className={styles.contactDept}>{dept}</span>
        {note && <span className={styles.contactNote}>{note}</span>}
      </div>
      <div className={styles.contactRows}>
        {phone && (
          <a className={styles.contactRow} href={`tel:${phone}`}>
            <span className={styles.contactLabel}>학과 사무실</span>
            <span className={styles.contactValue}>{phone}</span>
          </a>
        )}
        {homepage && (
          <a className={styles.contactRow} href={homepage} target="_blank" rel="noopener noreferrer">
            <span className={styles.contactLabel}>학과 홈페이지</span>
            <span className={styles.contactValue}>{homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
          </a>
        )}
        {chairEmail && (
          <a className={styles.contactRow} href={`mailto:${chairEmail}`}>
            <span className={styles.contactLabel}>학과장 이메일</span>
            <span className={styles.contactValue}>{chairEmail}</span>
          </a>
        )}
      </div>
    </div>
  )
}

function FormulaCard({ formulas }) {
  if (!formulas || formulas.length === 0) return null
  return (
    <div className={styles.formulaCards}>
      {formulas.map((f, i) => (
        <div key={i} className={styles.formulaCard}>
          {f.label && <span className={styles.formulaLabel}>{f.label}</span>}
          <div className={styles.formulaMath}>
            {(() => {
              try { return <BlockMath math={f.latex} /> }
              catch { return <code className={styles.formulaFallback}>{f.latex}</code> }
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`${styles.msgRow} ${isUser ? styles.userRow : styles.assistantRow}`}>
      {!isUser && (
        <div className={styles.avatar}>AI</div>
      )}
      <div className={styles.msgBody}>
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
          {msg.text === null ? <TypingDots /> : (isUser ? msg.text : <MathText text={msg.text} />)}
        </div>
        {!isUser && msg.formulas && msg.formulas.length > 0 && (
          <FormulaCard formulas={msg.formulas} />
        )}
        {!isUser && msg.contact && <ContactCard contact={msg.contact} />}
      </div>
    </div>
  )
}

export default function ChatPanel({
  messages,
  isProcessing,
  onSend,
  connected,
  isListening,
  onToggleMic,
  micEnabled,
  micAvailable = true,
  mode,
  user,
  onLoginClick,
  onLogout,
  onOpenSurvey,
  theme = 'light',
  onToggleTheme
}) {
  const [input, setInput]       = useState('')
  const bottomRef               = useRef(null)
  const textareaRef             = useRef(null)
  const displayName             = user?.name || user?.nickname || '사용자'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isProcessing) return
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSend(text)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>💬</span>
          <span className={styles.headerTitle}>면담 대화</span>
        </div>
        <div className={styles.userArea}>
          <button
            type="button"
            onClick={onToggleTheme}
            className={styles.themeBtn}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            aria-label="테마 전환"
          >{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button
            type="button"
            onClick={onOpenSurvey}
            className={styles.surveyBtn}
            title="이 봇에 대한 의견 남기기"
          >설문</button>
          {user ? (
            <>
              <span className={`${styles.headerSub} ${styles.userGreeting}`}>
                {displayName}님
              </span>
              <button
                onClick={onLogout}
                className={styles.logoutBtn}
              >로그아웃</button>
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className={styles.loginBtn}
            >로그인</button>
          )}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className={styles.inputArea}>
        {micAvailable && (
          <button
            type="button"
            className={styles.sendBtn}
            onClick={onToggleMic}
            disabled={!micEnabled}
            title={isListening ? '듣기 중지' : '음성 듣기 시작'}
            style={isListening ? { background: '#dc2626', color: '#fff' } : undefined}
          >
            {isListening ? '■' : '◉'}
          </button>
        )}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder={
            !connected ? '먼저 왼쪽의 [상담 시작] 버튼을 눌러주세요'
            : mode === 'ttt' ? '텍스트로 질문을 입력하세요…'
            : isListening ? '듣고 있어요…'
            : '궁금한 점을 입력하세요…'
          }
          rows={1}
          disabled={isProcessing || !connected}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isProcessing || !input.trim() || !connected}
        >
          {isProcessing ? <span className={styles.spinner} /> : '↑'}
        </button>
      </div>

      {/* 하단 힌트 */}
      <div className={styles.hint}>
        {mode === 'ttt'
          ? 'Enter로 전송 · Shift+Enter 줄바꿈'
          : 'Enter로 전송 · Shift+Enter 줄바꿈 · ◉ 누르면 듣기 시작'}
      </div>
    </div>
  )
}
