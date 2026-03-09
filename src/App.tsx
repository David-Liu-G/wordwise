import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { AppView, Word, WordProgress } from './types';
import { loadProgress, saveProgress, getDailyWords, saveDailyWords } from './utils/storage';
import { selectDailyWords, getWordsForReview } from './utils/spaced-repetition';
import { wordBank } from './data/words';
import { trackPageView } from './utils/tracker';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { StudyView } from './components/StudyView';
import { QuizView } from './components/QuizView';
import { StatsView } from './components/StatsView';

function App() {
  const [view, setView] = useState<AppView>('home');
  const [progress, setProgress] = useState<Record<string, WordProgress>>(() => loadProgress());
  const [dailyWords, setDailyWords] = useState<Word[]>([]);

  useEffect(() => {
    trackPageView();

    // Load or generate daily words
    const saved = getDailyWords();
    if (saved) {
      const words = saved
        .map(id => wordBank.find(w => w.id === id))
        .filter((w): w is Word => w !== undefined);
      setDailyWords(words);
    } else {
      const words = selectDailyWords(progress);
      setDailyWords(words);
      saveDailyWords(words.map(w => w.id));
    }

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem('wordwise_last_visit');
    const streak = parseInt(localStorage.getItem('wordwise_streak') || '0');

    if (lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastVisit === yesterday) {
        localStorage.setItem('wordwise_streak', String(streak + 1));
      } else if (lastVisit !== today) {
        localStorage.setItem('wordwise_streak', '1');
      }
      localStorage.setItem('wordwise_last_visit', today);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const handleUpdateProgress = useCallback((newProgress: Record<string, WordProgress>) => {
    setProgress(newProgress);
  }, []);

  const reviewWords = useMemo(() => getWordsForReview(progress), [progress]);

  return (
    <div className="app">
      <Header view={view} onNavigate={setView} />

      {view === 'home' && (
        <HomeView
          progress={progress}
          onNavigate={setView}
          reviewCount={reviewWords.length}
        />
      )}

      {view === 'study' && (
        <StudyView
          words={dailyWords}
          progress={progress}
          onUpdateProgress={handleUpdateProgress}
          onBack={() => setView('home')}
        />
      )}

      {view === 'review' && (
        <StudyView
          words={reviewWords.slice(0, 10)}
          progress={progress}
          onUpdateProgress={handleUpdateProgress}
          onBack={() => setView('home')}
        />
      )}

      {view === 'stats' && (
        <StatsView
          progress={progress}
          onBack={() => setView('home')}
        />
      )}
    </div>
  );
}

export default App;
