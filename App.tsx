
import React, { useState, useEffect } from 'react';
import Library from './components/Library';
import Reader from './components/Reader';
import TopNav from './components/TopNav';
import BottomNav from './components/BottomNav';
import Orb from './components/Orb';
import Intro from './components/Intro';
import ProfileModal from './components/ProfileModal';
import WebcamWindow from './components/WebcamWindow';
import WelcomeExperience from './components/WelcomeExperience';
import { Settings, Book, AIState } from './types';
import { LIBRARY, SAMPLE_TEXT, SAMPLE_TEXT_TITLE } from './constants';
import { chatWithAI } from './services/geminiService';

// Cookie Helpers
const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
};

const getCookie = (name: string) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const FREE_LIMIT = 3;

const App: React.FC = () => {
  // --- State ---
  const [showIntro, setShowIntro] = useState(true);
  
  const [settings, setSettings] = useState<Settings>({
    theme: 'light', 
    fontSize: 2.2, 
    lineHeight: 1.8,
    translationMode: 'bilingual',
    textAlign: 'center',
    apiKey: getCookie('chassidus_ai_key') || '', // Load from cookie
    dailyUsageCount: 0,
    lastUsageDate: new Date().toISOString().split('T')[0],
    progress: [
      { bookId: 'toras-chaim', percentage: 12, lastReadDate: new Date().toISOString() },
      { bookId: 'tanya', percentage: 45, lastReadDate: new Date().toISOString() },
      { bookId: 'baal-shem-tov', percentage: 5, lastReadDate: new Date().toISOString() },
    ]
  });

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  
  // Navigation State
  const [scrollToChunkId, setScrollToChunkId] = useState<number | null>(null);

  // AI State
  const [aiState, setAiState] = useState<AIState>({
    isLoading: false,
    messages: [],
    type: null,
    error: null,
    followUps: []
  });
  
  const [selectedTextForAI, setSelectedTextForAI] = useState<string>("");
  const [markedContext, setMarkedContext] = useState<string>(SAMPLE_TEXT);

  // Check and Reset Daily Usage (Still tracked, but unlimited for key users)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (settings.lastUsageDate !== today) {
      setSettings(prev => ({
        ...prev,
        dailyUsageCount: 0,
        lastUsageDate: today
      }));
    }
  }, []);

  // --- Handlers ---

  const handleBookSelect = (book: Book) => {
    setCurrentBook(book);
    setIsLibraryOpen(false); 
  };

  const handleStartLearning = () => {
    // Select a random book from the library
    const allBooks = LIBRARY.flatMap(category => category.books);
    if (allBooks.length > 0) {
      const randomBook = allBooks[Math.floor(Math.random() * allBooks.length)];
      handleBookSelect(randomBook);
    }
  };

  const handleGoHome = () => {
    setCurrentBook(null);
    setIsLibraryOpen(false);
    setScrollToChunkId(null);
  };

  const handleUpdateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    // Persist API Key to Cookie if it changed
    if (newSettings.apiKey !== undefined) {
      setCookie('chassidus_ai_key', newSettings.apiKey, 365); // Save for 1 year
      
      // If user added a key and there was an error, clear error to allow retry
      if (newSettings.apiKey && aiState.error) {
         setAiState(prev => ({ ...prev, error: null }));
         // Optionally retry last message if it was from user?
         const lastMsg = aiState.messages[aiState.messages.length - 1];
         if (lastMsg && lastMsg.role === 'user') {
            handleAskAI(lastMsg.content, 'full', undefined, newSettings.apiKey);
         }
      }
    }
  };

  const handleOpenAIWithSelection = (text: string) => {
    setSelectedTextForAI(text);
  };

  const handleError = (msg: string) => {
    setAiState(prev => ({ ...prev, isLoading: false, error: msg }));
  };

  const incrementUsage = () => {
    setSettings(prev => ({ ...prev, dailyUsageCount: prev.dailyUsageCount + 1 }));
  };
  
  const handleNavigateToChunk = (chunkId: number) => {
    setScrollToChunkId(chunkId);
    // Reset after a moment so it can be triggered again if needed
    setTimeout(() => setScrollToChunkId(null), 100);
  };

  // Allow passing an explicit key for retry logic
  const handleAskAI = async (query: string, contextMode: 'selection' | 'full', manualContext?: string, explicitKey?: string) => {
     const effectiveKey = explicitKey || settings.apiKey;

     // Check usage limits if no key
     if (!effectiveKey) {
        if (settings.dailyUsageCount >= FREE_LIMIT) {
             setIsProfileOpen(true);
             return;
        }
     }

     // Determine Context
     let context = "";
     if (manualContext) {
        context = manualContext;
     } else if (contextMode === 'selection') {
        context = selectedTextForAI || "No selection active.";
     } else {
        // Use the marked context if available, otherwise fallback
        context = markedContext || (currentBook ? SAMPLE_TEXT : "No book selected.");
     }
     
     if (context.length < 10 && contextMode === 'full') {
         context = markedContext; 
     }

     // Optimistically add user message only if it's a new request (not a retry of existing last message)
     const lastMsg = aiState.messages[aiState.messages.length - 1];
     const isRetry = lastMsg && lastMsg.role === 'user' && lastMsg.content === query;
     
     if (!isRetry) {
       setAiState(prev => ({ 
         ...prev, 
         isLoading: true, 
         messages: [...prev.messages, { role: 'user', content: query }],
         error: null 
       }));
     } else {
       setAiState(prev => ({ ...prev, isLoading: true, error: null }));
     }
     
     try {
       // If no key, pass empty string to trigger mock mode in service
       const result = await chatWithAI(query, context, effectiveKey || "", aiState.messages);
       
       setAiState(prev => ({ 
         isLoading: false, 
         messages: [...prev.messages, { role: 'model', content: result.text }],
         type: 'chat', 
         error: null,
         followUps: result.followUps 
       }));
       incrementUsage();

     } catch(e) {
       handleError("Error contacting scholar. Please check API Key.");
     }
  };

  return (
    <>
      {showIntro && <Intro onComplete={() => setShowIntro(false)} />}
      
      <div className={`flex h-screen overflow-hidden transition-opacity duration-1000 ${showIntro ? 'opacity-0' : 'opacity-100'} ${settings.theme === 'dark' ? 'dark' : ''}`}>
        
        {/* Left Drawer Library */}
        <Library 
          isOpen={isLibraryOpen} 
          onClose={() => setIsLibraryOpen(false)}
          onSelectBook={handleBookSelect}
          selectedBookId={currentBook?.id || null}
          theme={settings.theme}
          progress={settings.progress}
        />

        {/* Profile / API Key Modal */}
        {isProfileOpen && (
          <ProfileModal 
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setIsProfileOpen(false)}
            theme={settings.theme}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-[#050505]">
          
          <TopNav 
            settings={settings}
            toggleLibrary={() => setIsLibraryOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            onGoHome={handleGoHome}
          />

          <div className="flex-1 h-full relative">
            {currentBook ? (
              <Reader 
                text={SAMPLE_TEXT} // In real app, load book text by ID
                title={currentBook.id === 'toras-chaim' ? SAMPLE_TEXT_TITLE : currentBook.title}
                settings={settings}
                onTextSelect={handleOpenAIWithSelection}
                onAskAI={(query) => handleAskAI(query, 'selection')}
                onError={handleError}
                onOpenProfile={() => setIsProfileOpen(true)}
                onOpenLibrary={() => setIsLibraryOpen(true)}
                isMenuOpen={isMenuOpen}
                onCloseMenu={() => setIsMenuOpen(false)}
                scrollToChunkId={scrollToChunkId}
                onContextUpdate={setMarkedContext}
              />
            ) : (
              <WelcomeExperience 
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onOpenLibrary={() => setIsLibraryOpen(true)}
                onOpenProfile={() => setIsProfileOpen(true)}
                onStartLearning={handleStartLearning}
              />
            )}
          </div>

          <BottomNav 
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            toggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
            toggleMenu={() => setIsMenuOpen(!isMenuOpen)}
            isMenuOpen={isMenuOpen}
          />
          
          {isWebcamActive && (
            <WebcamWindow onClose={() => setIsWebcamActive(false)} />
          )}
          
          {/* AI Orb & Panel */}
          <Orb 
            onAskAI={handleAskAI} 
            aiState={aiState}
            onCloseResult={() => {}}
            theme={settings.theme}
            initialQuery={undefined} 
            selectedText={selectedTextForAI}
            onNavigateToChunk={handleNavigateToChunk}
          />

        </div>
      </div>
    </>
  );
};

export default App;
