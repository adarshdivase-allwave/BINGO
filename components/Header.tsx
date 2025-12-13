import React from 'react';
import { Theme } from '../types';
import ThemeSwitcher from './ThemeSwitcher';
import LogoIcon from './icons/LogoIcon';

interface HeaderProps {
  theme: Theme;
  onThemeToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, onThemeToggle }) => {
  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-8 w-auto" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              BINGO
            </h1>
            <div className="hidden md:block h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">AI-Powered AV Estimator</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher theme={theme} onToggle={onThemeToggle} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;