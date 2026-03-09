import React, { useState, useCallback } from 'react';
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

// Rounds: learn1 (full card) → learn2 (recall) → learn3 (quick flash) → quiz
type Round = 'learn1' | 'learn2' | 'learn3' | 'quiz';

const ROUND_LABELS: Record<Round, { emoji: string; label: string; description: string }> = {
  learn1: { emoji: '📖', label: '第一轮 · 认识单词', description: '仔细看每个单词的含义和例句' },
  learn2: { emoji: '🧠', label: '第二轮 · 回忆练习', description: '看英文，想中文，点击验证' },
  learn3: { emoji: '⚡', label: '第三轮 · 快速复习', description: '快速浏览，加深印象' },
  quiz: { emoji: '✍️', label: '测验', description: '检验你的学习成果' },
};

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
  // Current round and the shuffled word order for this round
  const [round, setRound] = useState<Round>('learn1');
  const [roundWords, setRoundWords] = useState<Word[]>(() => shuffle(words));
  const [currentIndex, setCurrentIndex] = useState(0);

  // Recall phase state
  const [revealed, setRevealed] = useState(false);

  // Quiz state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizOptions, setQuizOptions] = useState<string[]>(() => words.length > 0 ? generateOptions(words[0]) : []);

  // Track which words are done (passed quiz) and which need retry
  const [doneWords, setDoneWords] = useState<Set<string>>(new Set());
  const [retryWords, setRetryWords] = useState<Word[]>([]);
  const [retryRound, setRetryRound] = useState<Round>('learn1');
  const [results, setResults] = useState<{ wordId: string; firstTry: boolean }[]>([]);

  // Round transition splash
  const [showRoundSplash, setShowRoundSplash] = useState(true);
  const [showResults, setShowResults] = useState(false);

  const totalWords = words.length;
  const isRetrying = retryWords.length > 0 && round !== 'quiz';

  // Calculate overall progress
  const getOverallProgress = () => {
    const roundWeights: Record<Round, number> = { learn1: 0, learn2: 25, learn3: 50, quiz: 75 };
    const baseProgress = roundWeights[round] || 0;
    const roundProgress = roundWords.length > 0 ? (currentIndex / roundWords.length) * 25 : 0;
    const doneBonus = (doneWords.size / totalWords) * 25;
    return Math.min(100, baseProgress + roundProgress + doneBonus);
  };

  const startRound = useCallback(() => {
    setShowRoundSplash(false);
  }, []);

  const nextWord = useCallback(() => {
    setRevealed(false);
    setSelectedAnswer(null);

    if (currentIndex < roundWords.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (round === 'quiz') {
        setQuizOptions(generateOptions(roundWords[nextIdx]));
      }
    } else {
      // Round complete — move to next round
      if (round === 'learn1') {
        setRound('learn2');
        setRoundWords(shuffle(roundWords));
        setCurrentIndex(0);
        setShowRoundSplash(true);
      } else if (round === 'learn2') {
        setRound('learn3');
        setRoundWords(shuffle(roundWords));
        setCurrentIndex(0);
        setShowRoundSplash(true);
      } else if (round === 'learn3') {
        setRound('quiz');
        const quizOrder = shuffle(roundWords);
        setRoundWords(quizOrder);
        setCurrentIndex(0);
        setQuizOptions(generateOptions(quizOrder[0]));
        setShowRoundSplash(true);
      }
      // quiz round completion is handled in handleQuizAnswer
    }
  }, [currentIndex, roundWords, round]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    const w = roundWords[currentIndex];
    trackEvent({
      wordId: w.id, wordEnglish: w.english, wordChinese: w.chinese,
      action: 'learn', level: 0,
    });
  }, [roundWords, currentIndex]);

  const handleQuizAnswer = useCallback((answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);

    const word = roundWords[currentIndex];
    const correct = answer === word.chinese;
    const newProgress = updateWordProgress(progress, word.id, correct);
    onUpdateProgress(newProgress);

    trackEvent({
      wordId: word.id, wordEnglish: word.english, wordChinese: word.chinese,
      action: correct ? 'quiz_correct' : 'quiz_wrong',
      level: newProgress[word.id]?.level || 0,
    });

    setTimeout(() => {
      if (correct) {
        const newDone = new Set(doneWords);
        newDone.add(word.id);
        setDoneWords(newDone);
        setResults(prev => [...prev, { wordId: word.id, firstTry: !retryWords.some(w => w.id === word.id) }]);

        // Check if this was the last quiz word
        if (currentIndex >= roundWords.length - 1) {
          // Check if there are retry words accumulated
          const newRetry = [...retryWords.filter(w => w.id !== word.id)];
          if (newRetry.length > 0) {
            // Start retry cycle: learn the failed words again, then quiz
            setRetryWords(newRetry);
            setRound('learn2');
            setRoundWords(shuffle(newRetry));
            setCurrentIndex(0);
            setRetryRound('learn2');
            setShowRoundSplash(true);
          } else {
            setShowResults(true);
          }
        } else {
          const nextIdx = currentIndex + 1;
          setCurrentIndex(nextIdx);
          setQuizOptions(generateOptions(roundWords[nextIdx]));
        }
      } else {
        // Add to retry list
        setRetryWords(prev => {
          if (prev.some(w => w.id === word.id)) return prev;
          return [...prev, word];
        });

        // Move to next quiz word
        if (currentIndex >= roundWords.length - 1) {
          // End of quiz round, but there are retry words
          const currentRetry = retryWords.some(w => w.id === word.id) ? retryWords : [...retryWords, word];
          setRetryWords(currentRetry);
          setRound('learn2');
          setRoundWords(shuffle(currentRetry));
          setCurrentIndex(0);
          setRetryRound('learn2');
          setShowRoundSplash(true);
        } else {
          const nextIdx = currentIndex + 1;
          setCurrentIndex(nextIdx);
          setQuizOptions(generateOptions(roundWords[nextIdx]));
        }
      }
      setSelectedAnswer(null);
      setRevealed(false);
    }, 1200);
  }, [selectedAnswer, roundWords, currentIndex, progress, onUpdateProgress, doneWords, retryWords]);

  // Handle retry round transitions (learn2 → learn3 → quiz for retry words)
  const nextRetryWord = useCallback(() => {
    setRevealed(false);
    if (currentIndex < roundWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (retryRound === 'learn2') {
        setRetryRound('learn3');
        setRound('learn3');
        setRoundWords(shuffle(roundWords));
        setCurrentIndex(0);
        setShowRoundSplash(true);
      } else {
        // Back to quiz for retry words
        setRound('quiz');
        const quizOrder = shuffle(roundWords);
        setRoundWords(quizOrder);
        setCurrentIndex(0);
        setQuizOptions(generateOptions(quizOrder[0]));
        setShowRoundSplash(true);
      }
    }
  }, [currentIndex, roundWords, retryRound]);

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

  // Results screen
  if (showResults) {
    const firstTryCount = results.filter(r => r.firstTry).length;
    const percentage = Math.round((firstTryCount / totalWords) * 100);
    const getMessage = () => {
      if (percentage >= 90) return { title: '太棒了！🎉', sub: '一次就记住了大部分单词！' };
      if (percentage >= 70) return { title: '做得不错！👏', sub: '大部分单词都掌握了！' };
      if (percentage >= 50) return { title: '继续加油 💪', sub: '多复习几遍会更好！' };
      return { title: '全部通过！❤️', sub: '虽然有些需要多次尝试，但你坚持下来了！' };
    };
    const msg = getMessage();

    return (
      <motion.div className="quiz-view" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="quiz-results">
          <div className="results-circle">
            <div className="results-score">{totalWords}</div>
            <div className="results-label">全部掌握</div>
          </div>
          <div className="results-message">{msg.title}</div>
          <div className="results-submessage">{msg.sub}</div>
          <div className="results-stats">
            <div className="results-stat">
              <div className="results-stat-value green">{firstTryCount}</div>
              <div className="results-stat-label">一次通过</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value red">{totalWords - firstTryCount}</div>
              <div className="results-stat-label">多次尝试</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value purple">{totalWords}</div>
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

  // Round splash screen
  if (showRoundSplash) {
    const info = ROUND_LABELS[round];
    const isRetryRound = retryWords.length > 0 && round !== 'learn1';
    return (
      <motion.div
        className="learn-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}
      >
        <button className="back-btn" onClick={onBack} style={{ alignSelf: 'flex-start' }}>← 返回</button>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ marginTop: 40 }}
        >
          <div style={{ fontSize: 64, marginBottom: 20 }}>{info.emoji}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            {isRetryRound ? '🔄 重新学习' : info.label}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {isRetryRound
              ? `有 ${roundWords.length} 个单词需要再学一遍`
              : info.description
            }
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 32 }}>
            共 {roundWords.length} 个单词
            {doneWords.size > 0 && ` · 已掌握 ${doneWords.size}/${totalWords}`}
          </p>
          <button className="nav-btn primary" onClick={startRound} style={{ padding: '16px 48px' }}>
            开始 →
          </button>
        </motion.div>
      </motion.div>
    );
  }

  const word = roundWords[currentIndex];
  if (!word) return null;

  const difficultyLabel = word.difficulty === 1 ? '基础' : word.difficulty === 2 ? '进阶' : '高级';
  const difficultyClass = word.difficulty === 1 ? 'easy' : word.difficulty === 2 ? 'medium' : 'hard';
  const progressPercent = getOverallProgress();
  const info = ROUND_LABELS[round];
  const handleNext = (round === 'quiz') ? undefined : (retryWords.length > 0 && round !== 'learn1' ? nextRetryWord : nextWord);

  return (
    <div className="learn-view">
      <button className="back-btn" onClick={onBack}>← 返回</button>

      <div className="progress-bar-container">
        <div className="progress-bar-header">
          <span>{info.emoji} {info.label} · {currentIndex + 1}/{roundWords.length}</span>
          <span>{doneWords.size}/{totalWords} 已掌握</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${word.id}-${round}-${currentIndex}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.25 }}
        >
          {/* LEARN ROUND 1: Full card */}
          {round === 'learn1' && (
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
              <button className="nav-btn primary" onClick={handleNext} style={{ width: '100%' }}>
                {currentIndex < roundWords.length - 1 ? '下一个 →' : '进入第二轮 →'}
              </button>
            </>
          )}

          {/* LEARN ROUND 2: Recall - show English, tap to reveal Chinese */}
          {round === 'learn2' && (
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
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
                  onClick={handleNext}
                  style={{ width: '100%' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {currentIndex < roundWords.length - 1 ? '下一个 →' : '进入第三轮 →'}
                </motion.button>
              )}
            </>
          )}

          {/* LEARN ROUND 3: Quick flash - show word briefly, tap to see meaning, then next */}
          {round === 'learn3' && (
            <>
              <div className="word-card" style={{ padding: '24px' }}>
                <span className={`difficulty-badge ${difficultyClass}`}>{difficultyLabel}</span>
                <div className="word-english" style={{ marginBottom: 12 }}>{word.english}</div>

                {!revealed ? (
                  <motion.button
                    onClick={handleReveal}
                    style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: 'white',
                      border: 'none',
                      padding: '12px 32px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    想到了？点击验证 👀
                  </motion.button>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="word-phonetic">{word.phonetic}</div>
                    <div className="word-chinese">{word.chinese}</div>
                  </motion.div>
                )}
              </div>

              {revealed && (
                <motion.button
                  className="nav-btn primary"
                  onClick={handleNext}
                  style={{ width: '100%' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {currentIndex < roundWords.length - 1 ? '下一个 →' : '开始测验 ✍️'}
                </motion.button>
              )}
            </>
          )}

          {/* QUIZ ROUND */}
          {round === 'quiz' && (
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
                      key={`${word.id}-${i}`}
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
                    ? '✅ 正确！'
                    : (
                      <>
                        ❌ 答错了，我们会再学一遍
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
