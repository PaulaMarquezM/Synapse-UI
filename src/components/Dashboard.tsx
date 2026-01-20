import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Eye, Zap, Activity } from 'lucide-react';
import type { DetectionData } from './CameraFeed';

interface DashboardProps {
  data: DetectionData | null;
  focusScore: number;
  stressLevel: number;
  alertLevel: number;
}

const Dashboard: React.FC<DashboardProps> = ({ data, focusScore, stressLevel, alertLevel }) => {
  // Calcular emoción dominante
  const emotion = data 
    ? Object.keys(data.expressions).reduce((a, b) => 
        data.expressions[a] > data.expressions[b] ? a : b
      ) 
    : 'neutral';

  // Mapear emociones a español con emojis
  const emotionMap: Record<string, string> = {
    happy: '😊 Feliz',
    sad: '😢 Triste',
    angry: '😠 Frustrado',
    surprised: '😲 Sorprendido',
    neutral: '😐 Neutral',
    disgusted: '🤢 Disgustado',
    fearful: '😨 Temeroso'
  };

  // Estados del sistema
  const getSystemState = () => {
    if (stressLevel >= 60) return { text: 'Modo Calmante Activo', color: '#4ade80' };
    if (focusScore >= 75) return { text: 'Flujo Detectado', color: '#60a5fa' };
    if (alertLevel < 30) return { text: 'Fatiga Detectada', color: '#fbbf24' };
    return { text: 'Monitoreo Normal', color: '#8b5cf6' };
  };

  const systemState = getSystemState();

  // Componente de métrica circular
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
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="#1e293b"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="45"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset }}
              transition={{ type: "tween", duration: 0.9, ease: "easeOut" }}
            />

          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Icon size={24} color={color} />
            <span className="text-2xl font-bold text-white mt-1">{Math.round(value)}</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-2">{label}</p>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[336px] p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          SYNAPSE UI
        </h1>
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: systemState.color }}
        />
      </div>

      {/* Estado del Sistema */}
      <motion.div
        className="mb-6 p-4 rounded-lg backdrop-blur-md bg-white/5 border border-white/10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2">
          <Activity size={20} color={systemState.color} />
          <span className="text-lg font-medium" style={{ color: systemState.color }}>
            {systemState.text}
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Emoción: {emotionMap[emotion] || emotion}
        </p>
      </motion.div>

      {/* Métricas Circulares */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
          value={alertLevel} 
          label="Alerta" 
          color="#fbbf24" 
          icon={Eye}
        />
      </div>

      {/* Métricas Detalladas */}
      {data && (
        <motion.div
          className="p-4 rounded-lg backdrop-blur-md bg-white/5 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Análisis Emocional</h3>
          <div className="space-y-2">
            {Object.entries(data.expressions).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-20 capitalize">{key}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    initial={false}
                    animate={{ width: `${value * 100}%` }}
                    transition={{ type: "tween", duration: 0.6, ease: "easeOut" }}
                  />

                </div>
                <span className="text-xs text-gray-400 w-12 text-right">
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Posición de Mirada */}
      {data && (
        <motion.div
          className="mt-4 p-3 rounded-lg backdrop-blur-md bg-white/5 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-xs text-gray-400">
            Mirada: X: {data.gazeX.toFixed(0)}px | Y: {data.gazeY.toFixed(0)}px
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;