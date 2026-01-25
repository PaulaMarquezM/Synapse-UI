/**
 * SYNAPSE UI - Cognitive Engine
 * Motor principal que orquesta el análisis cognitivo
 */

import {
  EyeAnalyzer,
  ExpressionAnalyzer,
  HeadPoseAnalyzer,
} from './analyzers';

import {
  CognitiveClassifier,
  RecommendationEngine,
} from './classifiers';

import type {
  CognitiveEngineConfig,
  CognitiveEngineOutput,
  CognitiveMetrics,
  TemporalAnalysis,
  FacialLandmarks,
  RawFaceData,
} from './types';

// ============================================
// CONFIGURACIÓN POR DEFECTO
// ============================================

const DEFAULT_CONFIG: CognitiveEngineConfig = {
  analysisFrequency: 5, // 5 Hz (5 veces por segundo)
  shortTermWindow: 10, // 10 segundos
  longTermWindow: 60, // 60 segundos
  thresholds: {
    focus: 60,
    stress: 50,
    fatigue: 50,
    distraction: 60,
  },
  sensitivity: 'medium',
};

// ============================================
// MOTOR COGNITIVO PRINCIPAL
// ============================================

export class CognitiveEngine {
  // Analizadores
  private eyeAnalyzer: EyeAnalyzer;
  private expressionAnalyzer: ExpressionAnalyzer;
  private headPoseAnalyzer: HeadPoseAnalyzer;
  
  // Clasificadores
  private classifier: CognitiveClassifier;
  private recommendationEngine: RecommendationEngine;
  
  // Configuración
  private config: CognitiveEngineConfig;
  
  // Estado interno
  private metricsHistory: CognitiveMetrics[] = [];
  private calibrationFrames: number = 0;
  private isCalibrated: boolean = false;
  private lastAnalysisTime: number = 0;
  
  // Eventos detectados
  private interruptions: number = 0;
  private focusPeriods: number = 0;
  private lastState: string | null = null;
  private focusStartTime: number | null = null;
  
  constructor(config: Partial<CognitiveEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Inicializar analizadores
    this.eyeAnalyzer = new EyeAnalyzer();
    this.expressionAnalyzer = new ExpressionAnalyzer();
    this.headPoseAnalyzer = new HeadPoseAnalyzer();
    
    // Inicializar clasificadores
    this.classifier = new CognitiveClassifier(this.config);
    this.recommendationEngine = new RecommendationEngine();
  }
  
  // ============================================
  // MÉTODO PRINCIPAL: PROCESAR FRAME
  // ============================================
  
  process(faceData: RawFaceData): CognitiveEngineOutput | null {
    // Control de frecuencia de análisis
    const now = Date.now();
    const minInterval = 1000 / this.config.analysisFrequency;
    
    if (now - this.lastAnalysisTime < minInterval) {
      return null; // Saltar frame para mantener frecuencia deseada
    }
    
    this.lastAnalysisTime = now;
    
    // Fase de calibración (primeros 30 frames)
    if (this.calibrationFrames < 30) {
      this.calibrationFrames++;
      if (this.calibrationFrames === 30) {
        this.isCalibrated = true;
        console.log('🎯 SYNAPSE UI: Motor cognitivo calibrado');
      }
      return null;
    }
    
    // 1. ANÁLISIS DE SEÑALES
    const eyeMetrics = this.eyeAnalyzer.analyze(faceData.landmarks);
    const expression = this.expressionAnalyzer.analyze(faceData.landmarks);
    const headPose = this.headPoseAnalyzer.analyze(faceData.landmarks);
    
    // 2. CLASIFICACIÓN COGNITIVA
    const currentMetrics = this.classifier.classify(eyeMetrics, expression, headPose);
    
    // 3. GUARDAR EN HISTORIAL
    this.metricsHistory.push(currentMetrics);
    
    // Limpiar historial antiguo (mantener solo longTermWindow)
    const cutoffTime = now - this.config.longTermWindow * 1000;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);
    
    // 4. DETECTAR EVENTOS
    this.detectEvents(currentMetrics);
    
    // 5. ANÁLISIS TEMPORAL
    const temporal = this.calculateTemporalAnalysis();
    
    // 6. GENERAR RECOMENDACIONES
    const recommendations = this.recommendationEngine.generateRecommendations(currentMetrics);
    
    // 7. CONSTRUIR OUTPUT
    const output: CognitiveEngineOutput = {
      current: currentMetrics,
      temporal,
      recommendations,
      isCalibrated: this.isCalibrated,
      confidence: currentMetrics.confidence,
    };
    
    return output;
  }
  
  // ============================================
  // ANÁLISIS TEMPORAL
  // ============================================
  
  private calculateTemporalAnalysis(): TemporalAnalysis {
    const now = Date.now();
    
    // Métricas a corto plazo (últimos 10 segundos)
    const shortTermCutoff = now - this.config.shortTermWindow * 1000;
    const shortTermMetrics = this.metricsHistory.filter(m => m.timestamp > shortTermCutoff);
    
    // Métricas a largo plazo (últimos 60 segundos)
    const longTermCutoff = now - this.config.longTermWindow * 1000;
    const longTermMetrics = this.metricsHistory.filter(m => m.timestamp > longTermCutoff);
    
    // Calcular promedios
    const avgFocus = this.calculateAverage(longTermMetrics, 'focusScore');
    const avgStress = this.calculateAverage(longTermMetrics, 'stressScore');
    const avgFatigue = this.calculateAverage(longTermMetrics, 'fatigueScore');
    const avgDistraction = this.calculateAverage(longTermMetrics, 'distractionScore');
    
    // Calcular tendencias
    const focusTrend = this.calculateTrend(shortTermMetrics, longTermMetrics, 'focusScore');
    const stressTrend = this.calculateTrend(shortTermMetrics, longTermMetrics, 'stressScore');
    const fatigueTrend = this.calculateTrend(shortTermMetrics, longTermMetrics, 'fatigueScore');
    
    return {
      timeWindow: this.config.longTermWindow,
      avgFocus,
      avgStress,
      avgFatigue,
      avgDistraction,
      focusTrend,
      stressTrend,
      fatigueTrend,
      interruptions: this.interruptions,
      focusPeriods: this.focusPeriods,
    };
  }
  
  private calculateAverage(metrics: CognitiveMetrics[], key: keyof CognitiveMetrics): number {
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => {
      const value = m[key];
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    
    return Math.round(sum / metrics.length);
  }
  
  private calculateTrend(
    shortTerm: CognitiveMetrics[],
    longTerm: CognitiveMetrics[],
    key: keyof CognitiveMetrics
  ): 'increasing' | 'decreasing' | 'stable' {
    if (shortTerm.length < 3 || longTerm.length < 10) return 'stable';
    
    const shortAvg = this.calculateAverage(shortTerm, key);
    const longAvg = this.calculateAverage(longTerm, key);
    
    const diff = shortAvg - longAvg;
    
    if (diff > 10) return 'increasing';
    if (diff < -10) return 'decreasing';
    return 'stable';
  }
  
  // ============================================
  // DETECCIÓN DE EVENTOS
  // ============================================
  
  private detectEvents(metrics: CognitiveMetrics): void {
    const currentState = metrics.currentState;
    
    // Detectar cambios de estado (interrupciones)
    if (this.lastState && this.lastState !== currentState) {
      this.interruptions++;
      
      // Si salimos del estado de foco, registrar período
      if (this.lastState === 'focus' && this.focusStartTime) {
        const duration = Date.now() - this.focusStartTime;
        if (duration > 30000) { // Mínimo 30 segundos
          this.focusPeriods++;
        }
        this.focusStartTime = null;
      }
    }
    
    // Si entramos en estado de foco, marcar inicio
    if (currentState === 'focus' && this.lastState !== 'focus') {
      this.focusStartTime = Date.now();
    }
    
    this.lastState = currentState;
  }
  
  // ============================================
  // MÉTODOS PÚBLICOS ÚTILES
  // ============================================
  
  reset(): void {
    this.metricsHistory = [];
    this.calibrationFrames = 0;
    this.isCalibrated = false;
    this.interruptions = 0;
    this.focusPeriods = 0;
    this.lastState = null;
    this.focusStartTime = null;
    console.log('🔄 SYNAPSE UI: Motor cognitivo reiniciado');
  }
  
  getSessionSummary(): {
    totalTime: number;
    avgFocus: number;
    avgStress: number;
    avgFatigue: number;
    interruptions: number;
    focusPeriods: number;
  } {
    if (this.metricsHistory.length === 0) {
      return {
        totalTime: 0,
        avgFocus: 0,
        avgStress: 0,
        avgFatigue: 0,
        interruptions: 0,
        focusPeriods: 0,
      };
    }
    
    const firstTimestamp = this.metricsHistory[0].timestamp;
    const lastTimestamp = this.metricsHistory[this.metricsHistory.length - 1].timestamp;
    const totalTime = (lastTimestamp - firstTimestamp) / 1000; // en segundos
    
    return {
      totalTime,
      avgFocus: this.calculateAverage(this.metricsHistory, 'focusScore'),
      avgStress: this.calculateAverage(this.metricsHistory, 'stressScore'),
      avgFatigue: this.calculateAverage(this.metricsHistory, 'fatigueScore'),
      interruptions: this.interruptions,
      focusPeriods: this.focusPeriods,
    };
  }
  
  updateConfig(newConfig: Partial<CognitiveEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.classifier = new CognitiveClassifier(this.config);
    console.log('⚙️ SYNAPSE UI: Configuración actualizada');
  }
}

// ============================================
// EXPORTAR INSTANCIA SINGLETON (OPCIONAL)
// ============================================

let engineInstance: CognitiveEngine | null = null;

export function getCognitiveEngine(config?: Partial<CognitiveEngineConfig>): CognitiveEngine {
  if (!engineInstance) {
    engineInstance = new CognitiveEngine(config);
  }
  return engineInstance;
}

export function resetCognitiveEngine(): void {
  if (engineInstance) {
    engineInstance.reset();
  }
  engineInstance = null;
}