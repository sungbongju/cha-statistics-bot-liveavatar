import styles from './ChapterNav.module.css'

const STATUS_ICON = {
  completed: '✓',
  current: '▸',
  locked: '🔒',
}

export default function ChapterNav({
  chapters,
  progress,       // { [chapterId]: { completed: bool, score: number, total: number } }
  currentChapter,
  onSelect,
  onModeSwitch,   // () => void — switch to chat mode
}) {
  const getStatus = (ch) => {
    if (progress[ch.id]?.completed) return 'completed'
    // 첫 챕터는 항상 열림, 나머지는 이전 챕터 완료 시 열림
    if (ch.id === 1) return 'current'
    const prev = progress[ch.id - 1]
    if (prev?.completed) return 'current'
    return 'locked'
  }

  const completedCount = Object.values(progress).filter(p => p?.completed).length
  const totalChapters = chapters.length
  const progressPct = totalChapters > 0 ? (completedCount / totalChapters) * 100 : 0

  return (
    <nav className={styles.nav}>
      <div className={styles.header}>
        <h2 className={styles.title}>경영통계</h2>
        <span className={styles.subtitle}>퀴즈 학습</span>
      </div>

      {/* 전체 진도 */}
      <div className={styles.overallProgress}>
        <div className={styles.progressInfo}>
          <span className={styles.progressLabel}>전체 진도</span>
          <span className={styles.progressValue}>{completedCount}/{totalChapters}</span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 챕터 목록 */}
      <div className={styles.chapterList}>
        {chapters.map(ch => {
          const status = getStatus(ch)
          const prog = progress[ch.id]
          const isActive = currentChapter === ch.id
          const isLocked = status === 'locked'

          return (
            <button
              key={ch.id}
              className={`${styles.chapterItem} ${styles[status]} ${isActive ? styles.active : ''}`}
              onClick={() => !isLocked && onSelect(ch.id)}
              disabled={isLocked}
              title={isLocked ? '이전 챕터를 먼저 완료하세요' : ch.title}
            >
              <span className={`${styles.statusBadge} ${styles[`badge_${status}`]}`}>
                {status === 'completed' ? STATUS_ICON.completed : ch.id}
              </span>
              <div className={styles.chapterInfo}>
                <span className={styles.chapterTitle}>{ch.title}</span>
                {prog && prog.total > 0 && (
                  <span className={styles.chapterScore}>
                    {prog.completed ? '완료' : `${prog.score}/${prog.total}`}
                  </span>
                )}
              </div>
              {status === 'locked' && (
                <span className={styles.lockIcon}>{STATUS_ICON.locked}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 하단: 봇 대화 전환 */}
      <div className={styles.footer}>
        <button className={styles.chatBtn} onClick={onModeSwitch}>
          <span className={styles.chatIcon}>💬</span>
          AI 도우미와 대화
        </button>
      </div>
    </nav>
  )
}
