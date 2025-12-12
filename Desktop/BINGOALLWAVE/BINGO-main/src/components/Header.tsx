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
    <header className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-40 no-print theme-transition">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-600 to-green-700 shadow-lg">
              <LogoIcon className="h-7 w-auto text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight theme-transition">
                BINGO
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">AI-Powered AV Estimator</p>
            </div>
            <div className="hidden md:block h-6 w-px bg-slate-300 dark:bg-slate-700 mx-3 theme-transition"></div>
            <p className="text-sm text-slate-600 dark:text-slate-400 hidden md:block font-medium theme-transition">Professional BOQ Generator</p>
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