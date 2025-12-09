import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { useSession } from '../components/SessionContextProvider';

const LoginPage: React.FC = () => {
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#050505]">
        <p className="text-lg font-serif opacity-50">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#050505]">
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
      </div>
    </div>
  );
};

export default LoginPage;