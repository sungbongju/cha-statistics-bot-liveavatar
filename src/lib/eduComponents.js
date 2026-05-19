// survey v2_edu 14문항 메타데이터
// 퀴즈 연동형 멀티모달 AI 아바타 튜터 — 학습자 인식 (Learner Perception)

export const MAJORS = [
  '세포유전자재생의학',
  '바이오식의약학',
  '시스템생명과학',
  '스포츠의학',
  '심리학',
  '미술치료',
  '디지털보건의료',
  '경영학',
  '미디어커뮤니케이션학',
  'AI의료데이터학',
  '소프트웨어융합',
]

export const MBTI_LIST = [
  'ISTJ','ISFJ','INFJ','INTJ',
  'ISTP','ISFP','INFP','INTP',
  'ESTP','ESFP','ENFP','ENTP',
  'ESTJ','ESFJ','ENFJ','ENTJ',
]

// 5점 Likert 척도
export const LIKERT_OPTIONS = [
  { value: 1, label: '전혀 그렇지 않다' },
  { value: 2, label: '그렇지 않다' },
  { value: 3, label: '보통이다' },
  { value: 4, label: '그렇다' },
  { value: 5, label: '매우 그렇다' },
]

// 구인 6개 + 종합 1개 = 14문항
export const EDU_QUESTIONS = [
  // A. 퀴즈-챗봇 연동 인식 (퀴즈 연동형 novelty)
  { code: 'q_quiz_link',         construct: 'A', text: '퀴즈 풀이 중 모르는 부분을 챗봇에 즉시 물어볼 수 있어서 좋았다.' },
  { code: 'q_quiz_explain',      construct: 'A', text: '챗봇이 퀴즈 문제를 풀이해주는 방식이 학습에 도움이 되었다.' },

  // B. 멀티모달 인터랙션 인식 (멀티모달 novelty)
  { code: 'q_mode_switch',       construct: 'B', text: '텍스트·음성·아바타 모드를 자유롭게 전환할 수 있는 점이 좋았다.' },

  // C. 교수자 실재감 · 학습 분위기 (AI 아바타 — Teacher Presence)
  { code: 'q_teacher_presence',  construct: 'C', text: '마치 실제 교수자가 옆에서 가르쳐주는 듯한 느낌을 받았다.' },
  { code: 'q_warm_atmosphere',   construct: 'C', text: '부담 없이 질문할 수 있는 분위기였다.' },
  { code: 'q_consistent_explain',construct: 'C', text: '강의 자료와 일관된 설명이라 신뢰가 갔다.' },

  // D. 인지된 정확성 · 안전감 (Trust → Learning Safety)
  { code: 'q_accuracy',          construct: 'D', text: '봇의 답변이 정확하고 사실에 근거한다고 느꼈다.' },
  { code: 'q_limit_admit',       construct: 'D', text: '봇이 모르는 내용은 솔직히 "모른다"거나 "교수님께 직접 여쭤보세요"라고 안내했다.' },

  // E. 학습몰입 · 호기심 (Flow)
  { code: 'q_flow',              construct: 'E', text: '봇과 대화하는 동안 시간이 빠르게 지나갔다.' },
  { code: 'q_curiosity',         construct: 'E', text: '봇과 대화하면서 더 알아보고 싶다는 호기심이 생겼다.' },

  // F. 인지된 학습효과 · 사용의도 (Perceived Learning + Behavioral Intent)
  { code: 'q_understanding',     construct: 'F', text: '봇과 대화하며 통계 개념을 더 잘 이해하게 되었다.' },
  { code: 'q_confidence',        construct: 'F', text: '봇 사용 후 통계 문제를 풀 수 있겠다는 자신감이 생겼다.' },
  { code: 'q_will_reuse',        construct: 'F', text: '시험 공부할 때 이 봇을 다시 사용하고 싶다.' },
]

export const OVERALL_QUESTION = {
  code: 'q_overall',
  text: '전반적으로 이 봇이 통계 학습에 도움이 된다고 느꼈다.',
}

export const CONSTRUCT_LABELS = {
  A: '퀴즈-챗봇 연동 인식',
  B: '멀티모달 인터랙션 인식',
  C: '교수자 실재감과 학습 분위기',
  D: '인지된 정확성과 안전감',
  E: '학습몰입과 호기심',
  F: '인지된 학습효과와 사용의도',
}

export const CONSTRUCT_THEORY = {
  A: '퀴즈 연동형 핵심 novelty (형성평가-즉시설명 학습루프)',
  B: '멀티모달 핵심 novelty',
  C: 'Teacher Presence (Garrison) + 학습 환경 이론',
  D: 'Trust + Learning Safety',
  E: 'Flow (Csikszentmihalyi)',
  F: 'Perceived Learning (Kirkpatrick L2) + Self-Efficacy (Bandura) + Behavioral Intent (TAM)',
}

export const PRIOR_STATS_LEVEL_OPTIONS = [
  { value: 1, label: '매우 약함' },
  { value: 2, label: '약함' },
  { value: 3, label: '보통' },
  { value: 4, label: '강함' },
  { value: 5, label: '매우 강함' },
]

export const MODE_OPTIONS = [
  { value: 'ftf', label: '아바타 (FTF)' },
  { value: 'sts', label: '음성 (STS)' },
  { value: 'ttt', label: '텍스트 (TTT)' },
]
