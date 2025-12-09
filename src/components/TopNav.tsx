import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import { User } from '@supabase/supabase-js'; // Import User type

interface TopNavProps {
  settings: Settings;
  toggleLibrary: () => void;
  onOpenProfile: () => void;
  onGoHome: () => void;
  user: User | null; // Add user prop
}

const TopNav: React.FC<TopNavProps> = ({ 
  settings, 
  toggleLibrary, 
  onOpenProfile,
  onGoHome,
  user // Destructure user
}) => {
  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const isDark = settings.theme === 'dark';
  const textColor = isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-300 hover:text-gray-800';

  const remaining = Math.max(0, 3 - settings.dailyUsageCount);

  return (
    <nav 
      className={`
        fixed top-0 left-0 right-0 z-40 h-24 transition-all duration-300 pointer-events-none
        ${scrolled ? (isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md shadow-sm') : 'bg-transparent'}
      `}
    >
      <div className="w-full px-8 h-full flex items-center justify-between">
        
        {/* Left: Branding */}
        <div className="flex items-center gap-6 pointer-events-auto">
          <button 
            onClick={onGoHome}
            className={`font-serif text-lg tracking-[0.2em] font-bold transition-all duration-500 ${textColor}`}
          >
            CHASSIDUS.AI
          </button>
        </div>

        {/* Right: Profile & Usage */}
        <div className="flex items-center gap-4 pointer-events-auto">
           {/* Usage Badge - Minimal */}
           {!settings.apiKey && (
             <div 
               className={`
                 flex items-center justify-center min-w-[30px] h-[30px] px-2 rounded-full border text-[10px] font-bold transition-all
                 ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-400'}
               `}
               title={`${remaining} free messages remaining today`}
             >
                {remaining}
             </div>
           )}

           <button 
             onClick={onOpenProfile}
             className={`w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center group ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
             aria-label="User Profile"
           >
             {user?.user_metadata?.avatar_url ? (
               <img src={user.user_metadata.avatar_url} alt="User Avatar" className="w-full h-full rounded-full object-cover" />
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 transition-colors duration-300 ${isDark ? 'text-gray-600 group-hover:text-gray-300' : 'text-gray-200 group-hover:text-gray-600'}`}>
                 <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
               </svg>
             )}
           </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;