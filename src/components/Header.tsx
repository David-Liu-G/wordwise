import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
}

const APP_VERSION = process.env.REACT_APP_VERSION || require('../../package.json').version;

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
        <span style={{ fontSize: 11, color: '#B2BEC3', fontWeight: 500, marginLeft: 4, alignSelf: 'flex-end' }}>v{APP_VERSION}</span>
      </div>
      <div className="header-streak">
        🔥 {localStorage.getItem('wordwise_streak') || '0'} 天
      </div>
    </header>
  );
};
