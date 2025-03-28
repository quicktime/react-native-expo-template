import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../initSupabase';
import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

type ContextProps = {
  user: null | boolean;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Partial<ContextProps>>({});

interface Props {
  children: React.ReactNode;
}

const AuthProvider = (props: Props) => {
  // user null = loading
  const [user, setUser] = useState<null | boolean>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session ? true : false);
    });

    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log(`Supabase auth event: ${_event}`);
        setSession(session);
        setUser(session ? true : false);
        
        // Navigate based on auth state
        if (session) {
          router.replace('/(app)');
        } else if (_event === 'SIGNED_OUT') {
          router.replace('/(auth)/login');
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign out function
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signOut,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };