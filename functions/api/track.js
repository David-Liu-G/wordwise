import { json } from './_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { sessionId, events } = body;

    if (!sessionId || !events || !Array.isArray(events)) {
      return json({ error: 'Invalid payload' }, 400);
    }

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const cf = request.cf || {};
    const country = cf.country || 'unknown';
    const city = cf.city || 'unknown';
    const region = cf.region || 'unknown';
    const timezone = cf.timezone || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    await env.DB.prepare(`
      INSERT INTO sessions (id, ip, country, city, region, timezone, user_agent, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        ip = excluded.ip,
        last_seen_at = datetime('now')
    `).bind(sessionId, ip, country, city, region, timezone, userAgent).run();

    const realEvents = events.filter(e => e.action !== 'pageview');
    if (realEvents.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT INTO progress_events (session_id, word_id, word_english, word_chinese, action, level)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const batch = realEvents.map(e =>
        stmt.bind(sessionId, e.wordId, e.wordEnglish || '', e.wordChinese || '', e.action, e.level || 0)
      );
      await env.DB.batch(batch);
    }

    return json({ ok: true, tracked: events.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
