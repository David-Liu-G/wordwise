const API_URL = process.env.REACT_APP_API_URL || '';

interface TrackEvent {
  wordId: string;
  wordEnglish: string;
  wordChinese: string;
  action: 'learn' | 'quiz_correct' | 'quiz_wrong';
  level: number;
}

let pendingEvents: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  let id = localStorage.getItem('wordwise_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('wordwise_session_id', id);
  }
  return id;
}

export function trackEvent(event: TrackEvent) {
  pendingEvents.push(event);

  // Batch events - flush every 3 seconds or when 10 events accumulated
  if (pendingEvents.length >= 10) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 3000);
  }
}

async function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (pendingEvents.length === 0 || !API_URL) return;

  const events = [...pendingEvents];
  pendingEvents = [];

  try {
    await fetch(`${API_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(),
        events,
      }),
    });
  } catch {
    // Silently fail - don't break the app if tracking is down
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushEvents);
}
