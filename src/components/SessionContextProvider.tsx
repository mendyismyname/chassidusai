import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  title: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[] | null;
  experience: any[] | null;
  theme: string | null;
  font_size: number | null;
  line_height: number | null;
  translation_mode: string | null;
  text_align: string | null;
  progress: any[] | null;
  updated_at: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data) {
      setProfile(data);
    }
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);
      
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id);
      }
      
      setIsLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const contextValue = {
    session,
    user,
    profile,
    isLoading,
    fetchProfile: async () => {
      if (user) {
        await fetchProfile(user.id);
      }
    },
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};