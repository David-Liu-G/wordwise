import { WordProgress } from '../types';

const PROGRESS_KEY = 'wordwise_progress';
const DAILY_KEY = 'wordwise_daily';

export function loadProgress(): Record<string, WordProgress> {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: Record<string, WordProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDailyWords(): string[] | null {
  try {
    const data = localStorage.getItem(DAILY_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.date === getTodayKey()) {
      return parsed.wordIds;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDailyWords(wordIds: string[]) {
  localStorage.setItem(DAILY_KEY, JSON.stringify({
    date: getTodayKey(),
    wordIds,
  }));
}
