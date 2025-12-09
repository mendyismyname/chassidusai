import React, { useState, useEffect, useRef } from 'react';
import { Settings, Theme } from '../types';

interface ControlsProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
  toggleLibrary: () => void;
  isLibraryOpen: boolean;
}

const Controls: React.FC<ControlsProps> = ({ settings, onUpdateSettings, toggleLibrary, isLibraryOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-30 flex items-center justify-between px-4 md:px-8 bg-transparent pointer-events-none">
      
      {/* Settings Toggle */}
      <div className="pointer-events-auto relative" ref={menuRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`
            p-2 rounded-full shadow-sm backdrop-blur-sm border transition-all
            ${settings.theme === 'dark' ? 'bg-gray-800/80 border-gray-700 text-gray-200' : settings.theme === 'sepia' ? 'bg-[#efe6ce]/80 border-[#d8cba8] text-[#5b4636]' : 'bg-white/80 border-gray-200 text-gray-700'}
          `}
          aria-label="Appearance Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className={`
            absolute top-12 left-0 w-64 rounded-xl shadow-2xl p-4 border
            ${settings.theme === 'dark' ? 'bg-[#222] border-gray-700 text-gray-200' : settings.theme === 'sepia' ? 'bg-[#f8f1e0] border-[#d8cba8] text-[#5b4636]' : 'bg-white border-gray-200 text-gray-800'}
          `}>
            
            {/* Font Size */}
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-wider opacity-70 mb-2">Text Size</label>
              <div className="flex items-center gap-2">
                <span className="text-sm">A</span>
                <input 
                  type="range" 
                  min="1.2" 
                  max="3" 
                  step="0.1" 
                  value={settings.fontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: parseFloat(e.target.value) })}
                  className="flex-1 accent-current cursor-pointer h-1 rounded-lg appearance-none bg-gray-200 dark:bg-gray-700"
                />
                <span className="text-xl">A</span>
              </div>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs uppercase tracking-wider opacity-70 mb-2">Theme</label>
              <div className="flex gap-2">
                {(['light', 'sepia', 'dark'] as Theme[]).map(t => (
                  <button
                    key={t}
                    onClick={() => onUpdateSettings({ theme: t })}
                    className={`
                      flex-1 h-10 rounded-lg border-2 transition-all
                      ${t === 'light' ? 'bg-white border-gray-200' : ''}
                      ${t === 'sepia' ? 'bg-[#f4ecd8] border-[#e3d5b0]' : ''}
                      ${t === 'dark' ? 'bg-[#333] border-gray-600' : ''}
                      ${settings.theme === t ? 'ring-2 ring-offset-2 ring-blue-500 border-transparent' : ''}
                    `}
                    aria-label={`${t} theme`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Title / Branding */}
      <div className={`pointer-events-auto font-bold tracking-tight text-xl hidden md:block opacity-50 select-none ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
        chassidus.ai
      </div>

      {/* Mobile Library Toggle */}
      <button 
        onClick={toggleLibrary}
        className={`
          md:hidden pointer-events-auto p-2 rounded-full shadow-sm backdrop-blur-sm border transition-all
          ${settings.theme === 'dark' ? 'bg-gray-800/80 border-gray-700 text-gray-200' : settings.theme === 'sepia' ? 'bg-[#efe6ce]/80 border-[#d8cba8] text-[#5b4636]' : 'bg-white/80 border-gray-200 text-gray-700'}
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

    </header>
  );
};

export default Controls;