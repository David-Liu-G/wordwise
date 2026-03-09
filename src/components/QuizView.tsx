import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Word, QuizQuestion, WordProgress } from '../types';
import { generateQuiz, updateWordProgress } from '../utils/spaced-repetition';

interface QuizViewProps {
  words: Word[];
  progress: Record<string, WordProgress>;
  onUpdateProgress: (progress: Record<string, WordProgress>) => void;
  onBack: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ words, progress, onUpdateProgress, onBack }) => {
  const [questions] = useState<QuizQuestion[]>(() => generateQuiz(words));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [spellingSubmitted, setSpellingSubmitted] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = useCallback((answer: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    const correct = answer === questions[currentIndex].correctAnswer;
    setResults(prev => [...prev, correct]);
    const newProgress = updateWordProgress(progress, questions[currentIndex].word.id, correct);
    onUpdateProgress(newProgress);
  }, [selectedAnswer, currentIndex, questions, progress, onUpdateProgress]);

  const handleSpellingSubmit = useCallback(() => {
    if (spellingSubmitted) return;
    setSpellingSubmitted(true);
    const correct = spellingInput.trim().toLowerCase() === questions[currentIndex].correctAnswer.toLowerCase();
    setResults(prev => [...prev, correct]);
    const newProgress = updateWordProgress(progress, questions[currentIndex].word.id, correct);
    onUpdateProgress(newProgress);
  }, [spellingSubmitted, spellingInput, currentIndex, questions, progress, onUpdateProgress]);

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setSpellingInput('');
      setSpellingSubmitted(false);
    } else {
      setShowResults(true);
    }
  };

  if (words.length === 0) {
    return (
      <div className="quiz-view">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>还没有可以测验的单词</h3>
          <p>先去学习一些新单词吧！</p>
          <button className="nav-btn primary" onClick={onBack}>返回首页</button>
        </div>
      </div>
    );
  }

  if (showResults) {
    const correctCount = results.filter(Boolean).length;
    const wrongCount = results.length - correctCount;
    const percentage = Math.round((correctCount / results.length) * 100);
    const getMessage = () => {
      if (percentage >= 90) return { title: '太棒了！🎉', sub: '你已经掌握了这些单词！' };
      if (percentage >= 70) return { title: '做得不错！👏', sub: '继续加油，你可以更好！' };
      if (percentage >= 50) return { title: '还需努力 💪', sub: '多复习几遍就会好的！' };
      return { title: '不要气馁 ❤️', sub: '学习是一个过程，继续坚持！' };
    };
    const msg = getMessage();

    return (
      <motion.div
        className="quiz-view"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="quiz-results">
          <div className="results-circle">
            <div className="results-score">{percentage}%</div>
            <div className="results-label">正确率</div>
          </div>
          <div className="results-message">{msg.title}</div>
          <div className="results-submessage">{msg.sub}</div>
          <div className="results-stats">
            <div className="results-stat">
              <div className="results-stat-value green">{correctCount}</div>
              <div className="results-stat-label">正确</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value red">{wrongCount}</div>
              <div className="results-stat-label">错误</div>
            </div>
            <div className="results-stat">
              <div className="results-stat-value purple">{results.length}</div>
              <div className="results-stat-label">总题数</div>
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

  const question = questions[currentIndex];
  const answered = selectedAnswer !== null || spellingSubmitted;
  const isCorrect = answered && (
    question.type === 'spelling'
      ? spellingInput.trim().toLowerCase() === question.correctAnswer.toLowerCase()
      : selectedAnswer === question.correctAnswer
  );
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="quiz-view">
      <button className="back-btn" onClick={onBack}>← 返回</button>

      <div className="progress-bar-container">
        <div className="progress-bar-header">
          <span>测验进度</span>
          <span>{currentIndex + 1} / {questions.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="quiz-question-label">
            {question.type === 'en-to-cn' && '选择正确的中文释义'}
            {question.type === 'cn-to-en' && '选择正确的英文单词'}
            {question.type === 'spelling' && '根据中文拼写英文单词'}
          </div>

          <div className="quiz-prompt">
            {question.type === 'en-to-cn' && question.word.english}
            {question.type === 'cn-to-en' && question.word.chinese}
            {question.type === 'spelling' && question.word.chinese}
          </div>

          {question.type !== 'spelling' && (
            <div className="quiz-hint">
              {question.type === 'en-to-cn' && question.word.phonetic}
              {question.type === 'cn-to-en' && question.word.phonetic}
            </div>
          )}

          {question.type === 'spelling' ? (
            <>
              <div className="quiz-hint">{question.word.phonetic}</div>
              <input
                className={`spelling-input ${spellingSubmitted ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                type="text"
                value={spellingInput}
                onChange={e => setSpellingInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !spellingSubmitted && handleSpellingSubmit()}
                placeholder="输入英文单词..."
                disabled={spellingSubmitted}
                autoFocus
              />
              {!spellingSubmitted && (
                <button
                  className="nav-btn primary"
                  onClick={handleSpellingSubmit}
                  style={{ width: '100%', marginBottom: 12 }}
                  disabled={!spellingInput.trim()}
                >
                  提交答案
                </button>
              )}
            </>
          ) : (
            <div className="quiz-options">
              {question.options?.map((option, i) => {
                let className = 'quiz-option';
                if (answered) {
                  if (option === question.correctAnswer) className += ' correct';
                  else if (option === selectedAnswer) className += ' wrong';
                }
                return (
                  <motion.button
                    key={i}
                    className={className}
                    onClick={() => handleAnswer(option)}
                    disabled={answered}
                    whileTap={{ scale: answered ? 1 : 0.98 }}
                  >
                    {option}
                  </motion.button>
                );
              })}
            </div>
          )}

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
                {isCorrect ? '✅ 回答正确！' : '❌ 回答错误'}
                {!isCorrect && (
                  <div className="correct-answer">
                    正确答案：{question.correctAnswer}
                  </div>
                )}
              </div>
              <button className="nav-btn primary" onClick={nextQuestion} style={{ width: '100%' }}>
                {currentIndex === questions.length - 1 ? '查看结果' : '下一题 →'}
              </button>
            </motion.div>
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
