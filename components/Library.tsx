
import React, { useState } from 'react';
import { LIBRARY } from '../constants';
import { Book, BookProgress } from '../types';

interface LibraryProps {
  onSelectBook: (book: Book) => void;
  selectedBookId: string | null;
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  progress: BookProgress[];
}

const Library: React.FC<LibraryProps> = ({ onSelectBook, selectedBookId, isOpen, onClose, theme, progress }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(LIBRARY[1].title); // Default open Chabad

  const toggleCategory = (title: string) => {
    setExpandedCategory(prev => prev === title ? null : title);
  };
  
  const getBookProgress = (bookId: string) => {
    return progress.find(p => p.bookId === bookId)?.percentage || 0;
  };

  const isDark = theme === 'dark';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Left Drawer */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          border-r border-opacity-10 shadow-2xl overflow-hidden flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isDark ? 'bg-[#050505] border-gray-800' : theme === 'sepia' ? 'bg-[#f4ecd8] border-[#d8cba8]' : 'bg-white border-gray-100'}
        `}
      >
        <div className="p-8 pb-4">
          <h2 className={`text-2xl font-serif font-bold tracking-wide mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
            Library
          </h2>
          <p className="text-xs uppercase tracking-widest opacity-40">Select a text to study</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-20 custom-scrollbar">
          <div className="space-y-6">
            {LIBRARY.map((category) => (
              <div key={category.title}>
                <button 
                  onClick={() => toggleCategory(category.title)}
                  className={`flex items-center gap-2 w-full text-left py-2 font-medium uppercase tracking-wider text-xs opacity-60 hover:opacity-100 transition-opacity ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  <span className={`transform transition-transform duration-200 ${expandedCategory === category.title ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  {category.title}
                </button>
                
                <div className={`mt-2 space-y-1 overflow-hidden transition-all duration-300 ${expandedCategory === category.title ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  {category.books.map((book) => {
                    const prog = getBookProgress(book.id);
                    return (
                      <button
                        key={book.id}
                        onClick={() => onSelectBook(book)}
                        className={`
                          group w-full text-right px-4 py-3 rounded-md text-base font-hebrew-serif transition-all duration-200 border border-transparent relative overflow-hidden
                          ${selectedBookId === book.id 
                            ? 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                          }
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}
                      >
                         <div className="flex justify-between items-center relative z-10">
                            {prog > 0 && (
                              <span className="text-[10px] font-sans opacity-40">{prog}%</span>
                            )}
                            <span>{book.title}</span>
                         </div>
                         {/* Progress Bar Background */}
                         {prog > 0 && (
                             <div 
                                className={`absolute bottom-0 right-0 top-0 opacity-5 ${isDark ? 'bg-white' : 'bg-black'}`}
                                style={{ width: `${prog}%` }}
                             />
                         )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Library;
