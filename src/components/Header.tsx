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
            <div className="">
              <LogoIcon className="h-14 w-auto" />
            </div>
            {/* Removed Professional BOQ Generator text */}
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