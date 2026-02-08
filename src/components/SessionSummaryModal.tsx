import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertCircle, Zap, Eye, Clock, Target } from 'lucide-react';
import type { SessionSummary } from '../lib/sessionManager';

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: SessionSummary | null;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  summary 
}) => {
  if (!summary) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getEffectivenessColor = (score: number): string => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#60a5fa';
    if (score >= 40) return '#fbbf24';
    return '#ef4444';
  };

  const getEffectivenessLabel = (score: number): string => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Buena';
    if (score >= 40) return 'Regular';
    return 'Mejorable';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20
            }}
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 400,
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                position: 'relative'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h2 style={{
                    fontSize: 20,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginBottom: 4
                  }}>
                    📊 Resumen de Sesión
                  </h2>
                  <p style={{
                    fontSize: 12,
                    color: '#94a3b8'
                  }}>
                    Duración: {formatDuration(summary.duration)}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <X size={18} color="#94a3b8" />
                </motion.button>
              </div>

              {/* Content */}
              <div style={{ padding: 24 }}>
                {/* Efectividad Score */}
                <div style={{
                  marginBottom: 24,
                  padding: 20,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: 14,
                    color: '#94a3b8',
                    marginBottom: 12
                  }}>
                    Efectividad de la Sesión
                  </div>
                  <div style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: getEffectivenessColor(summary.effectiveness),
                    marginBottom: 8
                  }}>
                    {Math.round(summary.effectiveness)}%
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: `${getEffectivenessColor(summary.effectiveness)}20`,
                    color: getEffectivenessColor(summary.effectiveness),
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {getEffectivenessLabel(summary.effectiveness)}
                  </div>
                </div>

                {/* Métricas Promedio */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cbd5e1',
                    marginBottom: 12
                  }}>
                    Métricas Promedio
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10
                  }}>
                    <MetricCard
                      icon={Target}
                      label="Foco"
                      value={Math.round(summary.avgFocus)}
                      color="#60a5fa"
                    />
                    <MetricCard
                      icon={Zap}
                      label="Estrés"
                      value={Math.round(summary.avgStress)}
                      color="#ef4444"
                    />
                    <MetricCard
                      icon={Eye}
                      label="Fatiga"
                      value={Math.round(summary.avgFatigue)}
                      color="#fbbf24"
                    />
                    <MetricCard
                      icon={AlertCircle}
                      label="Distracción"
                      value={Math.round(summary.avgDistraction)}
                      color="#a855f7"
                    />
                  </div>
                </div>

                {/* Distribución del Tiempo */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cbd5e1',
                    marginBottom: 12
                  }}>
                    Distribución del Tiempo
                  </h3>
                  <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <TimeBar
                      label="Enfocado"
                      percentage={summary.pctFocused}
                      color="#60a5fa"
                    />
                    <TimeBar
                      label="Distraído"
                      percentage={summary.pctDistracted}
                      color="#a855f7"
                    />
                    <TimeBar
                      label="Estresado"
                      percentage={summary.pctStressed}
                      color="#ef4444"
                    />
                    <TimeBar
                      label="Fatigado"
                      percentage={summary.pctTired}
                      color="#fbbf24"
                      isLast
                    />
                  </div>
                </div>

                {/* Estadísticas Adicionales */}
                <div>
                  <h3 style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cbd5e1',
                    marginBottom: 12
                  }}>
                    Estadísticas
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10
                  }}>
                    <StatPill
                      label="Interrupciones"
                      value={summary.interruptions}
                      icon="⚠️"
                    />
                    <StatPill
                      label="Períodos de Foco"
                      value={summary.focusPeriods}
                      icon="🎯"
                    />
                    <StatPill
                      label="Estado Dominante"
                      value={getStateName(summary.dominantState)}
                      icon="📊"
                      span2
                    />
                  </div>
                </div>

                {/* Botón de Cerrar */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  style={{
                    width: '100%',
                    marginTop: 24,
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(96, 165, 250, 0.3)'
                  }}
                >
                  Entendido
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Componentes auxiliares
const MetricCard: React.FC<{
  icon: any;
  label: string;
  value: number;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div style={{
    padding: 12,
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center'
  }}>
    <Icon size={20} color={color} style={{ marginBottom: 8 }} />
    <div style={{
      fontSize: 24,
      fontWeight: 700,
      color: 'white',
      marginBottom: 4
    }}>
      {value}
    </div>
    <div style={{
      fontSize: 11,
      color: '#94a3b8'
    }}>
      {label}
    </div>
  </div>
);

const TimeBar: React.FC<{
  label: string;
  percentage: number;
  color: string;
  isLast?: boolean;
}> = ({ label, percentage, color, isLast }) => (
  <div style={{ marginBottom: isLast ? 0 : 12 }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 6
    }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
        {percentage.toFixed(1)}%
      </span>
    </div>
    <div style={{
      height: 6,
      borderRadius: 999,
      background: 'rgba(30, 41, 59, 0.5)',
      overflow: 'hidden'
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          height: '100%',
          background: color,
          borderRadius: 999
        }}
      />
    </div>
  </div>
);

const StatPill: React.FC<{
  label: string;
  value: number | string;
  icon: string;
  span2?: boolean;
}> = ({ label, value, icon, span2 }) => (
  <div style={{
    padding: 12,
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    gridColumn: span2 ? 'span 2' : 'span 1'
  }}>
    <span style={{ fontSize: 20 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
        {value}
      </div>
    </div>
  </div>
);

const getStateName = (state: string): string => {
  const stateMap: Record<string, string> = {
    focus: 'Foco',
    distraction: 'Distracción',
    stress: 'Estrés',
    fatigue: 'Fatiga',
    neutral: 'Neutral'
  };
  return stateMap[state] || state;
};

export default SessionSummaryModal;
