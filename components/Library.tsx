import React, { useState, useEffect } from 'react';
import { LIBRARY } from '../constants'; // Keep for structure, but actual books will come from DB
import { Book, BookProgress, BookCategory } from '../types';
import { fetchChabadBookSections, fetchChabadSectionContent } from '../src/services/chabadLibraryScraper';
import { fetchAndStoreChabadLibraryBooks, getChabadBooksFromDB } from '../src/services/chabadLibraryService'; // New import

interface LibraryProps {
  onSelectBook: (book: Book, content?: string) => void; // Modified to accept content
  selectedBookId: string | null;
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  progress: BookProgress[];
}

const Library: React.FC<LibraryProps> = ({ onSelectBook, selectedBookId, isOpen, onClose, theme, progress }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Chabad Chassidus'); // Default open Chabad
  const [dbBooks, setDbBooks] = useState<Book[]>([]);
  const [isLoadingDbBooks, setIsLoadingDbBooks] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  // State for Chabad Library Scraper (for individual sections)
  const [chabadBookUrlInput, setChabadBookUrlInput] = useState('');
  const [fetchedChabadSections, setFetchedChabadSections] = useState<{ title: string; url: string }[]>([]);
  const [isLoadingChabadSections, setIsLoadingChabadSections] = useState(false);
  const [chabadScrapeError, setChabadScrapeError] = useState<string | null>(null);
  const [selectedOnlineSectionUrl, setSelectedOnlineSectionUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadBooks = async () => {
      setIsLoadingDbBooks(true);
      try {
        const books = await getChabadBooksFromDB();
        setDbBooks(books);
      } catch (error) {
        console.error("Failed to load books from database:", error);
      } finally {
        setIsLoadingDbBooks(false);
      }
    };
    loadBooks();
  }, []);

  const handleScrapeAndStoreBooks = async () => {
    setIsScraping(true);
    setScrapeMessage('Scraping books from chabadlibrary.org...');
    try {
      const newBooks = await fetchAndStoreChabadLibraryBooks();
      setDbBooks(prev => [...prev, ...newBooks]); // Add new books to state
      setScrapeMessage(`Successfully scraped and added ${newBooks.length} new books!`);
    } catch (error: any) {
      setScrapeMessage(`Error scraping books: ${error.message}`);
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeMessage(null), 5000); // Clear message after 5 seconds
    }
  };

  const toggleCategory = (title: string) => {
    setExpandedCategory(prev => prev === title ? null : title);
  };
  
  const getBookProgress = (bookId: string) => {
    return progress.find(p => p.bookId === bookId)?.percentage || 0;
  };

  const isDark = theme === 'dark';

  const handleFetchChabadSections = async () => {
    if (!chabadBookUrlInput) {
      setChabadScrapeError('Please enter a book URL.');
      return;
    }
    setIsLoadingChabadSections(true);
    setChabadScrapeError(null);
    setFetchedChabadSections([]);
    try {
      const sections = await fetchChabadBookSections(chabadBookUrlInput);
      setFetchedChabadSections(sections);
    } catch (error: any) {
      setChabadScrapeError(`Failed to fetch sections: ${error.message}`);
    } finally {
      setIsLoadingChabadSections(false);
    }
  };

  const handleLoadChabadSection = async (sectionTitle: string, sectionUrl: string) => {
    setIsLoadingChabadSections(true);
    setChabadScrapeError(null);
    setSelectedOnlineSectionUrl(sectionUrl);
    try {
      const { title, content } = await fetchChabadSectionContent(sectionUrl);
      // Create a dummy Book object for the Reader
      const onlineBook: Book = {
        id: sectionUrl, // Use URL as ID for online content
        title: title,
        category: 'Online Chabad Library',
      };
      onSelectBook(onlineBook, content); // Pass content directly
      onClose(); // Close library after selecting
    } catch (error: any) {
      setChabadScrapeError(`Failed to load section content: ${error.message}`);
    } finally {
      setIsLoadingChabadSections(false);
    }
  };

  // Combine hardcoded categories with fetched books
  const allCategories: BookCategory[] = LIBRARY.map(cat => ({ ...cat, books: [] })); // Start with empty hardcoded categories
  
  // Add fetched books to a 'Chabad Chassidus' category or create one if it doesn't exist
  let chabadCategory = allCategories.find(cat => cat.title === 'Chabad Chassidus');
  if (!chabadCategory) {
    chabadCategory = { title: 'Chabad Chassidus', books: [] };
    allCategories.push(chabadCategory);
  }
  chabadCategory.books = dbBooks; // Assign fetched books here

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
            {/* Scrape Button */}
            <div className="mb-6">
              <button
                onClick={handleScrapeAndStoreBooks}
                disabled={isScraping}
                className={`w-full py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all
                  ${isScraping ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                `}
              >
                {isScraping ? 'Scraping...' : 'Scrape Chabad Library Books'}
              </button>
              {scrapeMessage && (
                <p className={`mt-2 text-center text-xs ${scrapeMessage.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                  {scrapeMessage}
                </p>
              )}
            </div>

            {isLoadingDbBooks ? (
              <div className="text-center opacity-50 text-sm">Loading books...</div>
            ) : (
              allCategories.map((category) => (
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
              ))
            )}

            {/* Existing Section for Online Chabad Library (for individual sections) */}
            <div className="mt-8">
              <button 
                onClick={() => toggleCategory('Online Chabad Library')}
                className={`flex items-center gap-2 w-full text-left py-2 font-medium uppercase tracking-wider text-xs opacity-60 hover:opacity-100 transition-opacity ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
              >
                <span className={`transform transition-transform duration-200 ${expandedCategory === 'Online Chabad Library' ? 'rotate-90' : ''}`}>
                  ▶
                </span>
                Online Chabad Library (Section Scraper)
              </button>
              
              <div className={`mt-2 space-y-3 overflow-hidden transition-all duration-300 ${expandedCategory === 'Online Chabad Library' ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
                    {isLoadingChabadSections ? 'Loading Sections...' : 'Fetch Sections'}
                  </button>
                  {chabadScrapeError && (
                    <p className="text-red-500 text-xs">{chabadScrapeError}</p>
                  )}
                </div>

                {fetchedChabadSections.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-xs uppercase tracking-wider opacity-70 px-2">Sections:</p>
                    {fetchedChabadSections.map((section, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleLoadChabadSection(section.title, section.url)}
                        className={`
                          group w-full text-right px-4 py-2 rounded-md text-sm font-hebrew-serif transition-all duration-200 border border-transparent relative overflow-hidden
                          ${selectedOnlineSectionUrl === section.url 
                            ? 'bg-gray-200 dark:bg-gray-800 text-black dark:text-white font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
                          }
                          ${isDark ? 'text-gray-300' : 'text-gray-700'}
                        `}
                        disabled={isLoadingChabadSections}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Library;