
import React, { useState, useEffect, useRef } from 'react';
import { AIState, Theme } from '../types';

interface OrbProps {
  onAskAI: (query: string, contextMode: 'selection' | 'full') => void;
  aiState: AIState;
  onCloseResult: () => void;
  theme: Theme;
  initialQuery?: string;
  selectedText?: string;
  onNavigateToChunk?: (chunkId: number) => void;
}

const SUGGESTIONS = [
  "Summarize the main idea",
  "Explain the Kabbalistic concepts",
  "What is the practical lesson?",
  "Translate difficult words"
];

const Orb: React.FC<OrbProps> = ({ onAskAI, aiState, onCloseResult, theme, initialQuery, selectedText, onNavigateToChunk }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contextMode, setContextMode] = useState<'selection' | 'full'>('selection');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-gray-200' : 'text-gray-800';
  const borderColor = isDark ? 'border-white/10' : 'border-black/5';
  const bgColor = isDark ? 'bg-[#111]' : 'bg-white';

  // Open on valid selection or loading
  useEffect(() => {
    if (aiState.messages.length > 0 || aiState.isLoading || (selectedText && selectedText.length > 0)) {
      setIsOpen(true);
      if (selectedText) {
          setContextMode('selection');
      }
    }
  }, [aiState.messages.length, aiState.isLoading, selectedText]);

  // Gentle scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current && aiState.messages.length > 0) {
       // Using scrollTo with top: scrollHeight ensures we see the end of the conversation
       // but doesn't forcefully snap the start of the last message to the top of the viewport
       setTimeout(() => {
         if (scrollRef.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth'
            });
         }
       }, 100);
    }
  }, [aiState.messages, aiState.isLoading]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onAskAI(query, contextMode);
    setQuery("");
  };

  // Helper to render text with citation buttons
  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\[Section \d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[Section (\d+)\]/);
      if (match && onNavigateToChunk) {
        return (
          <button 
            key={i}
            onClick={() => onNavigateToChunk(parseInt(match[1]))}
            className="inline-flex items-center mx-1 text-gray-400 hover:text-blue-500 hover:underline decoration-blue-500/30 text-[10px] font-bold transition-all"
            title={`Jump to Section ${match[1]}`}
          >
            [{match[1]}]
          </button>
        );
      }
      return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />;
    });
  };

  // Helper to strip HTML from suggestions for display in buttons
  const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  return (
    <>
      {/* Invisible Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[55] cursor-default bg-transparent"
          onClick={handleClose}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        ref={panelRef}
        className={`
          fixed inset-y-0 right-0 z-[60] w-full md:w-[450px] 
          transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          ${textColor} ${bgColor}
          flex flex-col border-l ${borderColor} shadow-2xl
        `}
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Header */}
        <div className={`h-16 px-6 flex items-center justify-between shrink-0 border-b ${borderColor}`}>
           <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${aiState.isLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="uppercase tracking-[0.2em] text-xs font-bold opacity-50">Scholar AI</span>
           </div>
           <button onClick={handleClose} className="opacity-30 hover:opacity-100 transition-opacity p-2">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>

        {/* Content Area - Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar flex flex-col gap-6 snap-y snap-mandatory">
           {aiState.messages.length === 0 && !aiState.isLoading ? (
               <div className="flex flex-col gap-8 mt-4">
                  
                  {/* Selected Context Preview */}
                  {selectedText && contextMode === 'selection' && (
                    <div className={`p-4 rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-gray-50'}`}>
                        <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Selected Context</div>
                        <div className="font-serif text-sm opacity-70 line-clamp-4 leading-relaxed italic">
                           "{selectedText}"
                        </div>
                    </div>
                  )}

                  <div className="space-y-3">
                     <p className="text-center font-serif text-lg opacity-40">How can I help you study?</p>
                     <div className="flex flex-col gap-2">
                        {SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => onAskAI(s, contextMode)}
                            className={`
                              w-full text-left py-3 px-4 rounded-xl transition-all border
                              ${isDark ? 'border-white/10 hover:bg-white/10' : 'border-black/5 hover:bg-black/5'}
                              text-sm opacity-70 hover:opacity-100
                            `}
                          >
                            {s}
                          </button>
                        ))}
                     </div>
                  </div>
               </div>
           ) : (
             <>
               {aiState.messages.map((msg, idx) => (
                 <div key={idx} className={`snap-start relative group flex flex-col ${msg.role === 'user' ? 'items-center' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 w-full`}>
                    {msg.role !== 'user' && (
                       <div className={`text-[10px] uppercase tracking-widest opacity-40 mb-2`}>
                         Scholar
                       </div>
                    )}
                    <div className={`
                      prose prose-sm dark:prose-invert font-sans max-w-full
                      prose-p:mb-2 prose-p:leading-loose
                      ${msg.role === 'user' 
                        ? (isDark ? 'bg-white/5' : 'bg-gray-50') + ' p-4 rounded-xl text-center italic w-full border ' + (isDark ? 'border-white/10' : 'border-black/5')
                        : ''}
                    `}>
                        <div>{renderMessageContent(msg.content)}</div>
                    </div>
                    
                    {/* Feedback Icon */}
                    {msg.role !== 'user' && (
                        <button className="absolute -right-4 top-4 p-2 opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-opacity">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                             </svg>
                        </button>
                    )}
                 </div>
               ))}
             </>
           )}
           
           {/* Loading Indicator */}
           {aiState.isLoading && (
              <div className="snap-start flex flex-col gap-4 opacity-50">
                 <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Scholar</div>
                 <div className="h-3 bg-current w-3/4 rounded-full animate-pulse"></div>
                 <div className="h-3 bg-current w-full rounded-full animate-pulse"></div>
              </div>
           )}

           <div className="pb-4" /> 
        </div>

        {/* Suggested Questions - Stacked */}
        {aiState.followUps && aiState.followUps.length > 0 && !aiState.isLoading && (
            <div className={`px-6 pt-4 border-t ${borderColor}`}>
              <div className="flex flex-col gap-2">
                {aiState.followUps.map((q, i) => (
                  <button 
                    key={i}
                    onClick={() => onAskAI(stripHtml(q), contextMode)}
                    className={`
                      text-left text-xs py-2 px-3 rounded-lg transition-all border
                      ${isDark ? 'border-white/10 hover:bg-white/10 text-gray-300' : 'border-black/5 hover:bg-black/5 text-gray-600'}
                    `}
                  >
                    {stripHtml(q)}
                  </button>
                ))}
              </div>
            </div>
        )}

        {/* Input Area */}
        <div className={`p-6 pt-4`}>
           <form onSubmit={handleSubmit}>
             {/* Redesigned Input Container */}
             <div className={`
               flex items-center gap-2 px-4 py-2 rounded-2xl
               ${isDark ? 'bg-white/5' : 'bg-gray-100'}
             `}>
                
                {/* Inline Context Switcher */}
                <div className="relative" ref={dropdownRef}>
                  <button
                     type="button"
                     onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                     className={`
                       flex items-center gap-1.5 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors
                       text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 whitespace-nowrap
                     `}
                     title="Change Context"
                  >
                     {contextMode === 'selection' ? 'Selection' : 'Page'}
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                       <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                     </svg>
                  </button>
                  
                  {isDropdownOpen && (
                     <div className={`
                        absolute bottom-full left-0 mb-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden
                        ${isDark ? 'bg-[#222] border-gray-700' : 'bg-white border-gray-100'}
                     `}>
                        <button 
                          type="button"
                          onClick={() => { setContextMode('selection'); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-[10px] uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 ${contextMode === 'selection' ? 'font-bold opacity-100 bg-black/5 dark:bg-white/5' : 'opacity-60'}`}
                        >
                          Selected Text
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setContextMode('full'); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-[10px] uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 ${contextMode === 'full' ? 'font-bold opacity-100 bg-black/5 dark:bg-white/5' : 'opacity-60'}`}
                        >
                          Full Page
                        </button>
                     </div>
                  )}
                </div>

                <div className="w-px h-4 bg-current opacity-10 mx-2"></div>

               <input 
                 type="text" 
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 placeholder="Ask..."
                 className={`flex-1 bg-transparent outline-none text-sm transition-all placeholder:opacity-30`}
               />
               
               <button 
                 type="submit"
                 disabled={!query.trim() || aiState.isLoading}
                 className="p-1 opacity-40 hover:opacity-100 disabled:opacity-10 transition-all"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                   <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 004.82 9.25h8.179a.5.5 0 010 1H4.82a1.5 1.5 0 00-1.127 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                 </svg>
               </button>
             </div>
           </form>
        </div>
      </div>

      {/* The Orb Trigger */}
      <div 
        className={`fixed bottom-24 md:bottom-8 right-8 z-50 transition-all duration-700 ${isOpen ? 'translate-x-32 opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
      >
        <button 
          onClick={handleOpen}
          className="relative w-14 h-14 group cursor-pointer"
        >
           <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-xl ${isDark ? 'bg-white/20' : 'bg-black/10'}`}></div>
           <div className={`relative w-full h-full rounded-full flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105 border shadow-xl ${isDark ? 'bg-[#222] border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className={`w-full h-full opacity-80 ${isDark ? 'bg-gradient-to-tr from-gray-800 to-black' : 'bg-gradient-to-tr from-gray-100 to-white'}`}></div>
           </div>
        </button>
      </div>
    </>
  );
};

export default Orb;
