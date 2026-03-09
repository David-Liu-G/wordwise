import { json } from '../_shared.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const sessionsResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM sessions`).first();
    const eventsResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM progress_events`).first();
    const activeResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM sessions
      WHERE last_seen_at > datetime('now', '-1 hour')
    `).first();
    const countriesResult = await env.DB.prepare(`
      SELECT country, COUNT(*) as count FROM sessions
      GROUP BY country ORDER BY count DESC
    `).all();

    return json({
      totalSessions: sessionsResult.count,
      totalEvents: eventsResult.count,
      activeSessions: activeResult.count,
      countries: countriesResult.results,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
