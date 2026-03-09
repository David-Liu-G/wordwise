import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Word } from '../types';

interface LearnViewProps {
  words: Word[];
  onBack: () => void;
  onComplete: () => void;
}

export const LearnView: React.FC<LearnViewProps> = ({ words, onBack, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  if (words.length === 0) {
    return (
      <div className="learn-view">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <h3>今天的单词都学完了！</h3>
          <p>去测验检验一下吧</p>
          <button className="nav-btn primary" onClick={onBack}>返回首页</button>
        </div>
      </div>
    );
  }

  const word = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;
  const difficultyLabel = word.difficulty === 1 ? '基础' : word.difficulty === 2 ? '进阶' : '高级';
  const difficultyClass = word.difficulty === 1 ? 'easy' : word.difficulty === 2 ? 'medium' : 'hard';

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className="learn-view">
      <button className="back-btn" onClick={onBack}>← 返回</button>

      <div className="progress-bar-container">
        <div className="progress-bar-header">
          <span>学习进度</span>
          <span>{currentIndex + 1} / {words.length}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3 }}
          className="word-card"
        >
          <span className={`difficulty-badge ${difficultyClass}`}>{difficultyLabel}</span>
          <div className="word-english">{word.english}</div>
          <div className="word-phonetic">{word.phonetic}</div>
          <div className="word-pos">{word.partOfSpeech}</div>
          <div className="word-chinese">{word.chinese}</div>
          <div className="word-example">
            <div className="word-example-en">📝 {word.exampleEn}</div>
            <div className="word-example-cn">{word.exampleCn}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="nav-buttons">
        <button
          className="nav-btn secondary"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          ← 上一个
        </button>
        <button className="nav-btn primary" onClick={goNext}>
          {currentIndex === words.length - 1 ? '完成学习 🎉' : '下一个 →'}
        </button>
      </div>
    </div>
  );
};
