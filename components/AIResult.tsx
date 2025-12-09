import React from 'react';
import { AIState, Theme } from '../types';

interface AIResultProps {
  aiState: AIState;
  onClose: () => void;
  theme: Theme;
}

const AIResult: React.FC<AIResultProps> = ({ aiState, onClose, theme }) => {
  if (!aiState.isLoading && !aiState.content && !aiState.error) return null;

  const bgClass = theme === 'dark' ? 'bg-[#2a2a2a] border-gray-700 text-gray-200' 
                : theme === 'sepia' ? 'bg-[#fdf6e3] border-[#d8cba8] text-[#5b4636]' 
                : 'bg-white border-gray-200 text-gray-800';

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-full md:w-96 shadow-2xl transform transition-transform duration-300 ease-out border-r
      ${bgClass}
      overflow-y-auto
    `}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-lg font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            chassidus.ai
          </h3>
          <button onClick={onClose} className="p-1 opacity-50 hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {aiState.isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-current opacity-10 rounded w-3/4"></div>
            <div className="h-4 bg-current opacity-10 rounded w-full"></div>
            <div className="h-4 bg-current opacity-10 rounded w-5/6"></div>
            <div className="h-4 bg-current opacity-10 rounded w-full"></div>
            <div className="mt-8 text-center opacity-50 text-sm">Generating insights...</div>
          </div>
        ) : aiState.error ? (
          <div className="p-4 rounded border border-red-200 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800">
            {aiState.error}
          </div>
        ) : (
          <div className="prose prose-lg dark:prose-invert">
            <h4 className="text-xl font-serif mb-4 capitalize font-medium opacity-80 border-b pb-2 border-current border-opacity-10">
              {aiState.type === 'translation' ? 'Translation' : 'Summary'}
            </h4>
            <div className="whitespace-pre-wrap leading-relaxed text-base font-sans">
              {aiState.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIResult;