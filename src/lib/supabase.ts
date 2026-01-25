/**
 * SYNAPSE UI - Supabase Client
 * Cliente configurado para autenticación y base de datos
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURACIÓN
// ============================================

const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️ SYNAPSE UI: Faltan credenciales de Supabase.\n' +
    'Asegúrate de tener configurado .env.local con:\n' +
    'PLASMO_PUBLIC_SUPABASE_URL\n' +
    'PLASMO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// ============================================
// CLIENTE DE SUPABASE
// ============================================

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configuración de autenticación para extensiones
    storage: {
      getItem: (key) => {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
          });
        });
      },
      setItem: (key, value) => {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve();
          });
        });
      },
      removeItem: (key) => {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key], () => {
            resolve();
          });
        });
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// TIPOS DE DATOS
// ============================================

export interface User {
  id: string;
  email?: string;
  created_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface AuthError {
  message: string;
  status?: number;
}

// ============================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================

/**
 * Registrar nuevo usuario
 */
export async function signUp(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('❌ Error en registro:', error.message);
      return { user: null, session: null, error };
    }

    console.log('✅ Usuario registrado exitosamente');
    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error('❌ Error inesperado en registro:', err);
    return { 
      user: null, 
      session: null, 
      error: { message: 'Error inesperado al registrar' } 
    };
  }
}

/**
 * Iniciar sesión
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Error en login:', error.message);
      return { user: null, session: null, error };
    }

    console.log('✅ Login exitoso');
    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    console.error('❌ Error inesperado en login:', err);
    return { 
      user: null, 
      session: null, 
      error: { message: 'Error inesperado al iniciar sesión' } 
    };
  }
}

/**
 * Cerrar sesión
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ Error al cerrar sesión:', error.message);
      return { error };
    }

    console.log('✅ Sesión cerrada exitosamente');
    return { error: null };
  } catch (err) {
    console.error('❌ Error inesperado al cerrar sesión:', err);
    return { error: { message: 'Error inesperado al cerrar sesión' } };
  }
}

/**
 * Obtener usuario actual
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('❌ Error al obtener usuario:', error.message);
      return { user: null, error };
    }

    return { user, error: null };
  } catch (err) {
    console.error('❌ Error inesperado al obtener usuario:', err);
    return { 
      user: null, 
      error: { message: 'Error inesperado al obtener usuario' } 
    };
  }
}

/**
 * Obtener sesión actual
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Error al obtener sesión:', error.message);
      return { session: null, error };
    }

    return { session, error: null };
  } catch (err) {
    console.error('❌ Error inesperado al obtener sesión:', err);
    return { 
      session: null, 
      error: { message: 'Error inesperado al obtener sesión' } 
    };
  }
}

/**
 * Verificar si el usuario está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  const { session } = await getCurrentSession();
  return session !== null;
}

/**
 * Suscribirse a cambios de autenticación
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Cambio de estado de auth:', event);
    callback(event, session);
  });
}

// ============================================
// FUNCIONES DE RECUPERACIÓN DE CONTRASEÑA
// ============================================

/**
 * Enviar email de recuperación de contraseña
 */
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('❌ Error al enviar email de recuperación:', error.message);
      return { error };
    }

    console.log('✅ Email de recuperación enviado');
    return { error: null };
  } catch (err) {
    console.error('❌ Error inesperado al enviar email:', err);
    return { 
      error: { message: 'Error inesperado al enviar email de recuperación' } 
    };
  }
}

/**
 * Actualizar contraseña
 */
export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ Error al actualizar contraseña:', error.message);
      return { error };
    }

    console.log('✅ Contraseña actualizada exitosamente');
    return { error: null };
  } catch (err) {
    console.error('❌ Error inesperado al actualizar contraseña:', err);
    return { 
      error: { message: 'Error inesperado al actualizar contraseña' } 
    };
  }
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default supabase;