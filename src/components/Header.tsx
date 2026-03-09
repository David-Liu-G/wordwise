import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({ view, onNavigate }) => {
  return (
    <header className="header">
      <div
        className="header-logo"
        onClick={() => onNavigate('home')}
        style={{ cursor: 'pointer' }}
      >
        <div className="header-logo-icon">W</div>
        <span className="header-logo-text">WordWise</span>
      </div>
      <div className="header-streak">
        🔥 {localStorage.getItem('wordwise_streak') || '0'} 天
      </div>
    </header>
  );
};
