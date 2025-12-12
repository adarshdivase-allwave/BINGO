import React, { useEffect, useState } from 'react';
import { Toast as ToastType } from '../types';
import CheckCircleIcon from './icons/CheckCircleIcon';
import WarningIcon from './icons/WarningIcon';

interface ToastProps {
  toast: ToastType | null;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === 'success';
  const baseClasses = `fixed bottom-5 right-5 w-full max-w-sm p-4 rounded-lg shadow-xl flex items-center gap-3 z-50 toast-${isVisible ? 'enter' : 'exit'}`;
  const typeClasses = isSuccess 
    ? 'bg-gradient-to-r from-green-600 to-green-700 border border-green-500 text-white dark:from-green-800 dark:to-green-900 dark:border-green-600' 
    : 'bg-gradient-to-r from-red-600 to-red-700 border border-red-500 text-white dark:from-red-800 dark:to-red-900 dark:border-red-600';

  return (
    <div className={`${baseClasses} ${typeClasses} animate-in fade-in slide-in-from-bottom-5`}>
      <div className="flex-shrink-0">
        {isSuccess ? (
          <CheckCircleIcon />
        ) : (
          <WarningIcon />
        )}
      </div>
      <div className="flex-1 text-sm font-medium">{toast.message}</div>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="flex-shrink-0 -mx-1.5 -my-1.5 bg-transparent rounded-lg p-1.5 inline-flex h-8 w-8 text-white/70 hover:text-white hover:bg-white/20 focus:ring-2 focus:ring-white/30 transition-all duration-200"
        aria-label="Dismiss"
      >
        <span className="sr-only">Dismiss</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
        </svg>
      </button>
    </div>
  );
};

export default Toast;