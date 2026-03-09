import React from 'react';
import { motion } from 'framer-motion';
import { WordProgress } from '../types';
import { getStats } from '../utils/spaced-repetition';
import { wordBank } from '../data/words';

interface StatsViewProps {
  progress: Record<string, WordProgress>;
  onBack: () => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ progress, onBack }) => {
  const stats = getStats(progress);
  const entries = Object.values(progress);
  const newCount = stats.totalWords - stats.totalLearned;
  const masteredPercent = stats.totalWords > 0 ? (stats.mastered / stats.totalWords) * 100 : 0;
  const learningPercent = stats.totalWords > 0 ? (stats.learning / stats.totalWords) * 100 : 0;


  const conicGradient = `conic-gradient(
    var(--success) 0% ${masteredPercent}%,
    var(--primary) ${masteredPercent}% ${masteredPercent + learningPercent}%,
    var(--border) ${masteredPercent + learningPercent}% 100%
  )`;

  // Get recently learned words
  const recentWords = entries
    .sort((a, b) => b.lastReviewedAt - a.lastReviewedAt)
    .slice(0, 10);

  const getLevelText = (level: number) => {
    switch (level) {
      case 0: return { text: '新词', cls: 'new' };
      case 1: return { text: '学习中', cls: 'learning' };
      case 2: return { text: '熟悉', cls: 'familiar' };
      case 3: return { text: '已掌握', cls: 'mastered' };
      default: return { text: '新词', cls: 'new' };
    }
  };

  return (
    <motion.div
      className="stats-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <button className="back-btn" onClick={onBack}>← 返回</button>
      <h2>学习统计 📊</h2>

      <div className="stats-overview">
        <div className="stat-card purple">
          <div className="stat-value">{stats.totalLearned}</div>
          <div className="stat-label">已学单词</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats.mastered}</div>
          <div className="stat-label">已掌握</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{stats.accuracy}%</div>
          <div className="stat-label">正确率</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-value">{stats.learning}</div>
          <div className="stat-label">学习中</div>
        </div>
      </div>

      <div className="chart-card">
        <h3>掌握程度</h3>
        <div className="pie-chart">
          <div className="pie-visual" style={{ background: conicGradient }}>
            <div className="pie-center">{stats.totalWords}</div>
          </div>
          <div className="pie-legend">
            <div className="pie-legend-item">
              <div className="pie-legend-dot" style={{ background: 'var(--success)' }} />
              <span>已掌握 {stats.mastered}</span>
            </div>
            <div className="pie-legend-item">
              <div className="pie-legend-dot" style={{ background: 'var(--primary)' }} />
              <span>学习中 {stats.learning}</span>
            </div>
            <div className="pie-legend-item">
              <div className="pie-legend-dot" style={{ background: 'var(--border)' }} />
              <span>未学习 {newCount}</span>
            </div>
          </div>
        </div>
      </div>

      {recentWords.length > 0 && (
        <div className="word-list-card">
          <h3>最近学习的单词</h3>
          {recentWords.map(wp => {
            const word = wordBank.find(w => w.id === wp.wordId);
            if (!word) return null;
            const level = getLevelText(wp.level);
            return (
              <div key={wp.wordId} className="word-list-item">
                <div className="word-info">
                  <span className="word-en">{word.english}</span>
                  <span className="word-cn">{word.chinese}</span>
                </div>
                <span className={`level-badge ${level.cls}`}>{level.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
