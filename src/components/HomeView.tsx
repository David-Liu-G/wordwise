import React from 'react';
import { motion } from 'framer-motion';
import { AppView } from '../types';
import { getStats } from '../utils/spaced-repetition';
import { WordProgress } from '../types';

interface HomeViewProps {
  progress: Record<string, WordProgress>;
  onNavigate: (view: AppView) => void;
  reviewCount: number;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export const HomeView: React.FC<HomeViewProps> = ({ progress, onNavigate, reviewCount }) => {
  const stats = getStats(progress);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好 ☀️';
    if (hour < 18) return '下午好 🌤';
    return '晚上好 🌙';
  };

  return (
    <motion.div className="home" variants={container} initial="hidden" animate="show">
      <motion.div className="greeting" variants={item}>
        <h1>{getGreeting()}</h1>
        <p>今天也要加油背单词哦！</p>
      </motion.div>

      <motion.div className="stats-cards" variants={item}>
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
          <div className="stat-value">{stats.totalWords - stats.totalLearned}</div>
          <div className="stat-label">待学习</div>
        </div>
      </motion.div>

      <motion.div className="action-cards" variants={container}>
        <motion.button className="action-card" variants={item} onClick={() => onNavigate('learn')}>
          <div className="action-icon learn">📖</div>
          <div className="action-content">
            <h3>今日学习</h3>
            <p>学习今天的新单词</p>
          </div>
          <span className="action-arrow">→</span>
        </motion.button>

        <motion.button className="action-card" variants={item} onClick={() => onNavigate('quiz')}>
          <div className="action-icon quiz">✍️</div>
          <div className="action-content">
            <h3>单词测验</h3>
            <p>检验你的学习成果</p>
          </div>
          <span className="action-arrow">→</span>
        </motion.button>

        <motion.button className="action-card" variants={item} onClick={() => onNavigate('review')}>
          <div className="action-icon review">🔄</div>
          <div className="action-content">
            <h3>复习巩固</h3>
            <p>{reviewCount > 0 ? `${reviewCount} 个单词需要复习` : '暂无待复习单词'}</p>
          </div>
          <span className="action-arrow">→</span>
        </motion.button>

        <motion.button className="action-card" variants={item} onClick={() => onNavigate('stats')}>
          <div className="action-icon stats">📊</div>
          <div className="action-content">
            <h3>学习统计</h3>
            <p>查看你的学习进度</p>
          </div>
          <span className="action-arrow">→</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
