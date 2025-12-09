import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { useSession } from '../components/SessionContextProvider';

interface LoginPageProps {
  onClose: () => void;
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onClose, onLoginSuccess }) => {
  const { isLoading, session } = useSession();

  useEffect(() => {
    if (session) {
      onLoginSuccess(); // Automatically close login page on successful login
    }
  }, [session, onLoginSuccess]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-[#050505]">
        <p className="text-lg font-serif opacity-50">Loading...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-[#050505]/80 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Close Button */}
      <button 
          onClick={onClose} 
          className={`fixed top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all z-50 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200`}
      >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
      </button>

      <div className="w-full max-w-md p-8 rounded-lg shadow-lg bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800">
        <h2 className="text-3xl font-serif font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
          Welcome to Chassidus.ai
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Only email/password for now
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(210 100% 40%)', // A shade of blue
                  brandAccent: 'hsl(210 100% 30%)',
                  brandButtonText: 'white',
                  defaultButtonBackground: 'hsl(210 100% 98%)',
                  defaultButtonBackgroundHover: 'hsl(210 100% 95%)',
                  defaultButtonBorder: 'hsl(210 100% 90%)',
                  defaultButtonText: 'hsl(210 100% 20%)',
                  inputBackground: 'hsl(0 0% 100%)',
                  inputBorder: 'hsl(210 100% 90%)',
                  inputBorderHover: 'hsl(210 100% 80%)',
                  inputBorderFocus: 'hsl(210 100% 40%)',
                  inputText: 'hsl(210 100% 20%)',
                  inputLabelText: 'hsl(210 100% 20%)',
                  messageText: 'hsl(210 100% 20%)',
                  messageBackground: 'hsl(210 100% 98%)',
                  anchorTextColor: 'hsl(210 100% 40%)',
                  anchorTextHoverColor: 'hsl(210 100% 30%)',
                },
              },
              dark: {
                colors: {
                  brand: 'hsl(210 100% 40%)',
                  brandAccent: 'hsl(210 100% 50%)',
                  brandButtonText: 'white',
                  defaultButtonBackground: 'hsl(210 100% 10%)',
                  defaultButtonBackgroundHover: 'hsl(210 100% 15%)',
                  defaultButtonBorder: 'hsl(210 100% 20%)',
                  defaultButtonText: 'hsl(210 100% 80%)',
                  inputBackground: 'hsl(210 100% 5%)',
                  inputBorder: 'hsl(210 100% 15%)',
                  inputBorderHover: 'hsl(210 100% 25%)',
                  inputBorderFocus: 'hsl(210 100% 40%)',
                  inputText: 'hsl(210 100% 80%)',
                  inputLabelText: 'hsl(210 100% 80%)',
                  messageText: 'hsl(210 100% 80%)',
                  messageBackground: 'hsl(210 100% 10%)',
                  anchorTextColor: 'hsl(210 100% 40%)',
                  anchorTextHoverColor: 'hsl(210 100% 50%)',
                },
              },
            },
          }}
          theme="dark" // Default to dark theme for auth UI
        />
        <button 
          onClick={onClose}
          className={`
            mt-4 w-full px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border text-center
            dark:border-gray-800 hover:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900
          `}
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
};

export default LoginPage;