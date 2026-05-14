// api/stt.js
// 음성 인식(STT) — 브라우저 오디오 Blob을 middleton Speaches(whisper) 서버로 프록시한다.
//
// 기존 구현은 브라우저 Web Speech API(webkitSpeechRecognition)에 의존했는데
// iOS Safari / 카카오톡 in-app 브라우저에서 동작이 불안정했다. 이 엔드포인트는
// 우리가 운영하는 whisper(faster-whisper-large-v3-turbo, 한국어 강제) 서버로
// 오디오를 보내 브라우저 독립적으로 STT를 수행한다.
//
// 흐름:
//   브라우저 MediaRecorder Blob (raw body, Content-Type: audio/webm 등)
//     -> POST /api/stt
//     -> middleton /whisper/v1/audio/transcriptions (OpenAI 호환 multipart)
//     -> { text }

// Vercel 기본 bodyParser 비활성화 — 오디오 바이너리를 그대로 받기 위함
export const config = { api: { bodyParser: false } }

const WHISPER_URL =
  process.env.WHISPER_URL ||
  'https://middleton.p-e.kr/whisper/v1/audio/transcriptions'
const WHISPER_MODEL =
  process.env.WHISPER_MODEL || 'deepdml/faster-whisper-large-v3-turbo-ct2'
// 차의과학대 도메인 단어들을 prompt로 prime — 고유명사 인식률 향상
const WHISPER_PROMPT =
  process.env.WHISPER_PROMPT ||
  '차의과학대학교, 전공, 진로, 상담, 면담, 세포유전자재생의학, 바이오식의약학, 시스템생명과학, 스포츠의학, 심리학, 미술치료, 디지털보건의료, 경영학, 미디어커뮤니케이션학, AI의료데이터학, 소프트웨어융합'

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function extFromContentType(ct) {
  if (!ct) return 'webm'
  if (ct.includes('mp4') || ct.includes('m4a')) return 'mp4'
  if (ct.includes('ogg')) return 'ogg'
  if (ct.includes('wav')) return 'wav'
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3'
  return 'webm'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  try {
    const audioBuf = await readRawBody(req)
    if (!audioBuf || audioBuf.length < 1000) {
      // 너무 짧은 오디오 — 무음/노이즈로 간주
      return res.status(200).json({ text: '' })
    }

    const ct = req.headers['content-type'] || 'audio/webm'
    const ext = extFromContentType(ct)

    const form = new FormData()
    form.append('file', new Blob([audioBuf], { type: ct }), `audio.${ext}`)
    form.append('model', WHISPER_MODEL)
    form.append('language', 'ko')
    form.append('response_format', 'json')
    form.append('temperature', '0')
    form.append('prompt', WHISPER_PROMPT)

    const upstream = await fetch(WHISPER_URL, { method: 'POST', body: form })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      return res
        .status(502)
        .json({ error: 'whisper upstream error', status: upstream.status, detail: detail.slice(0, 300) })
    }

    const data = await upstream.json().catch(() => ({}))
    let text = (data.text || '').trim()

    // whisper가 무음에서 흔히 뱉는 hallucination 필터
    const HALLUCINATIONS = ['시청해주셔서 감사합니다', '감사합니다', 'MBC 뉴스', '구독과 좋아요']
    if (text && HALLUCINATIONS.some((h) => text === h)) text = ''

    return res.status(200).json({ text })
  } catch (e) {
    return res.status(502).json({ error: e.message || 'stt proxy failed' })
  }
}
