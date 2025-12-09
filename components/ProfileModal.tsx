
import React, { useState } from 'react';
import { Settings } from '../types';

interface ProfileModalProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
  onClose: () => void;
  theme: string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ settings, onUpdateSettings, onClose, theme }) => {
  const [keyInput, setKeyInput] = useState(settings.apiKey);

  const handleSave = () => {
    onUpdateSettings({ apiKey: keyInput });
    onClose();
  };

  const isDark = theme === 'dark';
  const borderColor = isDark ? 'border-gray-800' : 'border-gray-100';
  const textColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const headingColor = isDark ? 'text-gray-100' : 'text-gray-900';
  
  // Mock progress data if empty
  const progressData = settings.progress.length > 0 ? settings.progress : [
    { bookId: 'toras-chaim', percentage: 12, lastReadDate: '2023-10-27' },
    { bookId: 'tanya', percentage: 45, lastReadDate: '2023-10-25' },
  ];

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300 ${isDark ? 'bg-black' : 'bg-white'}`}>
      
      {/* Close Button */}
      <button 
          onClick={onClose} 
          className={`fixed top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all z-50 ${textColor}`}
      >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
      </button>

      <div className={`
        w-full h-full md:max-w-3xl md:h-auto md:max-h-[85vh] 
        flex flex-col md:flex-row 
        overflow-y-auto custom-scrollbar md:rounded-3xl md:border
        ${isDark ? 'md:border-gray-800 bg-black' : 'md:border-gray-100 bg-white'}
      `}>
        
        {/* Left: Account & Progress */}
        <div className={`
          flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r ${borderColor}
        `}>
           <h2 className={`text-2xl font-serif font-bold tracking-tight mb-2 ${headingColor}`}>Account</h2>
           <p className="text-xs opacity-50 uppercase tracking-widest mb-12">Your Learning Journey</p>

           <div className="space-y-8">
              {/* Progress Section */}
              <div>
                 <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">Books in Progress</h3>
                 <div className="space-y-6">
                    {progressData.map((p, i) => (
                       <div key={i} className="group">
                          <div className="flex justify-between text-sm mb-2">
                             <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                               {p.bookId === 'toras-chaim' ? 'Toras Chaim' : p.bookId}
                             </span>
                             <span className="opacity-50 text-xs font-mono">{p.percentage}%</span>
                          </div>
                          <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
                             <div 
                               style={{ width: `${p.percentage}%` }} 
                               className={`h-full rounded-full transition-all duration-1000 ${isDark ? 'bg-gray-500' : 'bg-black'}`} 
                             />
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Settings & Key */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-between">
           
           <div className="space-y-8">
             <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">API Configuration</h3>
                <p className={`text-sm opacity-80 leading-loose mb-4 ${textColor}`}>
                  Chassidus.ai is open-source. To enable AI features, please provide a <b>Google Gemini API Key</b>.
                </p>
                <p className={`text-xs opacity-60 leading-relaxed mb-8 ${textColor}`}>
                  Free, Secure, Private. No data is shared with Chassidus.ai from your Google Account.
                </p>
                <input 
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Paste your API Key here..."
                  className={`
                    w-full py-3 px-0 bg-transparent border-b outline-none transition-all placeholder:opacity-30 font-mono text-sm
                    ${isDark ? 'border-gray-800 focus:border-white text-gray-200' : 'border-gray-200 focus:border-black text-gray-800'}
                  `}
                />
             </div>
             
             <div className="flex flex-col gap-3 pt-4">
                 <button 
                   onClick={handleSave}
                   className={`
                     w-full px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
                     ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}
                   `}
                 >
                   Save Key
                 </button>
                 <a 
                   href="https://aistudio.google.com/app/apikey" 
                   target="_blank" 
                   rel="noreferrer" 
                   className={`
                     w-full px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border text-center
                     ${isDark ? 'border-gray-800 hover:border-gray-600 text-gray-400' : 'border-gray-200 hover:border-gray-400 text-gray-600'}
                   `}
                 >
                   Get Free Key
                 </a>
             </div>
           </div>

           <div className="mt-12 md:mt-0 pt-8 border-t md:border-t-0 border-dashed border-gray-200 dark:border-gray-800">
               <div className="flex gap-6 opacity-40 text-[10px] uppercase tracking-widest justify-center md:justify-start">
                  <a href="#" className="hover:opacity-100">Privacy</a>
                  <a href="#" className="hover:opacity-100">Terms</a>
                  <a href="#" className="hover:opacity-100">Contact</a>
               </div>
           </div>

        </div>

      </div>
    </div>
  );
};

export default ProfileModal;
