import { useState, useEffect } from 'react'
import styles from './AvatarPanel.module.css'

const STATUS_MAP = {
  idle:       { label: '대기 중',   dot: 'gray'  },
  connecting: { label: '연결 중…', dot: 'yellow' },
  connected:  { label: '연결됨',   dot: 'green' },
  speaking:   { label: '말하는 중', dot: 'blue'  },
}

const VISUALIZER_BARS = Array.from({ length: 120 }, (_, index) => {
  const wave = Math.sin(index * 0.39) + Math.cos(index * 0.21) + Math.sin(index * 0.11)
  const height = 8 + Math.round(Math.abs(wave) * 13) + (index % 15 === 0 ? 12 : 0)
  return { index, height }
})

export default function AvatarPanel({
  status,
  mode,
  onModeChange,
  videoRef,
  audioRef,
  userVideoRef,
  videoReady,
  cameraActive,
  onStart,
  onStop,
  onInterrupt,
  compact = false,
  connectingStep = 'idle'
}) {
  // 실제 로딩 단계 기반 진행률 + 메시지 — 이벤트로 차오르고 elapsed로 보간(interpolation)
  const STEP_MAP = {
    idle:             { pct: 0,   label: '준비 중',                emoji: '⏳' },
    camera:           { pct: 15,  label: '마이크·카메라 준비 중',    emoji: '🎤' },
    token:            { pct: 50,  label: 'AI 아바타 깨우는 중',     emoji: '✨' },
    room_connecting:  { pct: 75,  label: '영상 채널 연결 중',       emoji: '📡' },
    room_connected:   { pct: 90,  label: '거의 다 됐어요',          emoji: '🎬' },
    video_ready:      { pct: 100, label: '곧 시작합니다!',          emoji: '👋' },
  }
  const stepInfo = STEP_MAP[connectingStep] || STEP_MAP.idle

  // 첫 접속 경과 시간 (connecting 동안에만 카운트)
  const [elapsedSec, setElapsedSec] = useState(0)
  useEffect(() => {
    if (status !== 'connecting') { setElapsedSec(0); return }
    setElapsedSec(0)
    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [status])

  // 진행률: 단계 % + elapsed 기반 작은 보간 (단계 간 멈춤 느낌 방지)
  // 다음 단계까지의 부드러운 이동을 위해 elapsed 비율로 +5% 까지 추가
  const stepPct = stepInfo.pct
  const interpolated = Math.min(stepPct + (elapsedSec % 10) * 0.5, Math.min(stepPct + 5, 95))
  const progressPct = Math.round(interpolated)

  const mappedStatus = STATUS_MAP[status] || STATUS_MAP.idle
  const label = mode === 'ttt' && status === 'connected' ? '연결됨' : mappedStatus.label
  const dot = mappedStatus.dot
  const showAvatarVideo = mode === 'ftf'
  const showVoiceOnly = mode === 'sts'
  const showTextOnly = mode === 'ttt'
  const cameraEnabled = mode === 'ftf'
  const micEnabled = mode !== 'ttt'
  const stageClass = [
    styles.mediaStage,
    mode === 'ftf' ? styles.sideBySide : '',
    mode === 'sts' ? styles.voiceStage : '',
    mode === 'ttt' ? styles.textStage : ''
  ].filter(Boolean).join(' ')

  if (compact) {
    const modeLabel = showAvatarVideo ? '아바타 대화 (FTF)' : showVoiceOnly ? '음성 대화 (STS)' : 'AI 텍스트 상담'
    return (
      <div className={styles.compactPanel}>
        <audio ref={audioRef} autoPlay playsInline className={styles.hiddenMedia} />
        {!showAvatarVideo && (
          <video ref={videoRef} autoPlay playsInline className={styles.hiddenMedia} />
        )}

        {/* Header bar — always visible (finmarket .chat-header style) */}
        <div className={styles.compactHeader}>
          <div className={styles.compactHeaderLeft}>
            <span className={styles.compactHeaderTitle}>{modeLabel}</span>
            <span className={`${styles.dot} ${styles[dot]}`} />
            <span className={styles.compactHeaderStatus}>{label}</span>
          </div>
          <div className={styles.compactHeaderRight}>
            {status === 'idle' && (
              <button className={styles.compactStartBtn} onClick={onStart}>
                {showTextOnly ? '💬 상담 시작' : '▶ 시작'}
              </button>
            )}
            {status === 'connecting' && (
              <button className={styles.compactStartBtn} disabled>
                <span className={styles.spinner} /> 연결 중…
              </button>
            )}
            {status === 'speaking' && (
              <button className={styles.compactInterruptBtn} onClick={onInterrupt}>
                ⏸ 멈추기
              </button>
            )}
            {(status === 'connected' || status === 'speaking') && (
              <button className={styles.compactStopBtn}
                onClick={() => { if (window.confirm('대화를 종료할까요?')) onStop?.() }}>
                ✕ 종료
              </button>
            )}
          </div>
        </div>

        {/* 첫 접속 안내 배너 — connecting 상태일 때만 */}
        {status === 'connecting' && (showAvatarVideo || showVoiceOnly) && (
          <div className={styles.connectingBanner}>
            <div className={styles.connectingBannerTop}>
              <span className={styles.connectingBannerIcon}>{stepInfo.emoji}</span>
              <div className={styles.connectingBannerText}>
                <strong>{stepInfo.label}</strong>
                <small>첫 접속은 약 30초, 이후엔 10~15초 소요됩니다</small>
              </div>
              <span className={styles.connectingCounter}>{elapsedSec}초<small>/ 약 30초</small></span>
            </div>
            <div className={styles.connectingProgressTrack}>
              <div className={styles.connectingProgressFill} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Stage — FTF: video, STS: mic circle, TTT: hidden */}
        {showAvatarVideo && (
          <div className={styles.compactStage}>
            <video ref={videoRef} autoPlay playsInline className={styles.compactVideo}
              style={{ opacity: videoReady ? 1 : 0 }} />
            {!videoReady && (
              <div className={styles.compactPlaceholder}>
                <div className={styles.compactAvatarBadge}>AI</div>
                <p className={styles.compactPlaceholderTitle}>AI 티칭 어시스턴트</p>
                <p className={styles.compactPlaceholderSub}>차의과학대학교 경영통계</p>
              </div>
            )}
            {status === 'speaking' && <div className={styles.compactGlow} />}
            {/* Camera PIP */}
            <div className={styles.compactCameraPip}>
              <video ref={userVideoRef} autoPlay muted playsInline
                className={styles.cameraVideo}
                style={{ opacity: cameraActive ? 1 : 0 }} />
              {!cameraActive && <span className={styles.compactCamOff}>CAM</span>}
            </div>
          </div>
        )}

        {showVoiceOnly && (
          <div className={styles.compactStsStage}>
            <div className={`${styles.compactStsCircle} ${status === 'speaking' ? styles.compactSpeaking : ''}`}>
              🎤
            </div>
            <span className={styles.compactStsLabel}>
              {status === 'speaking' ? '말하는 중…' : status === 'connected' ? '듣고 있어요' : '대기 중'}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={stageClass}>
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          className={styles.hiddenMedia}
        />

        {!showAvatarVideo && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={styles.hiddenMedia}
          />
        )}

        {showAvatarVideo && (
          <div className={styles.videoWrap}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={styles.video}
              style={{ opacity: videoReady ? 1 : 0 }}
            />
            {!videoReady && (
              <div className={styles.placeholder}>
                <div className={styles.avatarIcon}>
                  <span>AI</span>
                </div>
                <p className={styles.placeholderText}>AI 티칭 어시스턴트</p>
                <p className={styles.placeholderSub}>차의과학대학교 경영통계</p>
              </div>
            )}

            {videoReady && (
              <div className={styles.nameplate}>
                <div className={styles.nameplateInner}>
                  <span className={styles.nameplateName}>AI 티칭 어시스턴트</span>
                  <span className={styles.nameplateSub}>차의과학대학교 경영통계</span>
                </div>
              </div>
            )}

            {status === 'speaking' && <div className={styles.speakGlow} />}
          </div>
        )}

        {showVoiceOnly && (
          <div className={`${styles.voicePanel} ${status === 'speaking' ? styles.voiceSpeaking : ''}`}>
            <div className={styles.circularVisualizer} aria-hidden="true">
              {VISUALIZER_BARS.map(({ index, height }) => (
                <span
                  key={index}
                  className={styles.visualizerBar}
                  style={{
                    '--angle': `${index * (360 / VISUALIZER_BARS.length)}deg`,
                    '--bar-height': `${height}px`,
                    '--delay': `${index * -0.035}s`
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {showTextOnly && (
          <div className={styles.textPanel}>
            <div className={styles.textBadge}>AI</div>
          </div>
        )}

        {mode === 'ftf' && (
          <div className={`${styles.cameraPreview} ${cameraActive ? styles.cameraOn : ''}`}>
            <video
              ref={userVideoRef}
              autoPlay
              muted
              playsInline
              className={styles.cameraVideo}
              style={{ opacity: cameraActive ? 1 : 0 }}
            />
            {!cameraActive && (
              <div className={styles.cameraPlaceholder}>
                <span>CAM</span>
                <small>사용자 캠</small>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.optionPanel} aria-label="상담 방식 설정">
        <div className={styles.optionRow}>
          <button
            type="button"
            className={`${styles.optionToggle} ${cameraEnabled ? styles.optionToggleOn : ''}`}
            onClick={() => onModeChange?.(cameraEnabled ? 'sts' : 'ftf')}
            disabled={status === 'connecting'}
            aria-pressed={cameraEnabled}
          >
            <span className={styles.toggleIcon} aria-hidden="true">📷</span>
            <span className={styles.srOnly}>카메라</span>
            <span className={styles.toggleTrack}><span /></span>
          </button>
          <button
            type="button"
            className={`${styles.optionToggle} ${micEnabled ? styles.optionToggleOn : ''}`}
            onClick={() => onModeChange?.(micEnabled ? 'ttt' : 'ftf')}
            disabled={status === 'connecting'}
            aria-pressed={micEnabled}
          >
            <span className={styles.toggleIcon} aria-hidden="true">🎙</span>
            <span className={styles.srOnly}>마이크</span>
            <span className={styles.toggleTrack}><span /></span>
          </button>
        </div>
      </div>

      {/* 상태 배지 */}
      {status === 'speaking' ? (
        <button className={styles.interruptBtn} onClick={onInterrupt} type="button" aria-label="말 멈추기">
          <span className={`${styles.dot} ${styles[dot]}`} />
          <span className={styles.pauseIcon}>||</span>
          <span className={styles.statusLabel}>말 멈추기</span>
        </button>
      ) : (
        <div className={styles.statusRow}>
          <span className={`${styles.dot} ${styles[dot]}`} />
          <span className={styles.statusLabel}>{label}</span>
        </div>
      )}

      {/* 시작 버튼 */}
      {status === 'idle' && (
        <button className={styles.startBtn} onClick={onStart}>
          <span className={styles.startBtnIcon}>▶</span>
          상담 시작
        </button>
      )}
      {status === 'connecting' && (
        <button className={styles.startBtn} disabled>
          <span className={styles.spinner} /> 연결 중…
        </button>
      )}
      {(status === 'connected' || status === 'speaking') && (
        <button
          className={styles.stopBtn}
          onClick={() => {
            if (window.confirm('대화를 종료할까요? 채팅 기록은 초기화돼요.')) onStop?.()
          }}
        >
          <span className={styles.startBtnIcon}>■</span>
          대화 종료
        </button>
      )}
    </div>
  )
}
