import React, { useState, useEffect } from 'react';
import { Book, BookProgress } from '../types';
import { getAuthors, getBooks } from '../services/libraryService';

interface LibraryProps {
  onSelectBook: (book: Book) => void;
  selectedBookId: string | null;
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  progress: BookProgress[];
}

interface AuthorWithBooks {
  id: string;
  name: string;
  books: Book[];
}

const Library: React.FC<LibraryProps> = ({ 
  onSelectBook, 
  selectedBookId, 
  isOpen, 
  onClose, 
  theme, 
  progress
}) => {
  const [authors, setAuthors] = useState<AuthorWithBooks[]>([]);
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLibraryData = async () => {
      try {
        setLoading(true);
        const authorsData = await getAuthors();
        const authorsWithBooks: AuthorWithBooks[] = await Promise.all(
          authorsData.map(async (author) => {
            const books = await getBooks(author.id);
            return {
              id: author.id,
              name: author.name,
              books
            };
          })
        );
        setAuthors(authorsWithBooks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load library data');
      } finally {
        setLoading(false);
      }
    };

    loadLibraryData();
  }, []);

  const toggleAuthor = (authorId: string) => {
    setExpandedAuthor(prev => prev === authorId ? null : authorId);
  };

  const getBookProgress = (bookId: string) => {
    return progress.find(p => p.bookId === bookId)?.percentage || 0;
  };

  const isDark = theme === 'dark';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      )}
      
      {/* Left Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] border-r border-opacity-10 shadow-2xl overflow-hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-[#050505] border-gray-800' : theme === 'sepia' ? 'bg-[#f4ecd8] border-[#d8cba8]' : 'bg-white border-gray-100'}`}>
        <div className="p-8 pb-4">
          <h2 className={`text-2xl font-serif font-bold tracking-wide mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Library</h2>
          <p className="text-xs uppercase tracking-widest opacity-40">Select a text to study</p>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 pb-20 custom-scrollbar">
          <div className="space-y-6">
            {loading ? (
              <div className="text-center opacity-50 text-sm">Loading library...</div>
            ) : error ? (
              <div className="text-center text-red-500 text-sm">Error: {error}</div>
            ) : (
              authors.map((author) => (
                <div key={author.id}>
                  <button 
                    onClick={() => toggleAuthor(author.id)}
                    className={`flex items-center gap-2 w-full text-left py-2 font-medium uppercase tracking-wider text-xs opacity-60 hover:opacity-100 transition-opacity ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                  >
                    <span className={`transform transition-transform duration-200 ${expandedAuthor === author.id ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    {author.name}
                  </button>
                  
                  <div className={`mt-2 space-y-1 overflow-hidden transition-all duration-300 ${expandedAuthor === author.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {author.books.map((book) => {
                      const prog = getBookProgress(book.id);
                      return (
                        <button
                          key={book.id}
                          onClick={() => onSelectBook(book)}
                          className={`group w-full text-right px-4 py-3 rounded-md text-base font-hebrew-serif transition-all duration-200 border border-transparent relative overflow-hidden ${selectedBookId === book.id ? 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white font-bold' : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-80 hover:opacity-100'} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                        >
                          <div className="flex justify-between items-center relative z-10">
                            {prog > 0 && (
                              <span className="text-[10px] font-sans opacity-40">{prog}%</span>
                            )}
                            <span>{book.title}</span>
                          </div>
                          
                          {/* Progress Bar Background */}
                          {prog > 0 && (
                            <div className={`absolute bottom-0 right-0 top-0 opacity-5 ${isDark ? 'bg-white' : 'bg-black'}`} style={{ width: `${prog}%` }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Library;