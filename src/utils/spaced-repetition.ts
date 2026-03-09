import { Word, WordProgress, QuizQuestion, QuizType } from '../types';
import { wordBank } from '../data/words';

const DAILY_NEW_WORDS = 15;

const INTERVALS = [
  0,           // level 0: immediate
  4 * 3600000, // level 1: 4 hours
  86400000,    // level 2: 1 day
  3 * 86400000 // level 3: 3 days
];

export function selectDailyWords(progress: Record<string, WordProgress>): Word[] {
  // Get words due for review
  const now = Date.now();
  const dueForReview = wordBank.filter(w => {
    const p = progress[w.id];
    return p && p.level < 3 && p.nextReviewAt <= now;
  });

  // Get new words (never seen)
  const newWords = wordBank.filter(w => !progress[w.id]);

  // Mix: prioritize review words, then fill with new words
  const selected: Word[] = [...dueForReview.slice(0, DAILY_NEW_WORDS)];
  const remaining = DAILY_NEW_WORDS - selected.length;
  if (remaining > 0) {
    selected.push(...newWords.slice(0, remaining));
  }

  return selected;
}

export function getWordsForReview(progress: Record<string, WordProgress>): Word[] {
  const now = Date.now();
  return wordBank.filter(w => {
    const p = progress[w.id];
    return p && p.nextReviewAt <= now && p.level > 0;
  });
}

export function updateWordProgress(
  progress: Record<string, WordProgress>,
  wordId: string,
  correct: boolean
): Record<string, WordProgress> {
  const now = Date.now();
  const existing = progress[wordId];
  const current = existing || {
    wordId,
    level: 0,
    correctCount: 0,
    wrongCount: 0,
    lastReviewedAt: now,
    nextReviewAt: now,
  };

  let newLevel = current.level;
  if (correct) {
    newLevel = Math.min(3, current.level + 1);
  } else {
    newLevel = Math.max(0, current.level - 1);
  }

  return {
    ...progress,
    [wordId]: {
      ...current,
      level: newLevel,
      correctCount: current.correctCount + (correct ? 1 : 0),
      wrongCount: current.wrongCount + (correct ? 0 : 1),
      lastReviewedAt: now,
      nextReviewAt: now + INTERVALS[newLevel],
    },
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateQuiz(words: Word[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  for (const word of words) {
    const types: QuizType[] = ['en-to-cn', 'cn-to-en', 'spelling'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'en-to-cn') {
      const wrongOptions = shuffle(wordBank.filter(w => w.id !== word.id))
        .slice(0, 3)
        .map(w => w.chinese);
      const options = shuffle([word.chinese, ...wrongOptions]);
      questions.push({ word, type, options, correctAnswer: word.chinese });
    } else if (type === 'cn-to-en') {
      const wrongOptions = shuffle(wordBank.filter(w => w.id !== word.id))
        .slice(0, 3)
        .map(w => w.english);
      const options = shuffle([word.english, ...wrongOptions]);
      questions.push({ word, type, options, correctAnswer: word.english });
    } else {
      questions.push({ word, type, correctAnswer: word.english });
    }
  }

  return shuffle(questions);
}

export function getStats(progress: Record<string, WordProgress>) {
  const entries = Object.values(progress);
  const totalLearned = entries.length;
  const mastered = entries.filter(e => e.level >= 3).length;
  const learning = entries.filter(e => e.level > 0 && e.level < 3).length;
  const totalCorrect = entries.reduce((a, e) => a + e.correctCount, 0);
  const totalWrong = entries.reduce((a, e) => a + e.wrongCount, 0);
  const accuracy = totalCorrect + totalWrong > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  return { totalLearned, mastered, learning, accuracy, totalWords: wordBank.length };
}
