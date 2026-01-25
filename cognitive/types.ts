/**
 * SYNAPSE UI - Cognitive Engine Types
 * Definiciones de tipos para el análisis cognitivo
 */

// ============================================
// SEÑALES FACIALES DETECTADAS
// ============================================

export interface FacialLandmarks {
  // Puntos clave del rostro (468 puntos de MediaPipe)
  landmarks: Array<{ x: number; y: number; z: number }>;
  // Región de interés
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface EyeMetrics {
  // Seguimiento ocular
  gazeDirection: { x: number; y: number }; // -1 a 1
  blinkRate: number; // parpadeos por minuto
  eyeOpenness: number; // 0 a 1
  pupilDilation: number; // 0 a 1 (aproximado)
  gazeStability: number; // 0 a 1 (qué tan estable es la mirada)
}

export interface FacialExpression {
  // Expresiones detectadas
  neutral: number; // 0 a 1
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
  // Características específicas
  eyebrowFurrow: number; // ceño fruncido (estrés)
  mouthTension: number; // tensión en la boca
}

export interface HeadPose {
  // Postura de la cabeza
  pitch: number; // inclinación arriba/abajo (-90 a 90)
  yaw: number; // rotación izq/derecha (-90 a 90)
  roll: number; // inclinación lateral (-90 a 90)
  stability: number; // 0 a 1 (qué tan estable está)
}

// ============================================
// ESTADOS COGNITIVOS
// ============================================

export enum CognitiveState {
  FOCUS = 'focus',
  STRESS = 'stress',
  FATIGUE = 'fatigue',
  DISTRACTION = 'distraction',
  NEUTRAL = 'neutral',
}

export interface CognitiveMetrics {
  // Métricas principales (0-100)
  focusScore: number; // Nivel de concentración
  stressScore: number; // Nivel de estrés
  fatigueScore: number; // Nivel de fatiga
  distractionScore: number; // Nivel de distracción
  
  // Estado dominante
  currentState: CognitiveState;
  confidence: number; // Confianza en la clasificación (0-1)
  
  // Metadata
  timestamp: number;
}

// ============================================
// ANÁLISIS TEMPORAL
// ============================================

export interface TemporalAnalysis {
  // Análisis de ventana temporal (últimos N segundos)
  timeWindow: number; // en segundos
  
  // Promedios
  avgFocus: number;
  avgStress: number;
  avgFatigue: number;
  avgDistraction: number;
  
  // Tendencias
  focusTrend: 'increasing' | 'decreasing' | 'stable';
  stressTrend: 'increasing' | 'decreasing' | 'stable';
  fatigueTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Eventos detectados
  interruptions: number; // Número de interrupciones
  focusPeriods: number; // Períodos de concentración continua
}

// ============================================
// CONFIGURACIÓN DEL MOTOR
// ============================================

export interface CognitiveEngineConfig {
  // Frecuencia de análisis
  analysisFrequency: number; // Hz (ej. 5 = 5 veces por segundo)
  
  // Ventanas temporales
  shortTermWindow: number; // segundos (ej. 10)
  longTermWindow: number; // segundos (ej. 60)
  
  // Umbrales de detección
  thresholds: {
    focus: number; // Umbral para considerar "en foco"
    stress: number; // Umbral para considerar "estresado"
    fatigue: number; // Umbral para considerar "fatigado"
    distraction: number; // Umbral para considerar "distraído"
  };
  
  // Sensibilidad
  sensitivity: 'low' | 'medium' | 'high';
}

// ============================================
// RESULTADO DEL MOTOR
// ============================================

export interface CognitiveEngineOutput {
  // Métricas actuales
  current: CognitiveMetrics;
  
  // Análisis temporal
  temporal: TemporalAnalysis;
  
  // Recomendaciones
  recommendations: string[];
  
  // Estado del sistema
  isCalibrated: boolean;
  confidence: number;
}

// ============================================
// DATOS CRUDOS DE ENTRADA
// ============================================

export interface RawFaceData {
  landmarks: FacialLandmarks;
  timestamp: number;
  frameNumber: number;
}