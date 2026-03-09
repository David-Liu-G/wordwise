export interface Word {
  id: string;
  english: string;
  chinese: string;
  phonetic: string;
  partOfSpeech: string;
  exampleEn: string;
  exampleCn: string;
  difficulty: 1 | 2 | 3;
}

export interface WordProgress {
  wordId: string;
  level: number; // 0=new, 1=learning, 2=familiar, 3=mastered
  correctCount: number;
  wrongCount: number;
  lastReviewedAt: number;
  nextReviewAt: number;
}

export type QuizType = 'en-to-cn' | 'cn-to-en' | 'spelling';

export interface QuizQuestion {
  word: Word;
  type: QuizType;
  options?: string[];
  correctAnswer: string;
}

export type AppView = 'home' | 'learn' | 'quiz' | 'review' | 'stats';
