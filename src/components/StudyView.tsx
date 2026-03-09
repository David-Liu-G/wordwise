import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Word, WordProgress } from '../types';
import { updateWordProgress } from '../utils/spaced-repetition';
import { trackEvent } from '../utils/tracker';
import { wordBank } from '../data/words';

interface StudyViewProps {
  words: Word[];
  progress: Record<string, WordProgress>;
  onUpdateProgress: (progress: Record<string, WordProgress>) => void;
  onBack: () => void;
}

type Phase = 'intro' | 'recall' | 'quiz';

interface WordState {
  word: Word;
  phase: Phase;
  attempts: number;
  done: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateOptions(word: Word): string[] {
  const wrong = shuffle(wordBank.filter(w => w.id !== word.id))
    .slice(0, 3)
    .map(w => w.chinese);
  return shuffle([word.chinese, ...wrong]);
}

export const StudyView: React.FC<StudyViewProps> = ({ words, progress, onUpdateProgress, onBack }) => {
  const [wordStates, setWordStates] = useState<WordState[]>(() =>
    words.map(w => ({ word: w, phase: 'intro' as Phase, attempts: 0, done: false }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ word: Word; correct: boolean; attempts: number }[]>([]);

  const activeStates = useMemo(() => wordStates.filter(ws => !ws.done), [wordStates]);
  const doneCount = wordStates.filter(ws => ws.done).length;
  const totalCount = wordStates.length;

  const current = activeStates[currentIndex];

  const goToNextWord = useCallback(() => {
    setRevealed(false);
    setSelectedAnswer(null);

    const remaining = wordStates.filter(ws => !ws.done);
    if (remaining.length === 0) {
      setShowResults(true);
      return;
    }

    // Move to next word in active list
    const nextActive = remaining.length;
    if (nextActive <= 1 && remaining[0]?.done !== false) {
      setShowResults(true);
      return;
    }

    setCurrentIndex(prev => {
      const newActive = wordStates.filter(ws => !ws.done);
      if (newActive.length === 0) return 0;
      return prev >= newActive.length ? 0 : prev;
    });
  }, [wordStates]);

  const advancePhase = useCallback(() => {
    if (!current) return;
    const wordId = current.word.id;

    setWordStates(prev => {
      const updated = prev.map(ws => {
        if (ws.word.id !== wordId) return ws;
        if (ws.phase === 'intro') {
          return { ...ws, phase: 'recall' as Phase };
        }
        if (ws.phase === 'recall') {
          return { ...ws, phase: 'quiz' as Phase };
        }
        return ws;
      });
      return updated;
    });

    setRevealed(false);
    setSelectedAnswer(null);

    // Pre-generate quiz options when moving to quiz phase
    if (current.phase === 'recall') {
      setQuizOptions(generateOptions(current.word));
    }
  }, [current]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    trackEvent({
      wordId: current.word.id,
      wordEnglish: current.word.english,
      wordChinese: current.word.chinese,
      action: 'learn',
      level: 0,
    });
  }, [current]);

  const handleQuizAnswer = useCallback((answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);

    const correct = answer === current.word.chinese;
    const newProgress = updateWordProgress(progress, current.word.id, correct);
    onUpdateProgress(newProgress);

    trackEvent({
      wordId: current.word.id,
      wordEnglish: current.word.english,
      wordChinese: current.word.chinese,
      action: correct ? 'quiz_correct' : 'quiz_wrong',
      level: newProgress[current.word.id]?.level || 0,
    });

    setTimeout(() => {
      if (correct) {
        // Mark word as done
        setResults(prev => [...prev, { word: current.word, correct: true, attempts: current.attempts + 1 }]);
        setWordStates(prev => {
          const updated = prev.map(ws =>
            ws.word.id === current.word.id ? { ...ws, done: true } : ws
          );
          const remaining = updated.filter(ws => !ws.done);
          if (remaining.length === 0) {
            setShowResults(true);
            return updated;
          }
          setCurrentIndex(i => i >= remaining.length ? 0 : i);
          setSelectedAnswer(null);
          setRevealed(false);
          return updated;
        });
      } else {
        // Reset to intro, increase attempts, move to end of queue
        setWordStates(prev => {
          const updated = prev.map(ws =>
            ws.word.id === current.word.id
              ? { ...ws, phase: 'intro' as Phase, attempts: ws.attempts + 1 }
              : ws
          );
          // Move this word to the end of the active list by reordering
          const failedWord = updated.find(ws => ws.word.id === current.word.id)!;
          const others = updated.filter(ws => ws.word.id !== current.word.id);
          const reordered = [...others, failedWord];

          const remaining = reordered.filter(ws => !ws.done);
          setCurrentIndex(i => i >= remaining.length ? 0 : i);
          setSelectedAnswer(null);
          setRevealed(false);
          return reordered;
        });
      }
    }, 1200);
  }, [selectedAnswer, current, progress, onUpdateProgress]);

  if (words.length === 0) {
    return (
      <div className="learn-view">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <h3>今天的单词都学完了！</h3>
          <p>明天再来学习新单词吧</p>
          <button className="nav-btn primary" onClick={onBack}>返回首页</button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const correctFirst = results.filter(r => r.attempts === 1).length;
    const percentage = Math.round((correctFirst / totalCount) * 100);
    const getMessage = () => {
      if (percentage >= 90) return { title: '太棒了！🎉', sub: '一次就记住了大部分单词！' };
      if (percentage >= 70) return { title: '做得不错！👏', sub: '大部分单词都掌握了！' };
      if (percentage >= 50) return { title: '继续加油 💪', sub: '多复习几遍会更好！' };
      return { title: '不要气馁 ❤️', sub: '坚持就是胜利！' };
    };
    const msg = getMessage();

    return (
      <motion.div
        className="quiz-view"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="quiz-results">
          <div className="results-circle">
            <div className="results-score">{doneCount}</div>
            <div className="results-label">单词已掌握</div>
          </div>
          <div className="results-message">{msg.title}</div>
          <div className="results-submessage">{msg.sub}</div>
          <div className="results-stats">
            <div className="results-stat">
              <div className="results-stat-value green">{correctFirst}</div>
              <div className="results-stat-label">一次通过</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value red">{totalCount - correctFirst}</div>
              <div className="results-stat-label">多次尝试</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value purple">{totalCount}</div>
              <div className="results-stat-label">总单词数</div>
            </div>
          </div>
          <button className="nav-btn primary" onClick={onBack} style={{ width: '100%' }}>
            返回首页
          </button>
        </div>
        {percentage >= 80 && <Confetti />}
      </motion.div>
    );
  }

  if (!current) return null;

  const progressPercent = (doneCount / totalCount) * 100;
  const { word, phase } = current;
  const difficultyLabel = word.difficulty === 1 ? '基础' : word.difficulty === 2 ? '进阶' : '高级';
  const difficultyClass = word.difficulty === 1 ? 'easy' : word.difficulty === 2 ? 'medium' : 'hard';

  const phaseLabel = phase === 'intro' ? '学习' : phase === 'recall' ? '回忆' : '测验';
  const phaseEmoji = phase === 'intro' ? '📖' : phase === 'recall' ? '🧠' : '✍️';

  return (
    <div className="learn-view">
      <button className="back-btn" onClick={onBack}>← 返回</button>

      <div className="progress-bar-container">
        <div className="progress-bar-header">
          <span>{phaseEmoji} {phaseLabel} · 第 {doneCount + 1}/{totalCount} 个单词</span>
          <span>{doneCount} 已完成</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {current.attempts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255, 107, 107, 0.08)',
            color: 'var(--accent)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          🔄 再来一次！上次答错了，重新学习这个单词
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${word.id}-${phase}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          {/* INTRO PHASE */}
          {phase === 'intro' && (
            <>
              <div className="word-card">
                <span className={`difficulty-badge ${difficultyClass}`}>{difficultyLabel}</span>
                <div className="word-english">{word.english}</div>
                <div className="word-phonetic">{word.phonetic}</div>
                <div className="word-pos">{word.partOfSpeech}</div>
                <div className="word-chinese">{word.chinese}</div>
                <div className="word-example">
                  <div className="word-example-en">📝 {word.exampleEn}</div>
                  <div className="word-example-cn">{word.exampleCn}</div>
                </div>
              </div>
              <button className="nav-btn primary" onClick={advancePhase} style={{ width: '100%' }}>
                记住了，下一步 →
              </button>
            </>
          )}

          {/* RECALL PHASE */}
          {phase === 'recall' && (
            <>
              <div className="word-card">
                <span className={`difficulty-badge ${difficultyClass}`}>{difficultyLabel}</span>
                <div className="word-english">{word.english}</div>
                <div className="word-phonetic">{word.phonetic}</div>
                <div className="word-pos">{word.partOfSpeech}</div>

                {!revealed ? (
                  <motion.div
                    style={{
                      padding: '24px',
                      margin: '16px 0',
                      background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.06), rgba(162, 155, 254, 0.06))',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleReveal}
                  >
                    <div style={{ fontSize: 16, color: 'var(--primary)', fontWeight: 600 }}>
                      🤔 想一想这个词的意思...
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 6 }}>
                      点击查看答案
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="word-chinese">{word.chinese}</div>
                    <div className="word-example">
                      <div className="word-example-en">📝 {word.exampleEn}</div>
                      <div className="word-example-cn">{word.exampleCn}</div>
                    </div>
                  </motion.div>
                )}
              </div>

              {revealed && (
                <motion.button
                  className="nav-btn primary"
                  onClick={advancePhase}
                  style={{ width: '100%' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  准备好了，开始测验 ✍️
                </motion.button>
              )}
            </>
          )}

          {/* QUIZ PHASE */}
          {phase === 'quiz' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div className="quiz-question-label">选择正确的中文释义</div>
                <div className="quiz-prompt">{word.english}</div>
                <div className="quiz-hint">{word.phonetic}</div>
              </div>

              <div className="quiz-options">
                {quizOptions.map((option, i) => {
                  let className = 'quiz-option';
                  if (selectedAnswer) {
                    if (option === word.chinese) className += ' correct';
                    else if (option === selectedAnswer) className += ' wrong';
                  }
                  return (
                    <motion.button
                      key={i}
                      className={className}
                      onClick={() => handleQuizAnswer(option)}
                      disabled={selectedAnswer !== null}
                      whileTap={{ scale: selectedAnswer ? 1 : 0.98 }}
                    >
                      {option}
                    </motion.button>
                  );
                })}
              </div>

              {selectedAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`quiz-feedback ${selectedAnswer === word.chinese ? 'correct' : 'wrong'}`}
                >
                  {selectedAnswer === word.chinese
                    ? '✅ 正确！这个单词你已经掌握了！'
                    : (
                      <>
                        ❌ 答错了，别担心，我们会再学一次
                        <div className="correct-answer">正确答案：{word.chinese}</div>
                      </>
                    )
                  }
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const Confetti: React.FC = () => {
  const colors = ['#6C5CE7', '#FF6B6B', '#00B894', '#FDCB6E', '#A29BFE', '#FF8E8E'];
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 6 + Math.random() * 8,
  }));

  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </>
  );
};
