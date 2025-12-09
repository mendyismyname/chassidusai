import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, TextSelection, TextChunk } from '../types';
import { THEME_CLASSES } from '../constants';
import Minimap from './Minimap';
import { translateParagraph } from '../services/geminiService';
import { supabase } from '../integrations/supabase/client';

interface ReaderProps {
  text: string;
  title: string;
  settings: Settings;
  onTextSelect: (text: string) => void;
  onAskAI: (text: string) => void; 
  onError: (msg: string) => void;
  onOpenProfile: () => void;
  onOpenLibrary: () => void;
  isMenuOpen: boolean;
  onCloseMenu: () => void;
  scrollToChunkId?: number | null;
  onContextUpdate: (markedContext: string) => void;
  currentBookId: string | null; // Add currentBookId
  userId: string | null; // Add userId
}

interface MinimapItem {
  title: string;
  index: number;
}

const Reader: React.FC<ReaderProps> = ({ 
  text, 
  title, 
  settings, 
  onTextSelect, 
  onAskAI, 
  onError, 
  onOpenProfile, 
  onOpenLibrary,
  isMenuOpen,
  onCloseMenu,
  scrollToChunkId,
  onContextUpdate,
  currentBookId,
  userId
}) => {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [minimapItems, setMinimapItems] = useState<MinimapItem[]>([]);

  // Initialize Chunks and fetch existing translations
  useEffect(() => {
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    const newChunks: TextChunk[] = [];
    const items: MinimapItem[] = [];
    
    // Add Title Page to minimap (Index 0 in DOM)
    items.push({ title: "Title Page", index: 0 });

    let chunkId = 0;
    const splitRegex = /(?<=[.:]|\u05DB\u05D5['\u05F3])\s+/;
    const sectionMarkerRegex = /\([\u05D0-\u05EA]{1,2}\)/;

    paragraphs.forEach((p) => {
      const sentences = p.split(splitRegex);
      let currentText = "";
      
      sentences.forEach(sentence => {
        // Create a new chunk if current text gets too long
        if ((currentText.length + sentence.length) > 200 && currentText.length > 0) {
           
           // Check if this chunk starts a section to add to minimap
           const match = currentText.match(sectionMarkerRegex);
           if (match) {
              // DOM index is chunkId + 1 because of the Title Page at index 0
              items.push({ title: `Section ${chunkId + 1}`, index: chunkId + 1 });
           }

           newChunks.push({
             id: chunkId++,
             hebrew: currentText,
             translation: null,
             isLoading: false,
             context: p 
           });
           
           currentText = sentence;
        } else {
           currentText = currentText ? `${currentText} ${sentence}` : sentence;
        }
      });
      
      // Push remaining text
      if (currentText) {
        const match = currentText.match(sectionMarkerRegex);
        if (match) {
           items.push({ title: `Section ${chunkId + 1}`, index: chunkId + 1 });
        }

        newChunks.push({
          id: chunkId++,
          hebrew: currentText,
          translation: null,
          isLoading: false,
          context: p
        });
      }
    });

    setChunks(newChunks);
    setMinimapItems(items);
    
    // Construct context with markers for AI
    const markedContext = newChunks.map(c => `[Section ${c.id + 1}]: ${c.hebrew}`).join('\n\n');
    onContextUpdate(markedContext);

    // Fetch existing translations for this book and user
    const fetchTranslations = async () => {
      if (!currentBookId || !userId) return; // Only fetch if user is logged in and book is selected

      const { data, error } = await supabase
        .from('translations')
        .select('chunk_id, translated_content')
        .eq('user_id', userId)
        .eq('text_id', currentBookId)
        .eq('language', 'english'); // Assuming English translations for now

      if (error) {
        console.error('Error fetching translations:', error);
      } else if (data) {
        setChunks(prevChunks => 
          prevChunks.map(chunk => {
            const existingTranslation = data.find(t => t.chunk_id === chunk.id);
            return existingTranslation ? { ...chunk, translation: existingTranslation.translated_content } : chunk;
          })
        );
      }
    };

    fetchTranslations();

  }, [text, onContextUpdate, currentBookId, userId]);

  // Handle external scroll requests (e.g. from Citations)
  useEffect(() => {
    if (scrollToChunkId !== undefined && scrollToChunkId !== null && containerRef.current) {
        const targetIndex = scrollToChunkId;
        const elements = containerRef.current.children;
        if (elements[targetIndex]) {
            elements[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight effect
            elements[targetIndex].classList.add('bg-yellow-500/10');
            setTimeout(() => {
                elements[targetIndex].classList.remove('bg-yellow-500/10');
            }, 2000);
        }
    }
  }, [scrollToChunkId]);

  const handleGenerateTranslation = async (chunkIndex: number) => {
    const targetChunk = chunks[chunkIndex];
    if (!targetChunk.context || !currentBookId) return; // currentBookId is always present if Reader is rendered

    const paragraphIndices = chunks
      .map((c, i) => c.context === targetChunk.context ? i : -1)
      .filter(i => i !== -1);
    
    if (paragraphIndices.length === 0) return;

    setChunks(prev => prev.map((c, i) => paragraphIndices.includes(i) ? { ...c, isLoading: true } : c));

    try {
      const segments = paragraphIndices.map(i => chunks[i].hebrew);
      const translations = await translateParagraph(
        segments, 
        settings.apiKey || ""
      );
      
      setChunks(prev => prev.map((c, i) => {
        const segIdx = paragraphIndices.indexOf(i);
        if (segIdx !== -1 && translations[segIdx]) {
            // Save translation to Supabase ONLY if user is logged in
            if (userId) {
              supabase.from('translations').upsert({
                user_id: userId,
                text_id: currentBookId,
                chunk_id: c.id,
                language: 'english',
                translated_content: translations[segIdx],
              }, { onConflict: 'user_id, text_id, chunk_id, language' }).then(({ error }) => {
                if (error) console.error('Error saving translation:', error);
              });
            }
            return { ...c, translation: translations[segIdx], isLoading: false };
        }
        return c;
      }));
    } catch (e) {
      onError("Translation Error.");
      setChunks(prev => prev.map((c, i) => paragraphIndices.includes(i) ? { ...c, isLoading: false } : c));
    }
  };

  const handleScroll = useCallback(() => {
    if(selection) setSelection(null);
    if (containerRef.current) {
      const { scrollTop } = containerRef.current;
      // Rough estimation for minimap
      const index = Math.round(scrollTop / (window.innerHeight * 0.8)); 
      if (index >= 0 && index < chunks.length + 1) {
          setCurrentSection(index);
      }
    }
  }, [selection, chunks.length]);

  const scrollToSection = (index: number) => {
    if (containerRef.current) {
        const elements = containerRef.current.children;
        if (elements[index]) {
            elements[index].scrollIntoView({ behavior: 'smooth' });
        }
    }
  };

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: sel.toString(),
        rect: rect,
      });
    } else {
      setSelection(null);
    }
  }, []);

  const isHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

  const cleanMarkdown = (html: string | null) => {
    if(!html) return null;
    return html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  };

  // Mobile check for popup positioning
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Calculate Popup Position with Edge detection
  const getPopupStyle = () => {
    if (!selection || !selection.rect) return {};
    
    const popupWidth = 300; // Approx width of popup
    const screenWidth = window.innerWidth;
    
    // Calculate centered left
    let left = selection.rect.left + (selection.rect.width / 2);
    
    // Clamp to screen edges with 20px padding
    left = Math.max(popupWidth / 2 + 20, Math.min(screenWidth - popupWidth / 2 - 20, left));

    return {
       top: `${selection.rect.top - (isMobile ? 140 : 60)}px`,
       left: `${left}px`,
       transform: 'translateX(-50%)'
    };
  };
  
  // Text Alignment Classes
  const getAlignClass = (lang: 'hebrew' | 'english') => {
      if (settings.textAlign === 'center') return 'text-center';
      return lang === 'hebrew' ? 'text-right' : 'text-left';
  };

  return (
    <main 
      className={`
        flex-1 h-full relative transition-colors duration-500
        ${THEME_CLASSES[settings.theme]}
      `}
      onClick={() => isMenuOpen && onCloseMenu()}
    >
      <Minimap 
        currentChunkIndex={currentSection} 
        items={minimapItems}
        onItemClick={scrollToSection}
        theme={settings.theme}
        isVisible={isMenuOpen}
      />

      {/* Main Container */}
      <div 
        ref={containerRef}
        className="h-full overflow-y-scroll scroll-smooth no-scrollbar"
        onScroll={handleScroll}
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
      >
        {/* Title Page (Section 0) */}
        <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center">
            <h1 
              className={`font-bold opacity-80 tracking-wide leading-tight mb-8 ${isHebrew(title) ? 'font-hebrew-serif' : 'font-serif'}`}
              style={{ fontSize: `${settings.fontSize * 1.5}rem` }}
            >
              {title}
            </h1>
            <p className="opacity-40 text-xs font-sans uppercase tracking-[0.2em] animate-pulse">
              Scroll to Begin
            </p>
        </div>

        {/* Text Chunks (Sections 1..N) */}
        {chunks.map((chunk, idx) => {
          const isChunkHebrew = isHebrew(chunk.hebrew);
          
          return (
            <div 
              key={chunk.id} 
              className="min-h-screen flex items-center justify-center p-6 md:p-24 relative transition-colors duration-1000"
            >
               {/* Section Marker for Debug/Citation */}
               <div className="absolute top-4 right-4 opacity-5 text-[10px] uppercase font-sans">
                 Section {chunk.id + 1}
               </div>

               <div className="w-full max-w-5xl flex flex-col items-center gap-12">
                  
                  {/* Hebrew Text - Hide if mode is English */}
                  {settings.translationMode !== 'english' && (
                    <p 
                        dir="rtl"
                        className={`
                        font-hebrew-serif
                        ${getAlignClass('hebrew')} leading-loose transition-all duration-500 selection:bg-gray-200 selection:text-black dark:selection:bg-gray-800 dark:selection:text-white
                        max-w-2xl w-full mx-auto
                        `}
                        style={{ 
                        fontSize: `${settings.fontSize}rem`,
                        lineHeight: settings.lineHeight
                        }}
                    >
                        {chunk.hebrew}
                    </p>
                  )}
  
                  {/* Inline Translation */}
                  {(settings.translationMode === 'bilingual' || settings.translationMode === 'english') && (
                     <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500 relative group">
                       {chunk.isLoading ? (
                         <div className="flex justify-center gap-2">
                           <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                           <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-100"></div>
                           <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-200"></div>
                         </div>
                       ) : chunk.translation ? (
                         <>
                            <div 
                              className={`${getAlignClass('english')} font-serif text-xl leading-relaxed ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                              dangerouslySetInnerHTML={{ __html: cleanMarkdown(chunk.translation) || '' }}
                            />
                            {/* Feedback Button */}
                            <button 
                                className="absolute -right-12 top-0 p-2 opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-opacity"
                                title="Report Issue"
                                onClick={() => console.log('Report translation', chunk.id)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                                </svg>
                            </button>
                         </>
                       ) : (
                         <div className="flex justify-center">
                           {isChunkHebrew ? (
                             <button 
                               onClick={() => handleGenerateTranslation(idx)}
                               className="flex items-center gap-2 px-4 py-2 rounded-full border border-current opacity-20 hover:opacity-100 transition-opacity text-[10px] uppercase tracking-[0.2em]"
                             >
                               Translate Section
                             </button>
                           ) : (
                             <button 
                               onClick={onOpenLibrary}
                               className="flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors text-xs uppercase tracking-widest shadow-lg"
                             >
                               Open Library
                             </button>
                           )}
                         </div>
                       )}
                     </div>
                  )}
               </div>
            </div>
          );
        })}
        
        <div className="min-h-[50vh] flex items-center justify-center opacity-30 font-serif italic">
            End of Text
        </div>
      </div>

      {selection && (
        <div 
          className="fixed z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
          style={getPopupStyle()}
        >
           {/* Fixed styling for selector: Grey on White / Dark Grey on White */}
           <div className={`
             shadow-2xl rounded-2xl p-2 flex items-center gap-2 border
             bg-white text-gray-900 border-gray-200
             dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700
             whitespace-nowrap
           `}>
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onTextSelect(selection.text); 
                  onAskAI("Translate exactly: " + selection.text);
                  setSelection(null); 
              }}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-medium transition-colors"
            >
              Translate
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onTextSelect(selection.text);
                  onAskAI("Summarize this concept: " + selection.text);
                  setSelection(null); 
              }}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-medium transition-colors"
            >
              Summarize
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onTextSelect(selection.text);
                  onAskAI("Explain the deeper meaning of: " + selection.text);
                  setSelection(null); 
              }}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-medium transition-colors"
            >
              Explain
            </button>
          </div>
        </div>
      )}
    </main>
  );
};

export default Reader;