/**
 * SYNAPSE UI - Cognitive Engine
 * Punto de entrada principal del motor cognitivo
 */

// Exportar el motor principal
export { CognitiveEngine, getCognitiveEngine, resetCognitiveEngine } from './engine';

// Exportar analizadores (por si se necesitan directamente)
export { EyeAnalyzer, ExpressionAnalyzer, HeadPoseAnalyzer } from './analyzers';

// Exportar clasificadores
export { CognitiveClassifier, RecommendationEngine } from './classifiers';

// Exportar todos los tipos
export * from './types';

// Re-exportar tipos específicos para conveniencia
export type {
  CognitiveEngineOutput,
  CognitiveMetrics,
  CognitiveState,
  CognitiveEngineConfig,
  TemporalAnalysis,
} from './types';