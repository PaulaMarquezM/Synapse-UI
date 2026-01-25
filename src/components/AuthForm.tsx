/**
 * SYNAPSE UI - Authentication Form
 * Componente de login y registro con diseño glassmorphism
 * FIXED: Eliminado bug de pérdida de foco en inputs
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { signIn, signUp } from '../lib/supabase';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'login' | 'register';
type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess }) => {
  // Estado del formulario
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado de la petición
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // ============================================
  // VALIDACIONES
  // ============================================

  const isEmailValid = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isPasswordValid = (password: string): boolean => {
    return password.length >= 6;
  };

  const canSubmit = (): boolean => {
    if (!isEmailValid(email)) return false;
    if (!isPasswordValid(password)) return false;
    if (mode === 'register' && password !== confirmPassword) return false;
    return true;
  };

  // ============================================
  // HANDLERS (useCallback para evitar re-renders)
  // ============================================

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit()) {
      setErrorMessage('Por favor completa todos los campos correctamente');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      let result;
      
      if (mode === 'login') {
        result = await signIn(email, password);
      } else {
        result = await signUp(email, password);
      }

      if (result.error) {
        setStatus('error');
        setErrorMessage(result.error.message || 'Error al autenticar');
      } else {
        setStatus('success');
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Error inesperado. Intenta nuevamente.');
      console.error('Error en autenticación:', err);
    }
  };

  const toggleMode = useCallback(() => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrorMessage('');
    setStatus('idle');
    setConfirmPassword('');
  }, [mode]);

  // ============================================
  // STATUS MESSAGE
  // ============================================

  const StatusMessage = () => {
    if (status === 'error' && errorMessage) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
        >
          <AlertCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-400">{errorMessage}</p>
        </motion.div>
      );
    }

    if (status === 'success') {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
        >
          <CheckCircle size={18} className="text-green-400" />
          <p className="text-sm text-green-400">
            {mode === 'login' ? '¡Bienvenido de vuelta!' : '¡Cuenta creada exitosamente!'}
          </p>
        </motion.div>
      );
    }

    return null;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="w-full max-w-md p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center w-16 h-16 mb-4 
                     bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg"
        >
          <Brain size={32} className="text-white" />
        </motion.div>
        
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 
                       bg-clip-text text-transparent mb-2">
          SYNAPSE UI
        </h1>
        
        <p className="text-gray-400 text-sm">
          {mode === 'login' 
            ? 'Inicia sesión para continuar' 
            : 'Crea tu cuenta para comenzar'}
        </p>
      </div>

      {/* Status Message */}
      <AnimatePresence mode="wait">
        <StatusMessage />
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        {/* Email */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Mail size={20} />
          </div>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={handleEmailChange}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                       text-white placeholder-gray-500 outline-none 
                       focus:border-blue-500/50 focus:bg-white/10 
                       transition-all duration-200"
            disabled={status === 'loading'}
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Lock size={20} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={handlePasswordChange}
            className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg 
                       text-white placeholder-gray-500 outline-none 
                       focus:border-blue-500/50 focus:bg-white/10 
                       transition-all duration-200"
            disabled={status === 'loading'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          <button
            type="button"
            onClick={toggleShowPassword}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {/* Confirm Password (solo en registro) */}
        <AnimatePresence>
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative"
            >
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock size={20} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg 
                           text-white placeholder-gray-500 outline-none 
                           focus:border-blue-500/50 focus:bg-white/10 
                           transition-all duration-200"
                disabled={status === 'loading'}
                autoComplete="new-password"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password Requirements (solo en registro) */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-gray-500 space-y-1"
          >
            <p className={password.length >= 6 ? 'text-green-400' : ''}>
              • Mínimo 6 caracteres
            </p>
            {confirmPassword && (
              <p className={password === confirmPassword ? 'text-green-400' : 'text-red-400'}>
                • Las contraseñas {password === confirmPassword ? 'coinciden' : 'no coinciden'}
              </p>
            )}
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!canSubmit() || status === 'loading'}
          whileHover={{ scale: canSubmit() ? 1.02 : 1 }}
          whileTap={{ scale: canSubmit() ? 0.98 : 1 }}
          className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 
                     ${canSubmit() && status !== 'loading'
                       ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg' 
                       : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
              Procesando...
            </span>
          ) : (
            mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
          )}
        </motion.button>
      </form>

      {/* Toggle Mode */}
      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          {mode === 'login' 
            ? '¿No tienes cuenta?' 
            : '¿Ya tienes cuenta?'}
          {' '}
          <button
            type="button"
            onClick={toggleMode}
            disabled={status === 'loading'}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <p className="text-xs text-gray-500 text-center">
          Al continuar, aceptas que SYNAPSE UI analice tu rostro de forma local 
          para mejorar tu productividad. No se almacenan imágenes ni videos.
        </p>
      </div>
    </div>
  );
};

export default AuthForm;