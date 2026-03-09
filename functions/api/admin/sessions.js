import { json } from '../_shared.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        s.*,
        COUNT(DISTINCT pe.word_id) as words_studied,
        COUNT(pe.id) as total_events,
        SUM(CASE WHEN pe.action = 'quiz_correct' THEN 1 ELSE 0 END) as correct_count,
        SUM(CASE WHEN pe.action = 'quiz_wrong' THEN 1 ELSE 0 END) as wrong_count
      FROM sessions s
      LEFT JOIN progress_events pe ON s.id = pe.session_id
      GROUP BY s.id
      ORDER BY s.last_seen_at DESC
    `).all();
    return json({ sessions: results });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
