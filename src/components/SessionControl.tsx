import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Clock, TrendingUp } from 'lucide-react';
import { sessionManager, type SessionSummary } from '../lib/SessionManager';

interface SessionControlProps {
  onSessionStart?: () => void;
  onSessionEnd?: (summary: SessionSummary) => void;
  currentMetrics?: {
    focus: number;
    stress: number;
    fatigue: number;
    distraction: number;
    dominantState: string;
    confidence: number;
  } | null;
}

const SessionControl: React.FC<SessionControlProps> = ({ 
  onSessionStart, 
  onSessionEnd,
  currentMetrics 
}) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const hasMetricsRef = useRef(false);

  // Timer que se actualiza cada segundo
  useEffect(() => {
    if (!isSessionActive) return;

    const interval = setInterval(() => {
      const status = sessionManager.getSessionStatus();
      if (status) {
        setElapsedSeconds(status.elapsedSeconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Registrar métricas cada 2 segundos cuando hay sesión activa
  useEffect(() => {
    if (!isSessionActive || !currentMetrics) return;

    const interval = setInterval(() => {
      sessionManager.recordMetrics({
        focus: currentMetrics.focus,
        stress: currentMetrics.stress,
        fatigue: currentMetrics.fatigue,
        distraction: currentMetrics.distraction,
        dominantState: currentMetrics.dominantState as any,
        confidence: currentMetrics.confidence
      });
      hasMetricsRef.current = true;
    }, 2000);

    return () => clearInterval(interval);
  }, [isSessionActive, currentMetrics]);

  const handleStartSession = async () => {
    try {
      const sessionId = await sessionManager.startSession();
      setIsSessionActive(true);
      setElapsedSeconds(0);
      hasMetricsRef.current = false;
      console.log('✅ Sesión iniciada:', sessionId);
      if (currentMetrics) {
        sessionManager.recordMetrics({
          focus: currentMetrics.focus,
          stress: currentMetrics.stress,
          fatigue: currentMetrics.fatigue,
          distraction: currentMetrics.distraction,
          dominantState: currentMetrics.dominantState as any,
          confidence: currentMetrics.confidence
        });
        hasMetricsRef.current = true;
      }
      onSessionStart?.();
    } catch (error) {
      console.error('❌ Error al iniciar sesión:', error);
      alert('Error al iniciar la sesión. Verifica tu conexión.');
    }
  };

  const handleEndSession = async () => {
    try {
      if (!hasMetricsRef.current) {
        alert('Aún no hay datos suficientes. Espera unos segundos y vuelve a intentar.');
        return;
      }
      setIsEnding(true);
      const summary = await sessionManager.endSession();
      setIsSessionActive(false);
      setElapsedSeconds(0);
      hasMetricsRef.current = false;
      console.log('📊 Sesión finalizada:', summary);
      onSessionEnd?.(summary);
    } catch (error) {
      console.error('❌ Error al finalizar sesión:', error);
      alert('Error al finalizar la sesión.');
    } finally {
      setIsEnding(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      marginBottom: 16,
      padding: 16,
      borderRadius: 14,
      background: isSessionActive 
        ? 'rgba(34, 197, 94, 0.08)' 
        : 'rgba(59, 130, 246, 0.08)',
      border: isSessionActive
        ? '1px solid rgba(34, 197, 94, 0.25)'
        : '1px solid rgba(59, 130, 246, 0.25)',
      boxShadow: isSessionActive
        ? '0 4px 12px rgba(34, 197, 94, 0.1)'
        : '0 4px 12px rgba(59, 130, 246, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isSessionActive ? 12 : 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSessionActive ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 10px #22c55e'
                }}
              />
              <div>
                <div style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'white',
                  marginBottom: 2
                }}>
                  🎯 Sesión Activa
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Clock size={12} />
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={{
                fontWeight: 700,
                fontSize: 14,
                color: 'white',
                marginBottom: 2
              }}>
                📊 Control de Sesiones
              </div>
              <div style={{
                fontSize: 11,
                color: '#94a3b8'
              }}>
                Inicia una sesión para registrar métricas
              </div>
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isSessionActive ? handleEndSession : handleStartSession}
          disabled={isEnding}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: isSessionActive 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
            color: 'white',
            cursor: isEnding ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 12,
            boxShadow: isSessionActive
              ? '0 4px 12px rgba(239, 68, 68, 0.3)'
              : '0 4px 12px rgba(96, 165, 250, 0.3)',
            opacity: isEnding ? 0.6 : 1
          }}
        >
          {isEnding ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⏳
              </motion.div>
              Finalizando...
            </>
          ) : isSessionActive ? (
            <>
              <Square size={14} fill="white" />
              Finalizar
            </>
          ) : (
            <>
              <Play size={14} fill="white" />
              Iniciar Sesión
            </>
          )}
        </motion.button>
      </div>

      {/* Indicadores en tiempo real durante la sesión */}
      <AnimatePresence>
        {isSessionActive && currentMetrics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8
            }}>
              <MetricPill 
                label="Foco" 
                value={Math.round(currentMetrics.focus)} 
                color="#60a5fa" 
              />
              <MetricPill 
                label="Estrés" 
                value={Math.round(currentMetrics.stress)} 
                color="#ef4444" 
              />
              <MetricPill 
                label="Fatiga" 
                value={Math.round(currentMetrics.fatigue)} 
                color="#fbbf24" 
              />
              <MetricPill 
                label="Distracción" 
                value={Math.round(currentMetrics.distraction)} 
                color="#a855f7" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Componente auxiliar para mostrar métricas en píldoras
const MetricPill: React.FC<{ label: string; value: number; color: string }> = ({ 
  label, 
  value, 
  color 
}) => (
  <div style={{
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    <span style={{
      fontSize: 10,
      color: '#94a3b8',
      fontWeight: 500
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 12,
      fontWeight: 700,
      color: color
    }}>
      {value}
    </span>
  </div>
);

export default SessionControl;
