import { useState, useRef, useCallback, useEffect } from 'react'
import AvatarPanel from './components/AvatarPanel'
import ChatPanel from './components/ChatPanel'
import AuthModal from './components/AuthModal'
import SurveyModal from './components/SurveyModal'
import styles from './App.module.css'
import { getUser, clearAuth, verifyToken, newSessionId, saveChat } from './lib/api'

// LiveAvatar (HeyGen 후속, LiveKit 기반 WebRTC). avatar_id는 박대근 교수님 워크스페이스의 LiveAvatar UUID.
const AVATAR_ID = '3554efce-af84-4701-981e-2cbd46e991af'
const INTERACTIVITY_TYPE = 'CONVERSATIONAL'

function isMobileSpeechBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
}

function getEchoGuardMs() {
  return isMobileSpeechBrowser() ? 2400 : 1200
}

function getSilenceMs() {
  return isMobileSpeechBrowser() ? 1600 : 2000
}

function normalizeTranscript(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function mergeTranscript(previous, next) {
  const prev = normalizeTranscript(previous)
  const incoming = normalizeTranscript(next)
  if (!prev) return incoming
  if (!incoming) return prev
  if (prev.includes(incoming)) return prev
  if (incoming.includes(prev)) return incoming

  for (let len = Math.min(prev.length, incoming.length); len >= 2; len--) {
    if (prev.slice(-len) === incoming.slice(0, len)) {
      return normalizeTranscript(prev + incoming.slice(len))
    }
  }

  return normalizeTranscript(`${prev} ${incoming}`)
}

function getUserDisplayName(user) {
  return user?.name || user?.nickname || '사용자'
}

function getVisitCount(user) {
  const rawCount = user?.visit_count ?? user?.visitCount ?? user?.login_count ?? user?.loginCount ?? user?.visits
  const count = Number(rawCount)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
}

function getKoreanVisitOrdinal(count) {
  const ones = ['', '첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
  const compoundOnes = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
  const exactTens = {
    10: '열',
    20: '스무',
    30: '서른',
    40: '마흔',
    50: '쉰',
    60: '예순',
    70: '일흔',
    80: '여든',
    90: '아흔',
  }
  const compoundTens = { ...exactTens, 20: '스물' }

  if (count > 0 && count < 10) return `${ones[count]}번째`
  if (count >= 10 && count < 100) {
    const ten = Math.floor(count / 10) * 10
    const one = count % 10
    return one === 0 ? `${exactTens[ten]}번째` : `${compoundTens[ten]}${compoundOnes[one]}번째`
  }
  return `${count}번째`
}

function getVisitGreeting(user) {
  if (!user) return ''
  return `${getUserDisplayName(user)}님 ${getKoreanVisitOrdinal(getVisitCount(user))} 방문을 환영합니다. `
}

function getGreetingText(user) {
  return (
    '안녕하세요. ' +
    getVisitGreeting(user) +
    '저는 차의과학대학교 신입생 전공상담을 돕는 AI 면담 어시스턴트예요. ' +
    '전공 선택이나 진로에 대해 궁금한 점을 편하게 물어봐 주세요.'
  )
}

function getGreetingTts(user) {
  return (
    '안녕하세요. ' +
    getVisitGreeting(user) +
    '저는 차 의과학 대학교 신입생 전공 상담을 돕는 에이아이 면담 어시스턴트예요. ' +
    '전공 선택이나 진로에 대해 궁금한 점을 편하게 물어봐 주세요.'
  )
}

function normalizeTtsText(text) {
  if (!text) return ''

  return String(text)
    .replace(/😊|😀|😃|😄|😁|🙂|😉|👍|🙏|✨|💡|📌|🎓|📷|🎙|🎤|▶|■|◉/g, '')
    .replace(/차의과학대학교/g, '차 의과학 대학교')
    .replace(/AI의료데이터학/g, '에이아이 의료 데이터학')
    .replace(/AI의료데이터/g, '에이아이 의료 데이터')
    .replace(/SW융합/g, '소프트웨어 융합')
    .replace(/\bAI\b/gi, '에이아이')
    .replace(/\bGPT\b/gi, '지피티')
    .replace(/\bGemma\b/gi, '젬마')
    .replace(/\bHeyGen\b/gi, '헤이젠')
    .replace(/\bSyncTalk\b/gi, '싱크톡')
    .replace(/\bLiveKit\b/gi, '라이브킷')
    .replace(/\bChrome\b/gi, '크롬')
    .replace(/\bVercel\b/gi, '버셀')
    .replace(/\bRAG\b/gi, '랙')
    .replace(/\bAPI\b/gi, '에이피아이')
    .replace(/\bURL\b/gi, '유알엘')
    .replace(/\bSTT\b/gi, '에스티티')
    .replace(/\bTTS\b/gi, '티티에스')
    .replace(/\bFTF\b/gi, '에프티에프')
    .replace(/\bSTS\b/gi, '에스티에스')
    .replace(/\bTTT\b/gi, '티티티')
    .replace(/CHA/g, '차')
    .replace(/IT/g, '아이티')
    .replace(/OK/g, '오케이')
    .replace(/\s+/g, ' ')
    .trim()
}

// LiveAvatar DataChannel 커맨드 — heygen-com/liveavatar-web-sdk 공식 spec
// 핵심: 모든 command에 event_id (UUID) 필수. 누락 시 agent가 invalid event로 drop함.
function generateEventId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function sendAvatarCommand(room, eventType, data) {
  if (!room || !room.localParticipant) {
    console.warn('[LA] sendAvatarCommand skipped: no room/localParticipant', { eventType, hasRoom: !!room })
    return
  }
  const cmd = Object.assign(
    { event_id: generateEventId(), event_type: eventType },
    data || {}
  )
  const encoded = new TextEncoder().encode(JSON.stringify(cmd))
  try {
    room.localParticipant.publishData(encoded, { reliable: true, topic: 'agent-control' })
    console.log('[LA] sendAvatarCommand:', eventType, 'event_id:', cmd.event_id.slice(0, 8))
  } catch (e) {
    console.error('[LA] publishData error:', e)
  }
}

async function stopLiveAvatarSession(sessionId) {
  if (!sessionId) return
  try {
    await fetch('/api/liveavatar-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', session_id: sessionId, reason: 'USER_CLOSED' })
    })
  } catch (e) { console.warn('[LA] stop 실패:', e) }
}

async function keepAliveLiveAvatar(sessionId) {
  if (!sessionId) return
  try {
    await fetch('/api/liveavatar-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'keep-alive', session_id: sessionId })
    })
  } catch (e) { console.warn('[LA] keep-alive 실패:', e) }
}

export default function App() {
  const [status, setStatus]             = useState('idle')   // idle | connecting | connected | speaking | listening
  const [messages, setMessages]         = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [videoReady, setVideoReady]     = useState(false)
  const [isListening, setIsListening]   = useState(false)
  const [autoListen, setAutoListen]     = useState(false)
  const [user, setUser]                 = useState(getUser())     // 로그인된 사용자 (없으면 null = 익명)
  const [conversationMode, setConversationMode] = useState('ftf')  // ftf | sts | ttt
  const [theme, setTheme]               = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])
  const [cameraStream, setCameraStream] = useState(null)
  // 첫 접속 시 자동으로 로그인 모달 — 저장된 토큰(=user)이 있으면 안 띄움
  const [authOpen, setAuthOpen]         = useState(() => !getUser())
  const [surveyOpen, setSurveyOpen]     = useState(false)
  const [surveySessionId, setSurveySessionId] = useState(null)
  const [surveyModesUsed, setSurveyModesUsed] = useState([])
  const modesUsedRef = useRef(new Set())   // 세션 동안 실제 사용된 모드 누적
  const userTurnCountRef = useRef(0)       // 사용자 발화 턴 수 (3턴 이상일 때만 설문 노출)
  const lastEndedSessionIdRef = useRef(null) // 종료 직후 헤더 "설문" 버튼이 마지막 세션을 참조하도록 보존
  const lastEndedModesRef = useRef([])

  const roomRef           = useRef(null)
  const sessionRef        = useRef(null)
  const videoRef          = useRef(null)
  const audioRef          = useRef(null)
  const userVideoRef      = useRef(null)
  const avatarVideoTrackRef = useRef(null)
  const avatarAudioTrackRef = useRef(null)
  const cameraStreamRef   = useRef(null)
  const historyRef        = useRef([])
  const sessionIdRef      = useRef(null)   // 학교 DB용 세션 ID (아바타 시작 시 새로)
  const keepAliveIntervalRef = useRef(null) // LiveAvatar keep-alive setInterval id
  const conversationModeRef = useRef('ftf')

  // 토큰 검증 — 성공하면 모달 닫음 / 실패하면 모달 유지 (이미 열려있음)
  useEffect(() => {
    verifyToken().then(u => {
      if (u) {
        setUser(u)
        setAuthOpen(false)
      }
    })
  }, [])

  const handleLogout = () => {
    clearAuth()
    setUser(null)
  }

  // STT
  const recognitionRef    = useRef(null)
  const silenceTimerRef   = useRef(null)
  const accumulatedFinalRef = useRef('')
  const isSpeakingRef     = useRef(false)
  const isProcessingRef   = useRef(false)
  const autoListenRef     = useRef(false)
  const isListeningRef    = useRef(false)
  const echoGuardUntilRef = useRef(0)
  const restartTimerRef   = useRef(null)
  const recognitionStartingRef = useRef(false)
  const startListeningRef = useRef(null)
  const lastSubmittedSpeechRef = useRef({ key: '', at: 0 })

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])
  useEffect(() => { autoListenRef.current   = autoListen }, [autoListen])
  useEffect(() => { isListeningRef.current  = isListening }, [isListening])
  useEffect(() => { isSpeakingRef.current   = (status === 'speaking') }, [status])
  useEffect(() => {
    conversationModeRef.current = conversationMode
    if (conversationMode) modesUsedRef.current.add(conversationMode)
  }, [conversationMode])

  useEffect(() => {
    if (userVideoRef.current) userVideoRef.current.srcObject = cameraStream || null
  }, [cameraStream])

  const clearListeningRestart = useCallback(() => {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = null
  }, [])

  const scheduleStartListening = useCallback((delay = 600) => {
    clearListeningRestart()
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      startListeningRef.current?.()
    }, delay)
  }, [clearListeningRestart])

  const stopUserCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop())
      cameraStreamRef.current = null
    }
    setCameraStream(null)
  }, [])

  // 카메라 프레임 1장 캡처 → JPEG data URL (없으면 null)
  // 640x480 / quality 0.7 → 약 30KB. 매 사용자 발화 시점에 1장 캡처 후 백엔드 vision LLM에 첨부.
  const captureCameraFrame = useCallback(() => {
    const video = userVideoRef.current
    if (!video || !cameraStreamRef.current) return null
    if (!video.videoWidth || !video.videoHeight) return null
    try {
      const W = 640, H = 480
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      canvas.getContext('2d').drawImage(video, 0, 0, W, H)
      return canvas.toDataURL('image/jpeg', 0.7)
    } catch (e) {
      console.warn('[captureCameraFrame] failed:', e)
      return null
    }
  }, [])

  const startUserCamera = useCallback(async () => {
    if (cameraStreamRef.current) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('이 브라우저는 카메라 연결을 지원하지 않아요.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      return true
    } catch {
      alert('카메라 권한이 필요해요. 브라우저 주소창 왼쪽의 자물쇠 아이콘에서 카메라를 허용해주세요.')
      return false
    }
  }, [])

  useEffect(() => () => stopUserCamera(), [stopUserCamera])

  // ─── LiveAvatar interrupt ────────────────────────
  const interruptAvatar = useCallback(async () => {
    echoGuardUntilRef.current = Date.now() + getEchoGuardMs() + 600
    clearListeningRestart()
    recognitionStartingRef.current = false
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
    accumulatedFinalRef.current = ''
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      try { recognitionRef.current.stop() } catch {}
    }
    isListeningRef.current = false
    setIsListening(false)
    if (sessionRef.current && roomRef.current) {
      try {
        sendAvatarCommand(roomRef.current, 'avatar.interrupt')
      } catch (e) { console.error('interrupt error:', e) }
    }
    isSpeakingRef.current = false
    setStatus('connected')
  }, [clearListeningRestart])

  // ─── 메시지 전송 ───────────────────────────────────
  const sendMessage = useCallback(async (userText) => {
    const text = userText.trim()
    if (!text || isProcessingRef.current) return
    // 봇 발화 중에 STT가 echo로 final 잡으면 여기서 방어 (echo 무한루프 차단 마지막 보루)
    if (isSpeakingRef.current) {
      console.warn('[echo guard] sendMessage suppressed during avatar speaking:', text.slice(0, 30))
      return
    }
    isProcessingRef.current = true
    setIsProcessing(true)

    setMessages(prev => [...prev, { role: 'user', text }])
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]
    userTurnCountRef.current += 1

    // DB 저장 (사용자 메시지)
    if (sessionIdRef.current) saveChat(sessionIdRef.current, 'user', text)

    setMessages(prev => [...prev, { role: 'assistant', text: null }]) // typing

    try {
      const frame = captureCameraFrame()
      const images = frame ? [frame] : []
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyRef.current.slice(-8), images })
      })
      const data = await res.json()
      const reply    = data.reply    || '죄송해요, 답변을 생성하지 못했어요.'
      const ttsReply = normalizeTtsText(data.ttsReply || reply)

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', text: reply, contact: data.contact || null }
        return next
      })
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }]

      // DB 저장 (어시스턴트 답변)
      if (sessionIdRef.current) saveChat(sessionIdRef.current, 'assistant', reply)

      // LiveAvatar 발화 — DataChannel 'avatar.speak_text' 커맨드
      if (sessionRef.current && roomRef.current && conversationModeRef.current !== 'ttt') {
        isSpeakingRef.current = true
        setStatus('speaking')
        sendAvatarCommand(roomRef.current, 'avatar.speak_text', { text: ttsReply })
      }
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', text: '오류가 발생했어요. 다시 시도해 주세요.' }
        return next
      })
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }, [])

  // ─── STT (Web Speech API) ────────────────────────
  const stopListening = useCallback(() => {
    clearListeningRestart()
    recognitionStartingRef.current = false
    clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
    accumulatedFinalRef.current = ''
    setIsListening(false)
    isListeningRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }, [clearListeningRestart])

  const startListening = useCallback(() => {
    clearListeningRestart()
    if (silenceTimerRef.current || accumulatedFinalRef.current.trim()) return
    if (!recognitionRef.current || isListeningRef.current || recognitionStartingRef.current || isProcessingRef.current) return
    if (!sessionRef.current) return
    const wait = Math.max(0, echoGuardUntilRef.current - Date.now() + 100)
    if (isSpeakingRef.current || wait > 0) {
      if (autoListenRef.current) scheduleStartListening(Math.max(400, wait))
      return
    }
    recognitionStartingRef.current = true
    try {
      recognitionRef.current.start()
    } catch (e) {
      recognitionStartingRef.current = false
      const retryable = e?.name === 'InvalidStateError' || /already|started|busy/i.test(e?.message || '')
      if (autoListenRef.current && retryable) {
        scheduleStartListening(350)
      } else {
        console.warn('speech recognition start failed:', e)
      }
    }
  }, [clearListeningRestart, scheduleStartListening])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const submitSpeechText = useCallback((rawText) => {
    const text = normalizeTranscript(rawText)
    if (!text) return

    const key = text.replace(/\s+/g, '')
    const now = Date.now()
    const last = lastSubmittedSpeechRef.current

    stopListening()
    if (key === last.key && now - last.at < 8000) return
    lastSubmittedSpeechRef.current = { key, at: now }
    sendMessage(text)
  }, [sendMessage, stopListening])

  const initRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('이 브라우저는 음성 인식을 지원하지 않아요. Chrome/Edge에서 사용해주세요.')
      return false
    }

    const rec = new SR()
    const mobileSpeech = isMobileSpeechBrowser()
    rec.lang            = 'ko-KR'
    rec.interimResults  = !mobileSpeech
    rec.continuous      = !mobileSpeech
    rec.maxAlternatives = 1

    rec.onstart = () => {
      recognitionStartingRef.current = false
      isListeningRef.current = true
      setIsListening(true)
    }

    rec.onresult = async (event) => {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final = mergeTranscript(final, t)
        else interim += t
      }

      // ─── echo 가드: 봇 발화 중 또는 LLM 처리 중에는 STT 결과 완전 무시 ───
      if (isSpeakingRef.current || isProcessingRef.current || Date.now() < echoGuardUntilRef.current) {
        return
      }

      if (final.trim()) {
        accumulatedFinalRef.current = mergeTranscript(accumulatedFinalRef.current, final)
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null
          const text = accumulatedFinalRef.current.trim()
          accumulatedFinalRef.current = ''
          submitSpeechText(text)
        }, getSilenceMs())
      } else if (interim) {
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null
          const text = mergeTranscript(accumulatedFinalRef.current, interim)
          if (text && text.length > 1) {
            accumulatedFinalRef.current = ''
            submitSpeechText(text)
          }
        }, getSilenceMs())
      }
    }

    rec.onerror = (event) => {
      recognitionStartingRef.current = false
      if (event.error === 'not-allowed') {
        alert('마이크 권한이 필요해요.\n브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하여 마이크를 허용해주세요.')
        autoListenRef.current = false
        setAutoListen(false)
      } else if (event.error === 'no-speech') {
        if (autoListenRef.current && sessionRef.current && !silenceTimerRef.current && !accumulatedFinalRef.current.trim() && !isProcessingRef.current && !isSpeakingRef.current && Date.now() >= echoGuardUntilRef.current) {
          scheduleStartListening(500)
        }
      }
      isListeningRef.current = false
      setIsListening(false)
    }

    rec.onend = () => {
      recognitionStartingRef.current = false
      isListeningRef.current = false
      setIsListening(false)
      // 자동 listening 모드면 재시작
      if (autoListenRef.current && sessionRef.current && !silenceTimerRef.current && !accumulatedFinalRef.current.trim() && !isProcessingRef.current && !isSpeakingRef.current && Date.now() >= echoGuardUntilRef.current) {
        scheduleStartListening(600)
      }
    }

    recognitionRef.current = rec
    return true
  }, [scheduleStartListening, submitSpeechText])

  // 답변 끝나면 (isProcessing false + autoListen 켜져있으면) 자동 마이크 재시작
  useEffect(() => {
    if (!isProcessing && autoListen && sessionRef.current && !isListeningRef.current && !isSpeakingRef.current) {
      if (silenceTimerRef.current || accumulatedFinalRef.current.trim()) return
      scheduleStartListening(500)
      return clearListeningRestart
    }
  }, [isProcessing, autoListen, scheduleStartListening, clearListeningRestart])

  // ─── 봇 발화 중 마이크 stop (echo로 봇 음성이 새 질문이 되는 무한루프 방지) ───
  // status === 'speaking' 들어오면 STT off, 'connected'로 빠지면 다시 on (autoListen 켜져있을 때만)
  useEffect(() => {
    if (status === 'speaking') {
      echoGuardUntilRef.current = Date.now() + getEchoGuardMs()
      clearListeningRestart()
      recognitionStartingRef.current = false
      isListeningRef.current = false
      setIsListening(false)
      // 발화 시작 → 마이크 즉시 abort (stop은 마지막 결과 emit, abort는 즉시 종료)
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
        try { recognitionRef.current.stop() } catch {}
      }
    } else if (status === 'connected' && autoListenRef.current && !silenceTimerRef.current && !accumulatedFinalRef.current.trim() && !isListeningRef.current && !isProcessingRef.current) {
      // 발화 종료 → 잠시 후 마이크 다시 on (트랙 잔향 회피 위해 1초 지연)
      const delay = Math.max(1000, echoGuardUntilRef.current - Date.now() + 100)
      scheduleStartListening(delay)
      return clearListeningRestart
    }
  }, [status, scheduleStartListening, clearListeningRestart])

  // ─── 마이크 토글 (사용자 액션) ─────────────────────
  const toggleMic = useCallback(() => {
    if (conversationModeRef.current === 'ttt') return
    if (!sessionRef.current) {
      alert('먼저 아바타를 시작해주세요.')
      return
    }
    if (!recognitionRef.current) {
      if (!initRecognition()) return
    }
    if (isListeningRef.current || autoListenRef.current) {
      autoListenRef.current = false
      setAutoListen(false)
      stopListening()
    } else {
      autoListenRef.current = true
      setAutoListen(true)
      startListening()
    }
  }, [initRecognition, startListening, stopListening])

  // ─── ESC 키로 발화 인터럽트 (OAC 규성 SOFT-INTERRUPT 패턴 차용) ───
  // - status === 'speaking' 일 때만 동작
  // - window + document 양쪽 capture phase 등록 (브라우저 누락 방어)
  // - textarea/input 포커스 중에도 동작 (blur 후 interrupt)
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      if (e.key !== 'Escape' && e.code !== 'Escape') return
      if (!sessionRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const target = e.target
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        target.blur()
      }
      interruptAvatar()
    }
    window.addEventListener('keydown', handleGlobalKeydown, true)
    document.addEventListener('keydown', handleGlobalKeydown, true)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown, true)
      document.removeEventListener('keydown', handleGlobalKeydown, true)
    }
  }, [interruptAvatar])

  // ─── 아바타 종료 ───────────────────────────────────
  const stopAvatar = useCallback(async () => {
    // STT 중지
    clearListeningRestart()
    recognitionStartingRef.current = false
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    autoListenRef.current = false
    setAutoListen(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      try { recognitionRef.current.abort?.() } catch {}
      recognitionRef.current = null
    }
    accumulatedFinalRef.current = ''
    setIsListening(false)
    stopUserCamera()
    isSpeakingRef.current = false

    // LiveAvatar keep-alive 타이머 정지
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
    }

    // LiveAvatar 세션 종료 (best-effort)
    if (sessionRef.current) {
      await stopLiveAvatarSession(sessionRef.current.session_id)
    }

    // LiveKit 연결 끊기
    if (roomRef.current) {
      try { await roomRef.current.disconnect() } catch {}
      roomRef.current = null
    }

    // 설문 트리거 — 사용자 턴 3회 이상일 때만 노출
    const endedSessionId = sessionIdRef.current
    const usedTurns = userTurnCountRef.current
    const usedModes = Array.from(modesUsedRef.current)

    // 상태 리셋
    sessionRef.current     = null
    sessionIdRef.current   = null
    avatarVideoTrackRef.current = null
    avatarAudioTrackRef.current = null
    historyRef.current     = []
    setVideoReady(false)
    setStatus('idle')
    setMessages([])           // 채팅 초기화 — 깔끔하게 다시 시작

    // 종료 직후 헤더 "설문" 버튼이 방금 끝난 세션을 참조할 수 있도록 보존
    if (endedSessionId) lastEndedSessionIdRef.current = endedSessionId
    lastEndedModesRef.current = usedModes

    if (usedTurns >= 3) {
      setSurveySessionId(endedSessionId)
      setSurveyModesUsed(usedModes)
      setSurveyOpen(true)
    }
    userTurnCountRef.current = 0
    modesUsedRef.current = new Set()
  }, [clearListeningRestart, stopUserCamera])

  const startTextMode = useCallback(() => {
    clearListeningRestart()
    recognitionStartingRef.current = false
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    autoListenRef.current = false
    setAutoListen(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      try { recognitionRef.current.abort?.() } catch {}
      recognitionRef.current = null
    }
    accumulatedFinalRef.current = ''
    setIsListening(false)
    stopUserCamera()
    isSpeakingRef.current = false

    sessionRef.current = null
    sessionIdRef.current = newSessionId()
    historyRef.current = []
    setVideoReady(false)
    setStatus('connected')

    const greetingText = getGreetingText(user)
    setMessages([{ role: 'assistant', text: greetingText }])
    saveChat(sessionIdRef.current, 'assistant', greetingText)
  }, [clearListeningRestart, stopUserCamera, user])

  // ─── 아바타 시작 ───────────────────────────────────
  const attachAvatarTracks = useCallback(() => {
    if (avatarVideoTrackRef.current && videoRef.current) {
      try {
        avatarVideoTrackRef.current.attach(videoRef.current)
        setVideoReady(true)
      } catch (e) { console.warn('video attach error:', e) }
    }
    if (avatarAudioTrackRef.current && audioRef.current) {
      try {
        avatarAudioTrackRef.current.attach(audioRef.current)
        audioRef.current.play?.().catch(() => {})
      } catch (e) { console.warn('audio attach error:', e) }
    }
  }, [])

  useEffect(() => {
    if (!sessionRef.current || conversationMode === 'ttt') return

    let rafId = 0
    const timerIds = []
    const reattach = () => attachAvatarTracks()

    rafId = window.requestAnimationFrame(reattach)
    timerIds.push(window.setTimeout(reattach, 120))
    timerIds.push(window.setTimeout(reattach, 360))

    return () => {
      window.cancelAnimationFrame(rafId)
      timerIds.forEach(window.clearTimeout)
    }
  }, [attachAvatarTracks, conversationMode])

  const startAvatar = useCallback(async () => {
    setStatus('connecting')
    sessionIdRef.current = newSessionId()  // 새 세션 ID
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    if (conversationModeRef.current === 'ftf') {
      await startUserCamera()
    } else {
      stopUserCamera()
    }
    try {
      // LiveAvatar: token + start 통합 단일 엔드포인트
      const sess = await fetch('/api/liveavatar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_id: AVATAR_ID,
          interactivity_type: INTERACTIVITY_TYPE
        })
      }).then(r => r.json())
      if (!sess.livekit_url || !sess.livekit_client_token) {
        throw new Error('LiveAvatar 세션 생성 실패: ' + JSON.stringify(sess))
      }
      sessionRef.current = sess  // { session_id, session_token, livekit_url, livekit_client_token }

      const room = new window.LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      roomRef.current = room

      room.on(window.LivekitClient.RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
        try {
          const text = new TextDecoder().decode(payload)
          const evt = JSON.parse(text)
          const type = evt.event_type || evt.type || ''
          console.log('[LA] DataReceived topic=' + topic + ' type=' + type, evt)
          if (topic && topic !== 'agent-response') return
          if (type === 'avatar.speak_started') {
            isSpeakingRef.current = true
            setStatus('speaking')
          }
          if (type === 'avatar.speak_ended') {
            isSpeakingRef.current = false
            setStatus('connected')
          }
          if (type === 'session.stopped') console.log('[LA] session stopped by server')
        } catch (e) {
          console.warn('[LA] DataReceived parse error:', e)
        }
      })

      room.on(window.LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
        console.log('[LA] TrackSubscribed:', track.kind, 'from', participant?.identity)
        if (track.kind === 'video') {
          avatarVideoTrackRef.current = track
          if (videoRef.current) {
            track.attach(videoRef.current)
            setVideoReady(true)
            console.log('[LA] video track attached')
          } else {
            console.warn('[LA] videoRef.current is null at TrackSubscribed')
          }
        }
        if (track.kind === 'audio') {
          avatarAudioTrackRef.current = track
          // v11/공식 SDK 패턴: 트랙마다 별도 audio element 생성 + body append.
          // (TrackSubscribed가 'heygen'·'liveavatar-agent-...' 둘 다 옴 — 같은 audioRef에 attach
          //  하면 두 번째가 첫 번째 덮어써서 발화 트랙이 재생 안 됨)
          const audioEl = track.attach()
          audioEl.autoplay = true
          audioEl.dataset.laTrack = participant?.identity || 'unknown'
          audioEl.style.display = 'none'
          document.body.appendChild(audioEl)
          audioEl.play?.().catch(err => console.warn('[LA] audio play() blocked:', err))
          console.log('[LA] audio track attached (separate element) from', participant?.identity)
        }
      })

      room.on(window.LivekitClient.RoomEvent.Disconnected, (reason) => {
        console.warn('[LA] Disconnected, reason:', reason)
        isSpeakingRef.current = false
        setStatus('connected')
      })

      room.on(window.LivekitClient.RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[LA] ConnectionState:', state)
      })

      console.log('[LA] connecting to', sess.livekit_url, 'session:', sess.session_id)
      await room.connect(sess.livekit_url, sess.livekit_client_token)
      console.log('[LA] room.connect OK, state:', room.state)

      // 마이크 활성화 — LiveAvatar LITE 모드는 사용자 트랙으로 서버 STT 진행
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        console.log('[LA] microphone enabled')
      } catch (e) {
        console.warn('[LA] setMicrophoneEnabled error:', e)
      }

      // 세션 유지 — LiveAvatar 세션은 일정 시간 유휴 시 자동 종료되므로 주기적 keep-alive
      keepAliveIntervalRef.current = setInterval(() => {
        keepAliveLiveAvatar(sess.session_id)
      }, 60_000)

      setStatus('connected')

      // 인사말 — 채팅 표시 + 아바타 발화
      const greetingText = getGreetingText(user)
      const greetingTts = normalizeTtsText(getGreetingTts(user))

      setMessages([{ role: 'assistant', text: greetingText }])
      saveChat(sessionIdRef.current, 'assistant', greetingText)

      // 인사말 발화 (트랙 attach 직후 첫 명령 누락 방지 위해 800ms 지연)
      isSpeakingRef.current = true
      setStatus('speaking')
      setTimeout(() => {
        try {
          sendAvatarCommand(roomRef.current, 'avatar.speak_text', { text: greetingTts })
        } catch (e) { console.error('greeting speak error:', e) }
      }, 800)

      // 마이크 자동 활성화 (사용자 클릭(시작 버튼) 컨텍스트 안이라 권한 prompt 가능)
      if (initRecognition()) {
        autoListenRef.current = true
        setAutoListen(true)
        // 인사말 끝날 때까지 기다리고 마이크 켜기 (대략 8초 잡아둠 — 인사말 끝 이벤트로 더 정밀해짐)
        scheduleStartListening(8000)
      }
    } catch (e) {
      console.error(e)
      stopUserCamera()
      if (roomRef.current) {
        try { await roomRef.current.disconnect() } catch {}
        roomRef.current = null
      }
      sessionRef.current = null
      avatarVideoTrackRef.current = null
      avatarAudioTrackRef.current = null
      setVideoReady(false)
      setStatus('idle')
    }
  }, [initRecognition, scheduleStartListening, startUserCamera, stopUserCamera, user])

  const startConversation = useCallback(() => {
    if (conversationModeRef.current === 'ttt') {
      startTextMode()
      return
    }
    startAvatar()
  }, [startAvatar, startTextMode])

  const changeConversationMode = useCallback(async (nextMode) => {
    if (nextMode === conversationModeRef.current) return

    const hasAvatarSession = Boolean(sessionRef.current)
    const isTextOnlySession = status !== 'idle' && !hasAvatarSession

    if (isTextOnlySession && nextMode !== 'ttt') {
      alert('텍스트 상담에서 음성/화상으로 바꾸려면 대화를 종료한 뒤 다시 시작해주세요.')
      return
    }

    conversationModeRef.current = nextMode
    setConversationMode(nextMode)

    if (nextMode === 'ftf') {
      if (hasAvatarSession) startUserCamera()
    } else {
      stopUserCamera()
    }

    if (nextMode === 'ttt') {
      autoListenRef.current = false
      setAutoListen(false)
      stopListening()
      return
    }

    if (hasAvatarSession) {
      if (!recognitionRef.current) initRecognition()
      autoListenRef.current = true
      setAutoListen(true)
      scheduleStartListening(500)
    }
  }, [initRecognition, scheduleStartListening, startUserCamera, status, stopListening, stopUserCamera])

  const isChatConnected = status !== 'idle' && status !== 'connecting'

  return (
    <div className={styles.app}>
      <AvatarPanel
        status={status}
        mode={conversationMode}
        onModeChange={changeConversationMode}
        videoRef={videoRef}
        audioRef={audioRef}
        userVideoRef={userVideoRef}
        videoReady={videoReady}
        cameraActive={Boolean(cameraStream)}
        onStart={startConversation}
        onStop={stopAvatar}
        onInterrupt={interruptAvatar}
        isListening={isListening}
      />
      <ChatPanel
        messages={messages}
        isProcessing={isProcessing}
        onSend={sendMessage}
        connected={isChatConnected}
        isListening={isListening}
        onToggleMic={toggleMic}
        micEnabled={conversationMode !== 'ttt' && isChatConnected}
        micAvailable={conversationMode !== 'ttt'}
        mode={conversationMode}
        user={user}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onOpenSurvey={() => {
          const liveSid = sessionIdRef.current
          const sid = liveSid || lastEndedSessionIdRef.current || null
          const liveModes = Array.from(modesUsedRef.current)
          const modes = liveModes.length ? liveModes : lastEndedModesRef.current
          setSurveySessionId(sid)
          setSurveyModesUsed(modes)
          setSurveyOpen(true)
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />
      <SurveyModal
        open={surveyOpen}
        onClose={() => setSurveyOpen(false)}
        sessionId={surveySessionId}
        modesUsed={surveyModesUsed}
        visitCount={user?.visit_count ?? 1}
      />
    </div>
  )
}
