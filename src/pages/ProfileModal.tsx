import React, { useState, useEffect } from 'react';
import { Settings, Profile } from '../types';
import { supabase } from '../integrations/supabase/client';
import { useSession } from '../components/SessionContextProvider';

interface ProfileModalProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
  onClose: () => void;
  theme: string;
  profile: Profile | null;
  fetchProfile: () => Promise<void>;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ settings, onUpdateSettings, onClose, theme, profile, fetchProfile }) => {
  const { user } = useSession();
  const [keyInput, setKeyInput] = useState(settings.apiKey);
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [title, setTitle] = useState(profile?.title || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [skills, setSkills] = useState(profile?.skills?.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setTitle(profile.title || '');
      setLocation(profile.location || '');
      setBio(profile.bio || '');
      setSkills(profile.skills?.join(', ') || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    // Save API Key to cookie (client-side)
    onUpdateSettings({ apiKey: keyInput });

    if (user) {
      const updatedProfileData = {
        first_name: firstName,
        last_name: lastName,
        title: title,
        location: location,
        bio: bio,
        skills: skills.split(',').map(s => s.trim()).filter(s => s.length > 0),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatedProfileData)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        setSaveError('Failed to save profile. Please try again.');
      } else {
        await fetchProfile(); // Refresh profile data in context
        onClose();
      }
    } else {
      onClose(); // Close if not logged in, only API key was saved
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    setIsSaving(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      setSaveError('Failed to log out. Please try again.');
    } else {
      // Clear API key cookie on logout
      onUpdateSettings({ apiKey: '' });
      onClose();
    }
    setIsSaving(false);
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
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300 ${isDark ? 'bg-black/80 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-sm'}`}>
      
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
        w-full h-full md:max-w-4xl md:h-auto md:max-h-[85vh] 
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
              {/* Profile Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6">Profile Details</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="firstName" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>First Name</label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>Last Name</label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="title" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>Title</label>
                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="location" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>Location</label>
                    <input
                      id="location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="bio" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>Bio</label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="skills" className={`block text-xs uppercase tracking-wider opacity-70 mb-1 ${textColor}`}>Skills (comma-separated)</label>
                    <input
                      id="skills"
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      className={`w-full py-2 px-3 rounded-md border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    />
                  </div>
                </div>
              </div>

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
             
             {saveError && (
               <div className="p-3 text-sm text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-300 rounded-md">
                 {saveError}
               </div>
             )}

             <div className="flex flex-col gap-3 pt-4">
                 <button 
                   onClick={handleSave}
                   disabled={isSaving}
                   className={`
                     w-full px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
                     ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                     ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}
                   `}
                 >
                   {isSaving ? 'Saving...' : 'Save Profile & Key'}
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
                 <button 
                   onClick={handleLogout}
                   disabled={isSaving}
                   className={`
                     w-full px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border text-center
                     ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}
                     ${isDark ? 'border-red-800 text-red-400 hover:bg-red-900/20' : 'border-red-200 text-red-600 hover:bg-red-50'}
                   `}
                 >
                   Log Out
                 </button>
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