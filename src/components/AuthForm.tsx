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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            marginBottom: 16
          }}
        >
          <AlertCircle size={18} style={{ color: '#f87171' }} />
          <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{errorMessage}</p>
        </motion.div>
      );
    }

    if (status === 'success') {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 10,
            marginBottom: 16
          }}
        >
          <CheckCircle size={18} style={{ color: '#4ade80' }} />
          <p style={{ fontSize: 13, color: '#4ade80', margin: 0 }}>
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
    <div className="w-full max-w-[380px] mx-auto" style={{ padding: '0 16px' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(96, 165, 250, 0.3)'
          }}
        >
          <Brain size={30} style={{ color: 'white' }} />
        </motion.div>
        
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 8
        }}>
          SYNAPSE UI
        </h1>
        
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
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
      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        {/* Email */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8'
          }}>
            <Mail size={18} />
          </div>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={handleEmailChange}
            style={{
              width: '100%',
              paddingLeft: 44,
              paddingRight: 14,
              paddingTop: 12,
              paddingBottom: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              color: 'white',
              fontSize: 14,
              outline: 'none',
              transition: 'all 0.2s'
            }}
            disabled={status === 'loading'}
            autoComplete="email"
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)'
              e.target.style.background = 'rgba(255, 255, 255, 0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.target.style.background = 'rgba(255, 255, 255, 0.05)'
            }}
          />
        </div>

        {/* Password */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8'
          }}>
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={handlePasswordChange}
            style={{
              width: '100%',
              paddingLeft: 44,
              paddingRight: 44,
              paddingTop: 12,
              paddingBottom: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              color: 'white',
              fontSize: 14,
              outline: 'none',
              transition: 'all 0.2s'
            }}
            disabled={status === 'loading'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)'
              e.target.style.background = 'rgba(255, 255, 255, 0.08)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.target.style.background = 'rgba(255, 255, 255, 0.05)'
            }}
          />
          <button
            type="button"
            onClick={toggleShowPassword}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              transition: 'color 0.2s'
            }}
            tabIndex={-1}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Confirm Password (solo en registro) */}
        <AnimatePresence>
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ position: 'relative', marginBottom: 14 }}
            >
              <div style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8'
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                style={{
                  width: '100%',
                  paddingLeft: 44,
                  paddingRight: 14,
                  paddingTop: 12,
                  paddingBottom: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                disabled={status === 'loading'}
                autoComplete="new-password"
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)'
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password Requirements (solo en registro) */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: 11, color: '#6b7280', marginBottom: 14 }}
          >
            <p style={{ color: password.length >= 6 ? '#4ade80' : '#6b7280', marginBottom: 4 }}>
              • Mínimo 6 caracteres
            </p>
            {confirmPassword && (
              <p style={{ color: password === confirmPassword ? '#4ade80' : '#f87171' }}>
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
          style={{
            width: '100%',
            padding: '13px 20px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: canSubmit() && status !== 'loading' ? 'pointer' : 'not-allowed',
            background: canSubmit() && status !== 'loading'
              ? 'linear-gradient(135deg, #60a5fa, #8b5cf6)'
              : '#374151',
            color: canSubmit() && status !== 'loading' ? 'white' : '#6b7280',
            boxShadow: canSubmit() && status !== 'loading' 
              ? '0 4px 12px rgba(96, 165, 250, 0.3)' 
              : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          {status === 'loading' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 18,
                  height: 18,
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%'
                }}
              />
              Procesando...
            </>
          ) : (
            mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
          )}
        </motion.button>
      </form>

      {/* Toggle Mode */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          {mode === 'login' 
            ? '¿No tienes cuenta?' 
            : '¿Ya tienes cuenta?'}
          {' '}
          <button
            type="button"
            onClick={toggleMode}
            disabled={status === 'loading'}
            style={{
              color: '#60a5fa',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              padding: 0,
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#60a5fa'}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <p style={{
          fontSize: 10,
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          Al continuar, aceptas que SYNAPSE UI analice tu rostro de forma local 
          para mejorar tu productividad. No se almacenan imágenes ni videos.
        </p>
      </div>
    </div>
  );
};

export default AuthForm;