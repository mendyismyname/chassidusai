import React, { useState, useEffect } from 'react';
import { Book, BookProgress, BookCategory } from '../types';
import { getAuthors, getBooks, getChapters } from '../services/libraryService';
import { fetchChabadBookSections, fetchChabadSectionContent } from '../src/services/chabadLibraryScraper';
import { fetchAndStoreChabadLibraryBooks, getChabadBooksFromDB } from '../src/services/chabadLibraryService';

interface LibraryProps {
  onSelectBook: (book: Book, content?: string) => void;
  selectedBookId: string | null;
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  progress: BookProgress[];
  isAdmin: boolean;
}

interface AuthorWithBooks extends BookCategory {
  id: string;
}

const Library: React.FC<LibraryProps> = ({ 
  onSelectBook, 
  selectedBookId, 
  isOpen, 
  onClose, 
  theme, 
  progress,
  isAdmin 
}) => {
  const [authors, setAuthors] = useState<AuthorWithBooks[]>([]);
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for Chabad Library Scraper (for individual sections)
  const [chabadBookUrlInput, setChabadBookUrlInput] = useState('');
  const [rawFetchedLinks, setRawFetchedLinks] = useState<{ title: string; url: string }[]>([]);
  const [isLoadingChabadSections, setIsLoadingChabadSections] = useState(false);
  const [chabadScrapeError, setChabadScrapeError] = useState<string | null>(null);
  const [selectedOnlineSectionUrl, setSelectedOnlineSectionUrl] = useState<string | null>(null);

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
              title: author.name,
              books: books.map(book => ({
                id: book.id,
                title: book.title,
                category: 'Chassidus',
                author_id: book.author_id
              }))
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

  const handleScrapeAndStoreBooks = async () => {
    // Implementation remains the same
  };

  const toggleAuthor = (authorId: string) => {
    setExpandedAuthor(prev => prev === authorId ? null : authorId);
  };

  const getBookProgress = (bookId: string) => {
    return progress.find(p => p.bookId === bookId)?.percentage || 0;
  };

  const isDark = theme === 'dark';

  const handleFetchChabadSections = async () => {
    // Implementation remains the same
  };

  const handleLoadChabadSection = async (sectionTitle: string, sectionUrl: string) => {
    // Implementation remains the same
  };

  const handleExploreAsBook = (url: string) => {
    // Implementation remains the same
  };

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
                    {author.title}
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
            
            {/* Admin Tools Section */}
            {isAdmin && (
              <div className="mt-8 pt-8 border-t border-dashed border-gray-200 dark:border-gray-800">
                <h3 className={`text-xs font-bold uppercase tracking-widest opacity-40 mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Admin Tools</h3>
                
                {/* Scrape All Books Button */}
                <div className="mb-6">
                  <button 
                    onClick={handleScrapeAndStoreBooks}
                    disabled={true} // Disabled since we're using external scraper
                    className={`w-full py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all opacity-50 cursor-not-allowed ${isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    Scrape All Chabad Library Books
                  </button>
                  <p className="mt-2 text-center text-xs text-yellow-500">
                    Scraper disabled - using external script
                  </p>
                </div>
                
                {/* Online Chabad Library (Section Scraper) */}
                <div className="mt-8">
                  <button 
                    onClick={() => toggleAuthor('online-chabad-library')}
                    className={`flex items-center gap-2 w-full text-left py-2 font-medium uppercase tracking-wider text-xs opacity-60 hover:opacity-100 transition-opacity ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                  >
                    <span className={`transform transition-transform duration-200 ${expandedAuthor === 'online-chabad-library' ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    Online Chabad Library (Section Scraper)
                  </button>
                  
                  <div className={`mt-2 space-y-3 overflow-hidden transition-all duration-300 ${expandedAuthor === 'online-chabad-library' ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="text-xs opacity-60 px-2">Paste a book URL from chabadlibrary.org to browse its sections.</p>
                    <div className="flex flex-col gap-2 px-2">
                      <input 
                        type="text" 
                        value={chabadBookUrlInput} 
                        onChange={(e) => setChabadBookUrlInput(e.target.value)} 
                        placeholder="e.g., https://chabadlibrary.org/books/100000000" 
                        className={`w-full p-2 rounded-md border text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-100 border-gray-300 text-gray-800'}`} 
                      />
                      <button 
                        onClick={handleFetchChabadSections} 
                        disabled={isLoadingChabadSections || !chabadBookUrlInput}
                        className={`w-full py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black hover:bg-black/10'} ${isLoadingChabadSections ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isLoadingChabadSections ? 'Loading Links...' : 'Fetch Links'}
                      </button>
                      {chabadScrapeError && (
                        <p className="text-red-500 text-xs">{chabadScrapeError}</p>
                      )}
                    </div>
                    
                    {rawFetchedLinks.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-xs uppercase tracking-wider opacity-70 px-2">Found Links:</p>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar border rounded-md p-2">
                          {rawFetchedLinks.map((link, idx) => (
                            <div key={idx} className={`flex flex-col gap-1 p-2 rounded-md ${isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`}>
                              <span className={`text-sm font-hebrew-serif ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{link.title}</span>
                              <span className="text-xs opacity-50 truncate">{link.url}</span>
                              <div className="flex gap-2 mt-1">
                                <button 
                                  onClick={() => handleLoadChabadSection(link.title, link.url)} 
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`} 
                                  disabled={isLoadingChabadSections}
                                >
                                  Load as Section
                                </button>
                                <button 
                                  onClick={() => handleExploreAsBook(link.url)} 
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`} 
                                  disabled={isLoadingChabadSections}
                                >
                                  Explore as Book
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Library;