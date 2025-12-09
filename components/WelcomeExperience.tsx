import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Settings, Theme } from '../types';
import { THEME_CLASSES } from '../constants';
import { User } from '@supabase/supabase-js'; // Import User type

interface WelcomeExperienceProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
  onOpenLibrary: () => void;
  onOpenProfile: () => void;
  onStartLearning: () => void;
  onOpenLogin: () => void; // New prop
  user: User | null; // New prop
}

// Extended mock data for the library preview
const LIBRARY_PREVIEW = [
    { t: 'Baal Shem Tov', author: 'R. Yisrael ben Eliezer', date: '1700s', purpose: 'Foundational', desc: 'The origins of Chassidic thought and mysticism.', p: 0 },
    { t: 'Likutei Amarim', author: 'Alter Rebbe', date: '1796', purpose: 'Fundamental', desc: 'The systematic guide to serving God with intellect and emotion.', p: 45 },
    { t: 'Toras Chaim', author: 'Mitteler Rebbe', date: '1826', purpose: 'Deep Analysis', desc: 'Profound expounding on the nature of soul and Divinity.', p: 12 },
    { t: 'Derech Mitzvosecha', author: 'Tzemach Tzedek', date: '1850s', purpose: 'Mitzvos', desc: 'Explaining the reasons behind the commandments.', p: 0 }
];

const WelcomeExperience: React.FC<WelcomeExperienceProps> = ({ settings, onUpdateSettings, onOpenLibrary, onOpenProfile, onStartLearning, onOpenLogin, user }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [mounted, setMounted] = useState(false);

  // --- HERO STATE ---
  // Phase 0: Title Center
  // Phase 1: Title Moves Up, Hebrew Fades In
  const [heroPhase, setHeroPhase] = useState<0 | 1>(0);

  // Simulation Steps for Hebrew Explanation
  const [simStep, setSimStep] = useState(0);
  const [isManualInteraction, setIsManualInteraction] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<'oros' | 'keilim' | null>(null);

  // --- DEMO STATES ---
  const [demoTheme, setDemoTheme] = useState<Theme>('light');
  const [demoFontSize, setDemoFontSize] = useState(2.2);
  const [demoTranslationActive, setDemoTranslationActive] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasTriggeredTranslation, setHasTriggeredTranslation] = useState(false);

  // --- CHAT ANIMATION STATE ---
  const [chatStep, setChatStep] = useState(0); 
  const [chatInputText, setChatInputText] = useState("");

  // Trigger animations on mount
  useEffect(() => {
    setMounted(true);
    
    // Hero Sequence
    setTimeout(() => setHeroPhase(1), 2500); 
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop } = containerRef.current;
      // Use full viewport height for section calculation to align with min-h-screen
      const index = Math.round(scrollTop / window.innerHeight);
      setActiveSection(index);
    }
  }, []);

  const scrollToSection = (index: number) => {
    if (containerRef.current) {
        const elements = containerRef.current.children;
        if (elements[index]) {
            elements[index].scrollIntoView({ behavior: 'smooth' });
        }
    }
  };

  // --- HERO SIMULATION LOOP ---
  useEffect(() => {
    if (isManualInteraction || heroPhase !== 1) return;

    let timeout: ReturnType<typeof setTimeout>;
    const runStep = (step: number) => {
        setSimStep(step);
        let duration = 1000;
        
        switch (step) {
            case 0: duration = 2500; break; // Long Idle
            case 1: duration = 800; break;  // Highlight Oros
            case 2: duration = 1500; break; // Menu Oros
            case 3: duration = 8000; break; // Card Oros
            case 4: duration = 1000; break; // Clear
            case 5: duration = 800; break;  // Highlight Keilim
            case 6: duration = 1500; break; // Menu Keilim
            case 7: duration = 8000; break; // Card Keilim
        }

        timeout = setTimeout(() => {
            runStep((step + 1) % 8);
        }, duration);
    };

    const startTimeout = setTimeout(() => runStep(0), 1000);
    return () => {
        clearTimeout(timeout);
        clearTimeout(startTimeout);
    };
  }, [isManualInteraction, heroPhase]);

  const handleManualSelect = (term: 'oros' | 'keilim') => {
    setIsManualInteraction(true);
    // When hovering/clicking word, show Menu (Step 2 or 6) and Hide Card (Step 3 or 7)
    if (term === 'oros') {
        setSimStep(2); 
    } else {
        setSimStep(6); 
    }
  };
  
  const handleExplain = (term: 'oros' | 'keilim') => {
      setIsManualInteraction(true);
      if (term === 'oros') {
          setSimStep(3);
      } else {
          setSimStep(7);
      }
  };

  const handleCloseSheet = () => {
      if (simStep === 3) setSimStep(4);
      if (simStep === 7) setSimStep(0);
  };

  // --- IMMERSIVE READING CYCLE ---
  useEffect(() => {
     if (activeSection !== 1) return;

     const themes: Theme[] = ['light', 'sepia', 'dark'];
     const sizes = [1.8, 2.2, 2.6];
     let tIdx = 0;
     
     const interval = setInterval(() => {
        // Only auto-cycle if we haven't manually intervened on size? 
        // For simplicity, we keep theme cycling but let size stay if user clicked.
        tIdx = (tIdx + 1) % themes.length;
        setDemoTheme(themes[tIdx]);
        // We sync size to theme for the demo unless user overrides (not implemented here fully to keep simple)
        // setDemoFontSize(sizes[tIdx]); 
     }, 3000);

     return () => clearInterval(interval);
  }, [activeSection]);

  const handleDemoSizeClick = () => {
    const sizes = [1.8, 2.2, 2.6, 3.0];
    const nextIdx = (sizes.indexOf(demoFontSize) + 1) % sizes.length;
    setDemoFontSize(sizes[nextIdx]);
  };

  // --- TRANSLATION TRIGGER ---
  useEffect(() => {
     if (activeSection === 2 && !hasTriggeredTranslation) {
        setHasTriggeredTranslation(true);
        setTimeout(() => {
           handleDemoTranslate();
        }, 500);
     }
  }, [activeSection, hasTriggeredTranslation]);

  // --- CHAT SIMULATION LOOP ---
  useEffect(() => {
     let timeout: ReturnType<typeof setTimeout>;
     let typeInterval: ReturnType<typeof setInterval>;

     const targetText = "Explain the relationship between Lights (Oros) and Vessels (Keilim).";
     
     const runChat = (step: number) => {
        setChatStep(step);
        
        if (step === 1) {
            // Typing Animation
            let charIndex = 0;
            setChatInputText("");
            typeInterval = setInterval(() => {
                charIndex++;
                setChatInputText(targetText.substring(0, charIndex));
                if (charIndex >= targetText.length) {
                    clearInterval(typeInterval);
                    timeout = setTimeout(() => runChat(2), 600);
                }
            }, 30); // Typing speed
        } else {
            // Other Steps
            let duration = 2000;
            switch(step) {
                case 0: duration = 2500; setChatInputText(""); break; // Idle
                case 2: duration = 500; setChatInputText(""); break; // Send delay
                case 3: duration = 1500; break; // Thinking
                case 4: duration = 2000; break; // Response Pt 1
                case 5: duration = 3000; break; // Response Pt 2
                case 6: duration = 4000; break; // Followups
            }
            timeout = setTimeout(() => {
                runChat((step + 1) % 7);
            }, duration);
        }
     };

     if (activeSection === 3) {
         runChat(0);
     }
     
     return () => {
        clearTimeout(timeout);
        if (typeInterval) clearInterval(typeInterval);
     };
  }, [activeSection]);

  const handleDemoTranslate = () => {
    setIsTranslating(true);
    setTimeout(() => {
        setIsTranslating(false);
        setDemoTranslationActive(true);
    }, 1500);
  };

  const isDark = settings.theme === 'dark';
  const accentColor = isDark ? 'text-gray-500' : 'text-gray-400';
  const borderColor = isDark ? 'border-white/10' : 'border-black/10';
  
  const cardBg = isDark ? 'bg-[#111]' : 'bg-white';
  const cardBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const cardShadow = isDark ? 'shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]' : 'shadow-2xl';

  // Explicit demo box styling to fix contrast issues
  const getDemoBoxClass = (t: Theme) => {
      switch(t) {
          case 'dark': return 'bg-white/5 border-white/10 text-gray-200';
          case 'sepia': return 'bg-[#e3d5b0]/30 border-[#d8cba8] text-[#5b4636]';
          default: return 'bg-gray-100 border-gray-200 text-gray-900';
      }
  };

  // Selection Menu Component (Simulated)
  const SelectionMenu = ({ visible, activeAction, onExplain }: { visible: boolean, activeAction?: string, onExplain: () => void }) => (
    <div className={`
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-0.5 p-1 rounded-xl shadow-2xl border z-50 transition-all duration-300 font-sans cursor-default
        ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
        md:scale-100 scale-90
    `} onClick={(e) => e.stopPropagation()}>
        <div className="px-2 md:px-3 py-1.5 text-[8px] md:text-[10px] font-bold uppercase tracking-wider opacity-50 whitespace-nowrap">Translate</div>
        <div className={`w-px h-3 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
        <div className="px-2 md:px-3 py-1.5 text-[8px] md:text-[10px] font-bold uppercase tracking-wider opacity-50 whitespace-nowrap">Summarize</div>
        <div className={`w-px h-3 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
        <div 
           onClick={onExplain}
           className={`
             px-2 md:px-3 py-1.5 text-[8px] md:text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer 
             ${activeAction === 'Explain' ? (isDark ? 'bg-white text-black' : 'bg-black text-white') : 'opacity-80 hover:bg-black/5 dark:hover:bg-white/10 hover:opacity-100'}
           `}
        >
            Explain
        </div>
    </div>
  );

  return (
    <main 
      className={`
        flex-1 h-full relative transition-colors duration-500 overflow-hidden
        ${THEME_CLASSES[settings.theme]}
      `}
    >
      {/* Navigation Dots - Hidden on Mobile */}
      <div className="hidden md:flex fixed left-8 top-1/2 transform md:-translate-y-1/2 z-30 flex-col gap-4">
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <button
            key={idx}
            onClick={() => scrollToSection(idx)}
            className={`
              w-1.5 h-1.5 rounded-full transition-all duration-300
              ${activeSection === idx ? 'bg-current scale-150' : 'bg-current opacity-20 hover:opacity-50'}
            `}
          />
        ))}
      </div>

      <div 
        ref={containerRef}
        className="h-full overflow-y-scroll scroll-smooth no-scrollbar"
        onScroll={handleScroll}
      >
        {/* SECTION 1: HERO */}
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            
            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl h-[500px] justify-center">
                
                {/* Title Container */}
                <div 
                    className={`
                        hidden md:flex flex-col items-center mb-8 absolute left-1/2 transform -translate-x-1/2 transition-all duration-1000 ease-in-out
                        ${heroPhase >= 1 ? 'top-[20%] scale-75' : 'top-1/2 -translate-y-1/2 scale-100'}
                    `}
                >
                    <h1 className="flex items-baseline font-serif text-6xl md:text-9xl font-bold tracking-tight">
                        <span className={`transition-all duration-1000 ${mounted ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>chassidus</span>
                        <div className={`relative w-2 h-2 md:w-4 md:h-4 mx-1 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}>
                            <div className={`
                                absolute inset-0 rounded-full transition-colors duration-[2000ms] ease-in-out
                                ${mounted ? 'bg-white border-transparent' : 'bg-black border-transparent'}
                                ${isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'shadow-md'}
                            `}></div>
                            <div className={`absolute inset-[-4px] rounded-full border animate-ping ${isDark ? 'border-white/20' : 'border-blue-500/20'}`}></div>
                        </div>
                        <span className={`transition-all duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>ai</span>
                    </h1>
                </div>

                {/* Hebrew Text - Fades in below title, positioned closer to title */}
                <div 
                    className={`
                        absolute top-[39%] w-full overflow-visible z-10 transition-all duration-1000
                        ${heroPhase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                    `}
                >
                    <h2 
                        className={`
                            font-hebrew-serif text-3xl md:text-5xl tracking-wide cursor-default whitespace-nowrap flex justify-center items-center gap-4
                            ${isDark ? 'text-gray-600' : 'text-gray-300'}
                        `}
                        dir="rtl"
                    >
                        <span 
                            onClick={(e) => { e.stopPropagation(); handleManualSelect('oros'); }}
                            onMouseEnter={() => { setHoveredWord('oros'); handleManualSelect('oros'); }}
                            onMouseLeave={() => setHoveredWord(null)}
                            className={`transition-all duration-500 rounded-lg px-2 py-1 relative cursor-pointer hover:bg-blue-500/5 hover:text-blue-500/50 ${(simStep >= 1 && simStep <= 3) ? 'bg-blue-500/10 text-blue-500/60' : ''}`}
                        >
                            אורות דתוהו
                            {/* Selection Menu Oros */}
                            <SelectionMenu 
                                visible={simStep === 2 || (hoveredWord === 'oros' && simStep !== 3)} 
                                activeAction={simStep === 2 ? undefined : undefined} 
                                onExplain={() => handleExplain('oros')}
                            />
                        </span>
                        
                        <span 
                            onClick={(e) => { e.stopPropagation(); handleManualSelect('keilim'); }}
                            onMouseEnter={() => { setHoveredWord('keilim'); handleManualSelect('keilim'); }}
                            onMouseLeave={() => setHoveredWord(null)}
                            className={`transition-all duration-500 rounded-lg px-2 py-1 relative cursor-pointer hover:bg-blue-500/5 hover:text-blue-500/50 ${(simStep >= 5 && simStep <= 7) ? 'bg-blue-500/10 text-blue-500/60' : ''}`}
                        >
                            כלים דתיקון
                            {/* Selection Menu Keilim */}
                            <SelectionMenu 
                                visible={simStep === 6 || (hoveredWord === 'keilim' && simStep !== 7)} 
                                activeAction={simStep === 6 ? undefined : undefined} 
                                onExplain={() => handleExplain('keilim')}
                            />
                        </span>
                    </h2>
                    
                    <p className={`mt-8 text-[10px] uppercase tracking-[0.3em] font-sans opacity-30 animate-pulse transition-all duration-1000 delay-500 ${heroPhase >= 1 ? 'translate-y-0 opacity-30' : 'translate-y-4 opacity-0'}`}>
                        Scroll to continue
                    </p>
                </div>

                {/* --- MOBILE HALF-SHEET (Portal-like behavior at z-[60] to cover nav) --- */}
                {/* Shows only on mobile (block md:hidden) when a card is active */}
                {(simStep === 3 || simStep === 7) && (
                  <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
                      {/* Backdrop */}
                      <div 
                         className="absolute inset-0 bg-black/60 animate-in fade-in duration-500"
                         onClick={handleCloseSheet}
                      ></div>
                      
                      {/* Sheet */}
                      <div className={`
                         relative w-full rounded-t-2xl p-8 pb-32 animate-in slide-in-from-bottom duration-500 border-t
                         ${cardBg} ${cardBorder}
                      `}>
                         <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Explain</span>
                            <div className={`h-px flex-1 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                         </div>
                         
                         {simStep === 3 ? (
                           <>
                             <p className={`font-serif text-2xl mb-3 font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Lights of Tohu</p>
                             <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Analogy: <b>Artificial Intelligence</b>.</p>
                             <p className={`text-sm leading-relaxed mt-2 opacity-70`}>
                               High energy, raw potential, and vast knowledge, but unstable and prone to "shattering" without structure. In Kabbalah, Oros of Tohu were too intense for their vessels.
                             </p>
                           </>
                         ) : (
                           <>
                             <p className={`font-serif text-2xl mb-3 font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Vessels of Tikun</p>
                             <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Analogy: <b>Torah & Mitzvos</b>.</p>
                             <p className={`text-sm leading-relaxed mt-2 opacity-70`}>
                               Holy containers for experiencing Kedusha. Like a precise recipe that gives form to raw ingredients, Mitzvos provide the structure to safely channel the Infinite Light, transforming chaos into order.
                             </p>
                           </>
                         )}
                         {/* Extra whitespace at bottom */}
                         <div className="h-4"></div>
                      </div>
                  </div>
                )}


                {/* --- DESKTOP CARDS --- */}
                {/* Positioned absolutely within the container, hidden on mobile */}
                <div 
                   className={`
                      hidden md:block absolute top-[46%] left-1/2
                      w-full max-w-xl z-20
                      transform -translate-x-1/2 -translate-y-1/2
                      pointer-events-none
                   `}
                >
                     {/* Oros Card */}
                     <div 
                        className={`
                            absolute top-0 left-0 w-full p-8 rounded-2xl border text-left transition-all duration-700 ease-out pointer-events-auto
                            ${cardBg} ${cardBorder} ${cardShadow}
                            ${simStep === 3 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}
                        `}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Explain</span>
                            <div className={`h-px flex-1 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                            <button onClick={() => setSimStep(4)} className="opacity-30 hover:opacity-100"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                        </div>
                        <p className={`font-serif text-2xl mb-3 font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Lights of Tohu</p>
                        <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Analogy: <b>Artificial Intelligence</b>.</p>
                        <p className={`text-sm leading-relaxed mt-2 opacity-70`}>
                            High energy, raw potential, and vast knowledge, but unstable and prone to "shattering" without structure. In Kabbalah, Oros of Tohu were too intense for their vessels.
                        </p>
                    </div>

                    {/* Keilim Card */}
                    <div 
                        className={`
                            absolute top-0 left-0 w-full p-8 rounded-2xl border text-left transition-all duration-700 ease-out pointer-events-auto
                            ${cardBg} ${cardBorder} ${cardShadow}
                            ${simStep === 7 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}
                        `}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Explain</span>
                            <div className={`h-px flex-1 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                            <button onClick={() => setSimStep(0)} className="opacity-30 hover:opacity-100"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                        </div>
                        <p className={`font-serif text-2xl mb-3 font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Vessels of Tikun</p>
                        <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Analogy: <b>Torah & Mitzvos</b>.</p>
                        <p className={`text-sm leading-relaxed mt-2 opacity-70`}>
                            Holy containers for experiencing Kedusha. Like a precise recipe that gives form to raw ingredients, Mitzvos provide the structure to safely channel the Infinite Light, transforming chaos into order.
                        </p>
                    </div>
                </div>

            </div>
            
            <div className={`absolute bottom-12 animate-bounce opacity-20 transition-opacity duration-1000 ${heroPhase >= 1 ? 'opacity-20' : 'opacity-0'}`}>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
               </svg>
            </div>
        </div>

        {/* SECTION 2: IMMERSIVE READING DEMO */}
        <div className={`min-h-screen flex items-center justify-center p-8 md:p-24 relative transition-colors duration-1000 ${THEME_CLASSES[demoTheme]}`}>
             <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                 <div className="space-y-6">
                    <h2 className="font-serif text-3xl md:text-4xl">Immersive Reading</h2>
                    <p className={`text-lg leading-relaxed font-serif opacity-70`}>
                      The interface recedes, leaving only you and the text. Customize your environment to match your state of mind.
                    </p>
                    
                    {/* Interactive Controls */}
                    <div className="flex items-center gap-4 pt-4">
                       {(['light', 'sepia', 'dark'] as Theme[]).map(t => (
                        <button
                          key={t}
                          onClick={() => { setDemoTheme(t); }}
                          className={`
                            w-10 h-10 rounded-full border transition-all duration-300
                            ${t === 'light' ? 'bg-white border-gray-300' : ''}
                            ${t === 'sepia' ? 'bg-[#f4ecd8] border-[#d8cba8]' : ''}
                            ${t === 'dark' ? 'bg-[#050505] border-gray-600' : ''}
                            ${demoTheme === t ? 'ring-2 ring-offset-2 ring-current scale-110' : 'opacity-40 hover:opacity-100'}
                          `}
                        />
                       ))}
                       
                       <div className={`w-px h-8 bg-current opacity-20 mx-2`}></div>
                       
                       <button 
                          onClick={handleDemoSizeClick}
                          className={`w-10 h-10 flex items-center justify-center rounded-lg border border-current opacity-50 hover:opacity-100 transition-opacity`}
                        >
                            <span className="font-serif text-xl leading-none">Aa</span>
                        </button>
                    </div>
                 </div>

                 {/* Live Preview - With Explicit Colors */}
                 <div className={`flex items-center justify-center p-12 rounded-2xl border transition-all duration-500 ease-in-out ${getDemoBoxClass(demoTheme)}`}>
                    <p 
                      className="font-hebrew-serif text-center leading-relaxed transition-all duration-500 ease-in-out"
                      style={{ fontSize: `${demoFontSize}rem` }}
                    >
                      חסידות היא הנשמה של התורה, המגלה את האלוקות שבכל דבר
                    </p>
                 </div>
             </div>
        </div>

        {/* SECTION 3: TRANSLATION DEMO */}
        <div className="min-h-screen flex items-center justify-center p-8 md:p-24 relative">
             <div className="w-full max-w-5xl flex flex-col items-center text-center">
                 <div className="max-w-2xl mb-16">
                    <h2 className={`font-serif text-xl md:text-2xl mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Instant, context-aware translation for Hebrew and Aramaic.
                    </h2>
                 </div>

                 {/* Demo Component */}
                 <div className="w-full max-w-4xl flex flex-col items-center gap-8 relative group">
                     <p 
                       className="font-hebrew-serif text-center leading-loose transition-all duration-500"
                       style={{ fontSize: `${settings.fontSize}rem` }}
                      >
                       והנה, להבין כל זה באורכה ורוחבה, נבאר תחלה ענין ההפרש שבין אורות לכלים
                     </p>
                     
                     <div className="relative w-full flex flex-col items-center min-h-[120px] justify-start">
                        {!demoTranslationActive ? (
                            <button 
                              onClick={handleDemoTranslate}
                              disabled={isTranslating}
                              className="flex items-center gap-3 px-6 py-3 rounded-full opacity-40 hover:opacity-100 transition-all text-[10px] uppercase tracking-[0.2em]"
                            >
                              {isTranslating ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-100"></div>
                                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce delay-200"></div>
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502" />
                                  </svg>
                                  <span>Translate Section</span>
                                </>
                              )}
                            </button>
                        ) : (
                          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center">
                              <div className={`text-center font-serif text-xl leading-relaxed max-w-2xl ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                And behold, to understand all this in its <b>length</b> and <b>breadth</b>, we will first explain the matter of the difference between <b>Lights</b> and <b>Vessels</b>.
                              </div>
                              <button 
                                onClick={() => setDemoTranslationActive(false)}
                                className="mt-6 opacity-30 hover:opacity-100 transition-opacity text-[10px] uppercase tracking-widest"
                              >
                                Hide
                              </button>
                          </div>
                        )}
                     </div>
                 </div>
             </div>
        </div>

        {/* SECTION 4: AI INTELLIGENCE DEMO */}
        <div className="min-h-screen flex items-center justify-center p-8 relative">
             <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                
                {/* Text Content */}
                <div className="order-1 space-y-6">
                   <h2 className="font-serif text-3xl md:text-4xl">Your Personal Chavrusa</h2>
                   <p className={`text-lg leading-relaxed ${accentColor} font-serif`}>
                      Ask questions, get summaries, and explore concepts. The AI scholar is grounded in the text, providing citations for every insight.
                   </p>
                   <ul className={`space-y-4 pt-4 ${accentColor} font-serif`}>
                      <li className="flex items-center gap-3">
                        <span className="w-1 h-1 rounded-full bg-current"></span>
                        Click citations to jump to source
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1 h-1 rounded-full bg-current"></span>
                        Context-aware responses
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1 h-1 rounded-full bg-current"></span>
                        Deep Kabbalistic definitions
                      </li>
                   </ul>
                </div>

                {/* Mock AI Panel */}
                <div className="order-2">
                   <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200 shadow-2xl'}`}>
                       <div className={`h-12 border-b flex items-center px-4 gap-2 ${isDark ? 'border-gray-800 bg-[#151515]' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <div className="text-[10px] uppercase tracking-widest opacity-40">Scholar AI</div>
                       </div>
                       
                       <div className="p-6 space-y-6 font-sans text-sm min-h-[450px] flex flex-col relative">
                          
                          {/* Messages Area - Top Aligned */}
                          <div className="flex-1 space-y-4 overflow-hidden flex flex-col justify-start">
                            
                            {/* Suggestions (Initially visible) */}
                            <div className={`flex flex-col gap-2 transition-all duration-500 ${chatStep > 0 ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                                <p className="text-center font-serif opacity-40 mb-2">How can I help?</p>
                                {["Explain Oros vs Keilim", "Summarize this page"].map((s,i) => (
                                    <div key={i} className={`p-3 rounded-xl border text-center opacity-60 text-xs ${borderColor} cursor-pointer hover:opacity-100`}>{s}</div>
                                ))}
                            </div>

                            {/* User Message */}
                            {chatStep >= 2 && (
                                <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className={`
                                      p-4 rounded-xl text-center italic w-full border
                                      ${isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-gray-50 border-black/5 text-gray-800'}
                                    `}>
                                        Explain the relationship between Lights (Oros) and Vessels (Keilim).
                                    </div>
                                </div>
                            )}

                            {/* Scholar Response */}
                            {chatStep >= 3 && (
                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="text-[10px] uppercase tracking-widest opacity-40">Scholar</div>
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        {chatStep === 3 ? (
                                            <div className="flex gap-1 py-2">
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-50"></div>
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-100 opacity-50"></div>
                                                <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-200 opacity-50"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                                                    <b>Lights</b> (Oros) represent raw, infinite Divine energy <b>[Section 1]</b>. In the world of <b>Tohu</b> (Chaos), these lights were too intense for their containers.
                                                </p>
                                                {chatStep >= 5 && (
                                                    <p className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                                                        <b>Vessels</b> (Keilim) represent structure and limitation <b>[Section 2]</b>. In <b>Tikun</b> (Rectification), the vessels are broad enough to contain the lights, allowing for stable existence.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                             {/* Followups */}
                             {chatStep >= 6 && (
                                <div className="flex flex-col gap-2 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="text-[10px] uppercase tracking-widest opacity-30">Suggested Follow-up</div>
                                    {["What caused the shattering?", "How do we fix it?"].map((s,i) => (
                                        <div key={i} className={`p-2 rounded-lg border text-left opacity-60 text-xs ${borderColor} hover:opacity-100`}>{s}</div>
                                    ))}
                                </div>
                             )}

                          </div>

                          {/* Input Area Match - Grey, Centered, Stick to bottom relative to container */}
                          <div className="mt-auto pt-4 flex justify-center w-full z-10">
                            <div className={`
                              w-full flex items-center gap-2 px-4 py-3 rounded-2xl transition-colors duration-300
                              ${isDark ? 'bg-white/5' : 'bg-gray-100'}
                              ${chatStep === 1 ? 'ring-1 ring-blue-500/50' : ''}
                            `}>
                                <div className="w-px h-4 bg-current opacity-10 mx-2"></div>
                                <div className={`flex-1 text-sm text-center ${chatInputText ? 'opacity-100' : 'opacity-30'}`}>
                                    {chatInputText || (chatStep === 0 ? "Ask..." : "")}
                                    {chatStep === 1 && <span className="animate-pulse">|</span>}
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${chatInputText ? 'bg-blue-500 text-white' : 'opacity-20 bg-current'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 004.82 9.25h8.179a.5.5 0 010 1H4.82a1.5 1.5 0 00-1.127 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                                    </svg>
                                </div>
                            </div>
                          </div>
                          
                       </div>
                   </div>
                </div>

             </div>
        </div>

        {/* SECTION 5: LIBRARY */}
        <div className="min-h-screen flex flex-col items-center justify-center p-8 relative">
             <div className="w-full max-w-7xl text-center space-y-16">
                
                {/* Library Preview */}
                <div className="space-y-8">
                    <div>
                        <h2 className="font-serif text-3xl mb-2">The Library</h2>
                        <p className={`text-sm uppercase tracking-widest opacity-40 font-sans`}>A Growing Collection of Wisdom</p>
                    </div>
                    
                    <p className={`max-w-xl mx-auto text-base leading-relaxed opacity-60 font-serif`}>
                        Track your progress across hundreds of fundamental texts. The library is constantly updated with new maamarim, sichos, and classic works, providing a lifetime of study material.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-80 hover:opacity-100 transition-opacity duration-500">
                        {LIBRARY_PREVIEW.map((book, i) => (
                            <div 
                              key={i} 
                              onClick={onOpenLibrary}
                              className={`
                                cursor-pointer p-6 rounded-xl border font-serif ${borderColor} relative overflow-hidden group text-left hover:shadow-lg transition-all h-full flex flex-col justify-between
                              `}
                            >
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                       <span className="text-[10px] uppercase tracking-widest opacity-50 font-sans">{book.date}</span>
                                       <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-sans ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>{book.purpose}</span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-1">{book.t}</h3>
                                    <p className="text-sm italic opacity-70 mb-4">{book.author}</p>
                                    <p className={`text-sm leading-relaxed opacity-60 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {book.desc}
                                    </p>
                                </div>
                                <div className="relative z-10 mt-6 flex justify-between items-end">
                                    <span className="text-[10px] font-sans opacity-40 group-hover:opacity-100 transition-opacity">READ</span>
                                    {book.p > 0 && <span className="text-[10px] opacity-50 font-sans">{book.p}% Completed</span>}
                                </div>
                                {book.p > 0 && (
                                    <div 
                                        className={`absolute bottom-0 left-0 h-1 ${isDark ? 'bg-white/20' : 'bg-black/10'}`} 
                                        style={{ width: `${book.p}%` }}
                                    ></div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex flex-col items-center gap-4 mt-12 pt-12">
                        <button 
                            onClick={onOpenLibrary}
                            className={`text-[10px] font-bold uppercase tracking-widest border-b border-current pb-1 hover:opacity-50 transition-opacity`}
                        >
                            Explore Full Catalog
                        </button>
                        <button 
                            onClick={onStartLearning}
                            className={`
                                px-8 py-4 rounded-full font-bold uppercase tracking-[0.2em] text-xs transition-all shadow-xl hover:scale-105
                                ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}
                            `}
                        >
                            Start Learning
                        </button>
                        {!user && (
                          <button 
                            onClick={onOpenLogin}
                            className={`
                                px-8 py-4 rounded-full font-bold uppercase tracking-[0.2em] text-xs transition-all shadow-xl hover:scale-105
                                ${isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
                            `}
                          >
                              Log In
                          </button>
                        )}
                    </div>
                </div>

             </div>
        </div>

        {/* SECTION 6: SUPPORT & DONATE */}
        <div className={`py-24 px-8 border-t ${borderColor} text-center`}>
            <div className="max-w-2xl mx-auto space-y-12">
                
                <div className="space-y-6">
                    <h3 className="font-serif text-2xl">Open Source & Community Driven</h3>
                    <p className={`text-sm md:text-base leading-loose ${accentColor} font-serif`}>
                    This project is dedicated to making the depth of Chassidus accessible to everyone. 
                    We rely on community support to maintain servers and improve our models.
                    </p>
                    <button className="px-8 py-3 rounded-lg border border-current text-[10px] font-bold uppercase tracking-widest hover:bg-current hover:text-white dark:hover:text-black transition-all">
                        Donate
                    </button>
                </div>

                <div className={`w-24 h-px mx-auto ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>

                <div className="space-y-4">
                    <p className={`text-sm ${accentColor} max-w-md mx-auto`}>
                        <b>Bring Your Own Key.</b> To keep this tool free and open-source, we require users to provide their own Google Gemini API Key. It is free for personal use and ensures unlimited access.
                    </p>
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block text-[10px] font-bold uppercase tracking-widest border-b border-current pb-1 hover:opacity-50 transition-opacity"
                    >
                        How to get a free API Key
                    </a>
                </div>

                <div className={`pt-12 text-[10px] uppercase tracking-widest ${accentColor} opacity-30`}>
                chassidus.ai &copy; 2024
                </div>
            </div>
        </div>

      </div>
    </main>
  );
};

export default WelcomeExperience;