const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /api/track — track learning progress
      if (path === '/api/track' && request.method === 'POST') {
        return handleTrack(request, env);
      }

      // GET /api/admin/sessions — list all sessions with geo data
      if (path === '/api/admin/sessions' && request.method === 'GET') {
        return handleAdminSessions(env);
      }

      // GET /api/admin/events — recent progress events
      if (path === '/api/admin/events' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '100');
        return handleAdminEvents(env, limit);
      }

      // GET /api/admin/stats — overall statistics
      if (path === '/api/admin/stats' && request.method === 'GET') {
        return handleAdminStats(env);
      }

      // GET /api/admin/session/:id — detail for one session
      if (path.startsWith('/api/admin/session/') && request.method === 'GET') {
        const sessionId = path.split('/').pop();
        return handleSessionDetail(env, sessionId);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};

async function handleTrack(request, env) {
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

  // Upsert session
  await env.DB.prepare(`
    INSERT INTO sessions (id, ip, country, city, region, timezone, user_agent, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      ip = excluded.ip,
      last_seen_at = datetime('now')
  `).bind(sessionId, ip, country, city, region, timezone, userAgent).run();

  // Insert progress events (skip pageview-only events from DB storage)
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
}

async function handleAdminSessions(env) {
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
}

async function handleAdminEvents(env, limit) {
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
}

async function handleAdminStats(env) {
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
}

async function handleSessionDetail(env, sessionId) {
  const session = await env.DB.prepare(`SELECT * FROM sessions WHERE id = ?`).bind(sessionId).first();
  if (!session) return json({ error: 'Session not found' }, 404);

  const { results: events } = await env.DB.prepare(`
    SELECT * FROM progress_events
    WHERE session_id = ?
    ORDER BY created_at DESC
  `).bind(sessionId).all();

  return json({ session, events });
}
