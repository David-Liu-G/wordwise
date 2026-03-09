import { json } from '../_shared.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const { results } = await env.DB.prepare(`
      SELECT
        pe.*,
        s.ip,
        s.country,
        s.city
      FROM progress_events pe
      JOIN sessions s ON pe.session_id = s.id
      ORDER BY pe.created_at DESC
      LIMIT ?
    `).bind(limit).all();
    return json({ events: results });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
