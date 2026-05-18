// 경영통계 티칭봇 채팅 — Middleton stats RAG + Gemma4 프록시
// 응답 형식: { reply, ttsReply, chapter }
//   - reply: 화면 표시용 (KaTeX 수식 가능)
//   - ttsReply: 음성 발화용 (수식을 한국어로 풀어쓴 자연어)
//   - chapter: LLM이 판단한 답변 소속 챕터 번호 (1-10, 또는 null)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { message, history = [], images = [], currentChapter = null } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const response = await fetch('https://middleton.p-e.kr/finbot/api/stats-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, images, currentChapter })
    });
    const data = await response.json();
    return res.status(200).json(sanitizeResponse(data));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function sanitizeResponse(data) {
  if (!data || typeof data !== 'object') return data;

  const trimWS = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/\s+/g, ' ').trim();
  };

  return {
    ...data,
    reply:    trimWS(data.reply),
    ttsReply: trimWS(data.ttsReply),
  };
}
