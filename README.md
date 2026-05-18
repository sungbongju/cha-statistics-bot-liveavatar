# cha-statistics-bot-liveavatar

차의과학대학교 경영학전공 **경영통계 티칭봇** — LiveAvatar (LiveKit 기반 WebRTC).

박대근 교수님의 [경영통계 Obsidian 강의자료](https://sdkparkforbi.github.io/obsidian-vault/statistics/)
10개 챕터(통계 용어 → 회귀분석)를 RAG 인덱스로 사용하여, 학생이 음성·텍스트로
통계 개념을 학습할 수 있는 AI 티칭 어시스턴트.

원본 [`cha-interview-bot-liveavatar`](https://github.com/sungbongju/cha-interview-bot-liveavatar)
(전공 상담봇)의 코드를 베이스로, 도메인을 **상담 → 통계 티칭**으로 전환.

## 차별화 포인트 3가지

1. **카탈로그형 → 학습형 네비게이션**
   - 좌측 카테고리 패널 → 챕터 진도 패널 (1장 → 10장 누적)
   - 선수 챕터 안 본 학생에게 봇이 "먼저 N장부터 보세요" 안내

2. **LLM이 못 푸는 계산은 함수로 빼기**
   - `scipy.stats`를 백엔드 함수로 노출 (t/z/카이제곱/F 검정)
   - LLM은 tool-call로 호출 → 정확도 보장

3. **아바타 음성 발화의 수식 처리**
   - 응답 이중 출력: `reply` (KaTeX LaTeX) + `ttsReply` (한국어 풀어쓴 자연어)
   - `$\sigma/\sqrt{n}$` → "시그마를 루트 N으로 나눈 값"

## 아키텍처

```
[Browser]
   ├─ React + Vite
   ├─ LiveKit-client (HeyGen LiveAvatar)
   ├─ Web Audio: MediaRecorder + RMS VAD (STT)
   └─ KaTeX (수식 렌더링, 추가 예정)
   ↓
[Vercel API proxy]
   ├─ /api/stt          → middleton whisper (Korean prompt prime)
   ├─ /api/chat         → middleton stats-chat (RAG + Gemma4)
   ├─ /api/school-api   → aiforalab statistics-api (DB)
   └─ /api/liveavatar-* → HeyGen LiveAvatar SaaS
   ↓
[Middleton — Gemma4 + RAG]
   ├─ Ollama gemma4:latest (port 11435)
   ├─ Ollama bge-m3 (port 11436, embeddings)
   ├─ stats-rag.js (chunks + embeddings 코사인 유사도)
   └─ stats-chat.js (티칭 prompt + reply/ttsReply 분리)
   ↓
[학교 서버 — DB]
   ├─ cha_statistics_db (MySQL)
   └─ /var/www/html/statistics-api/api.php (PHP)
```

## 환경변수

```
LIVEAVATAR_API_KEY    필수 (Vercel)
WHISPER_URL           선택 (기본: middleton)
OMNI_URL              선택 (기본: middleton)
```

## RAG 데이터 (현재)

- 10 챕터 × 평균 7 chunks ≈ **71 chunks**
- 임베딩: bge-m3 (L2 정규화)
- 검색: top-5, minScore 0.25

## 상태

🚧 **개발 진행 중** — 2026-05 KCI 논문 마감(5/29) 대응 작업

## 라이선스

미정 — 학내 사용 우선
