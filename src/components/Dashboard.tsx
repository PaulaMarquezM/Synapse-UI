import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, Zap, Activity, EyeOff } from 'lucide-react';
import type { DetectionData } from './CameraFeed';

interface DashboardProps {
  data: DetectionData | null;
  focusScore: number;
  stressLevel: number;
  fatigueLevel: number;
  distractionLevel: number;
}

const Dashboard: React.FC<DashboardProps> = ({ data, focusScore, stressLevel, fatigueLevel, distractionLevel }) => {
  const emotion = data 
    ? Object.keys(data.expressions).reduce((a, b) => 
        data.expressions[a] > data.expressions[b] ? a : b
      ) 
    : 'neutral';

  const emotionMap: Record<string, string> = {
    happy: '😊 Feliz',
    sad: '😢 Triste',
    angry: '😠 Frustrado',
    surprised: '😲 Sorprendido',
    neutral: '😐 Neutral',
    disgusted: '🤢 Disgustado',
    fearful: '😨 Temeroso'
  };

  const getSystemState = () => {
    if (stressLevel >= 60) return { text: 'Modo Calmante', color: '#4ade80' };
    if (focusScore >= 75) return { text: 'Flujo Detectado', color: '#60a5fa' };
    if (fatigueLevel >= 70) return { text: 'Fatiga Detectada', color: '#fbbf24' };
    if (distractionLevel >= 65) return { text: 'Distraccion Detectada', color: '#a855f7' };
    return { text: 'Monitoreo Normal', color: '#8b5cf6' };
  };

  const systemState = getSystemState();

  const CircularMetric = ({ 
    value, 
    label, 
    color, 
    icon: Icon 
  }: { 
    value: number; 
    label: string; 
    color: string; 
    icon: any;
  }) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 90, height: 90 }}>
          <svg style={{ transform: 'rotate(-90deg)', width: 90, height: 90 }}>
            <circle
              cx="45"
              cy="45"
              r={radius}
              stroke="rgba(30, 41, 59, 0.5)"
              strokeWidth="6"
              fill="none"
            />
            <motion.circle
              cx="45"
              cy="45"
              r={radius}
              stroke={color}
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={18} color={color} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'white', marginTop: 2 }}>
              {Math.round(value)}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{label}</p>
      </div>
    );
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Header con título */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
      }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #60a5fa, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          SYNAPSE UI
        </h1>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: systemState.color,
            boxShadow: `0 0 10px ${systemState.color}`
          }}
        />
      </div>

      {/* Estado del Sistema */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color={systemState.color} />
          <span style={{ fontSize: 14, fontWeight: 600, color: systemState.color }}>
            {systemState.text}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
          Emoción: {emotionMap[emotion] || emotion}
        </p>
      </motion.div>

      {/* Métricas Circulares */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        marginBottom: 16
      }}>
        <CircularMetric
          value={focusScore}
          label="Enfoque"
          color="#60a5fa"
          icon={Brain}
        />
        <CircularMetric
          value={stressLevel}
          label="Estrés"
          color="#f87171"
          icon={Zap}
        />
        <CircularMetric
          value={fatigueLevel}
          label="Fatiga"
          color="#fbbf24"
          icon={Eye}
        />
        <CircularMetric
          value={distractionLevel}
          label="Distracción"
          color="#a855f7"
          icon={EyeOff}
        />
      </div>

      {/* Análisis Emocional (Collapsible) */}
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            padding: 12,
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <h3 style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#cbd5e1',
            marginBottom: 10
          }}>
            Análisis Emocional
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(data.expressions)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([key, value]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  width: 60,
                  textTransform: 'capitalize'
                }}>
                  {key}
                </span>
                <div style={{
                  flex: 1,
                  height: 6,
                  background: 'rgba(30, 41, 59, 0.5)',
                  borderRadius: 999,
                  overflow: 'hidden'
                }}>
                  <motion.div
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #60a5fa, #8b5cf6)',
                      borderRadius: 999
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value * 100}%` }}
                    transition={{ type: "spring", damping: 15 }}
                  />
                </div>
                <span style={{
                  fontSize: 10,
                  color: '#64748b',
                  width: 32,
                  textAlign: 'right'
                }}>
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;