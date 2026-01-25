/**
 * SYNAPSE UI - useAuth Hook
 * Hook personalizado para manejar autenticación en toda la app
 */

import { useState, useEffect } from 'react';
import { getCurrentUser, onAuthStateChange, type User, type Session } from '../lib/supabase';

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener usuario inicial
    getCurrentUser().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });

    // Suscribirse a cambios de autenticación
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      console.log('🔄 Auth event:', event);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Eventos específicos
      if (event === 'SIGNED_IN') {
        console.log('✅ Usuario autenticado');
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 Usuario desconectado');
      }
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: user !== null,
  };
}