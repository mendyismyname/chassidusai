
import React from 'react';
import { Settings, Theme, TranslationMode } from '../types';

interface BottomNavProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
  toggleLibrary: () => void;
  toggleMenu: () => void;
  isMenuOpen: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  settings,
  onUpdateSettings,
  toggleLibrary,
  toggleMenu,
  isMenuOpen
}) => {
  
  const iconClass = settings.theme === 'dark' 
    ? 'text-gray-500 hover:text-gray-200' 
    : 'text-gray-400 hover:text-gray-900';
    
  // Cycle Translation Modes: Hebrew -> Bilingual -> English -> Hebrew
  const handleTranslateToggle = () => {
      const modes: TranslationMode[] = ['hebrew', 'bilingual', 'english'];
      const nextIdx = (modes.indexOf(settings.translationMode) + 1) % modes.length;
      onUpdateSettings({ translationMode: modes[nextIdx] });
  };
  
  // Cycle Font Size, AND toggle alignment on mobile if needed (handled by toggling both here for simplicity)
  const handleTextSizeClick = () => {
     // Text Size Cycle
     const sizes = [1.8, 2.2, 2.6, 3.0];
     const nextSizeIdx = (sizes.indexOf(settings.fontSize) + 1) % sizes.length;
     
     // Alignment Toggle logic: Center -> Justify (which usually means Left/Right in Reader logic)
     const nextAlign = settings.textAlign === 'center' ? 'justify' : 'center';

     onUpdateSettings({ 
         fontSize: sizes[nextSizeIdx],
         textAlign: nextAlign // Toggles alignment on every click along with size
     });
  };

  return (
    <div className="fixed bottom-8 left-8 z-40 flex items-center gap-6">
      
      {/* Library */}
      <button 
        onClick={toggleLibrary}
        className={`group relative p-2 transition-all duration-300 ${iconClass}`}
        title="Library"
      >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
      </button>

      {/* Divider */}
      <div className={`h-4 w-px ${settings.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-300'}`}></div>

      {/* Menu / Scroll Toggle */}
      <button 
        onClick={toggleMenu}
        className={`group relative p-2 transition-all duration-300 ${iconClass} ${isMenuOpen ? (settings.theme === 'dark' ? 'text-gray-100' : 'text-gray-900') : ''}`}
        title="Contents"
      >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
      </button>

      {/* Text Size & Alignment */}
      <button 
        onClick={handleTextSizeClick}
        className={`group relative p-2 transition-all duration-300 ${iconClass}`}
        title="Text Size & Alignment"
      >
          <span className="font-serif text-xl leading-none">Aa</span>
      </button>

      {/* Theme */}
      <button 
        onClick={() => {
          const themes: Theme[] = ['light', 'sepia', 'dark'];
          const nextIndex = (themes.indexOf(settings.theme) + 1) % themes.length;
          onUpdateSettings({ theme: themes[nextIndex] });
        }}
        className={`group relative p-2 transition-all duration-300 ${iconClass}`}
        title="Theme"
      >
        <div className={`w-4 h-4 rounded-full border border-current ${settings.theme === 'dark' ? 'bg-gray-800' : settings.theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'}`}></div>
      </button>

       {/* Inline Translation Toggle (3-State) */}
      <button 
        onClick={handleTranslateToggle}
        className={`group relative p-2 transition-all duration-300 flex items-center justify-center ${iconClass} ${settings.translationMode !== 'hebrew' ? 'opacity-100' : 'opacity-50'}`}
        title={`Translation: ${settings.translationMode}`}
      >
         {/* Icon changes based on state slightly to indicate mode */}
         {settings.translationMode === 'english' ? (
             <span className="font-serif font-bold text-sm">EN</span>
         ) : settings.translationMode === 'hebrew' ? (
             <span className="font-hebrew-serif font-bold text-sm">אב</span>
         ) : (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
             </svg>
         )}
      </button>

    </div>
  );
};

export default BottomNav;
