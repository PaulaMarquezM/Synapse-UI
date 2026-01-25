/**
 * SYNAPSE UI - Cognitive State Classifiers
 * Clasifica el estado cognitivo basado en las señales faciales
 */

import type {
  CognitiveState,
  CognitiveMetrics,
  EyeMetrics,
  FacialExpression,
  HeadPose,
  CognitiveEngineConfig,
} from './types';

// ============================================
// CLASIFICADOR PRINCIPAL
// ============================================

export class CognitiveClassifier {
  private config: CognitiveEngineConfig;
  
  constructor(config: CognitiveEngineConfig) {
    this.config = config;
  }
  
  classify(
    eyeMetrics: EyeMetrics,
    expression: FacialExpression,
    headPose: HeadPose
  ): CognitiveMetrics {
    // Calcular scores individuales
    const focusScore = this.calculateFocusScore(eyeMetrics, headPose);
    const stressScore = this.calculateStressScore(expression, eyeMetrics);
    const fatigueScore = this.calculateFatigueScore(eyeMetrics, headPose);
    const distractionScore = this.calculateDistractionScore(eyeMetrics, headPose);
    
    // Determinar estado dominante
    const { state, confidence } = this.determineState(
      focusScore,
      stressScore,
      fatigueScore,
      distractionScore
    );
    
    return {
      focusScore,
      stressScore,
      fatigueScore,
      distractionScore,
      currentState: state,
      confidence,
      timestamp: Date.now(),
    };
  }
  
  // ============================================
  // CÁLCULO DE SCORE DE CONCENTRACIÓN
  // ============================================
  
  private calculateFocusScore(eyeMetrics: EyeMetrics, headPose: HeadPose): number {
    let score = 0;
    
    // 1. Estabilidad de la mirada (40% del score)
    score += eyeMetrics.gazeStability * 40;
    
    // 2. Estabilidad de la cabeza (30% del score)
    score += headPose.stability * 30;
    
    // 3. Apertura de ojos (20% del score)
    // Ojos muy abiertos = alerta, ojos cerrados = no enfocado
    const eyeOpennessScore = eyeMetrics.eyeOpenness > 0.6 ? 1 : eyeMetrics.eyeOpenness / 0.6;
    score += eyeOpennessScore * 20;
    
    // 4. Postura frontal (10% del score)
    // Cabeza centrada indica atención
    const frontalScore = 1 - (Math.abs(headPose.yaw) + Math.abs(headPose.pitch)) / 180;
    score += frontalScore * 10;
    
    // Aplicar sensibilidad
    score = this.applySensitivity(score);
    
    return Math.round(Math.min(100, Math.max(0, score)));
  }
  
  // ============================================
  // CÁLCULO DE SCORE DE ESTRÉS
  // ============================================
  
  private calculateStressScore(expression: FacialExpression, eyeMetrics: EyeMetrics): number {
    let score = 0;
    
    // 1. Ceño fruncido (50% del score)
    score += expression.eyebrowFurrow * 50;
    
    // 2. Tensión en la boca (30% del score)
    score += expression.mouthTension * 30;
    
    // 3. Frecuencia de parpadeo anormal (20% del score)
    // Parpadeo normal: 15-20 por minuto
    // Estrés: >30 o <10 por minuto
    const blinkRate = eyeMetrics.blinkRate;
    let blinkStress = 0;
    
    if (blinkRate > 30) {
      blinkStress = Math.min((blinkRate - 30) / 20, 1); // Parpadeo rápido
    } else if (blinkRate < 10) {
      blinkStress = (10 - blinkRate) / 10; // Parpadeo lento (fijación)
    }
    
    score += blinkStress * 20;
    
    // Aplicar sensibilidad
    score = this.applySensitivity(score);
    
    return Math.round(Math.min(100, Math.max(0, score)));
  }
  
  // ============================================
  // CÁLCULO DE SCORE DE FATIGA
  // ============================================
  
  private calculateFatigueScore(eyeMetrics: EyeMetrics, headPose: HeadPose): number {
    let score = 0;
    
    // 1. Apertura de ojos reducida (40% del score)
    const eyeFatigue = 1 - eyeMetrics.eyeOpenness;
    score += eyeFatigue * 40;
    
    // 2. Frecuencia de parpadeo lento (30% del score)
    // Fatiga: < 10 parpadeos por minuto
    const blinkRate = eyeMetrics.blinkRate;
    const blinkFatigue = blinkRate < 10 ? (10 - blinkRate) / 10 : 0;
    score += blinkFatigue * 30;
    
    // 3. Inclinación de cabeza hacia abajo (20% del score)
    // Cabeza caída indica fatiga
    const headDrop = headPose.pitch > 0 ? headPose.pitch / 90 : 0;
    score += headDrop * 20;
    
    // 4. Estabilidad reducida (10% del score)
    const instability = 1 - headPose.stability;
    score += instability * 10;
    
    // Aplicar sensibilidad
    score = this.applySensitivity(score);
    
    return Math.round(Math.min(100, Math.max(0, score)));
  }
  
  // ============================================
  // CÁLCULO DE SCORE DE DISTRACCIÓN
  // ============================================
  
  private calculateDistractionScore(eyeMetrics: EyeMetrics, headPose: HeadPose): number {
    let score = 0;
    
    // 1. Inestabilidad de la mirada (50% del score)
    const gazeInstability = 1 - eyeMetrics.gazeStability;
    score += gazeInstability * 50;
    
    // 2. Movimiento de cabeza (30% del score)
    const headMovement = 1 - headPose.stability;
    score += headMovement * 30;
    
    // 3. Mirada fuera del centro (20% del score)
    // Distancia euclidiana desde el centro (0, 0)
    const gazeOffset = Math.sqrt(
      Math.pow(eyeMetrics.gazeDirection.x, 2) +
      Math.pow(eyeMetrics.gazeDirection.y, 2)
    );
    const gazeDistraction = Math.min(gazeOffset / 1.414, 1); // Normalizado
    score += gazeDistraction * 20;
    
    // Aplicar sensibilidad
    score = this.applySensitivity(score);
    
    return Math.round(Math.min(100, Math.max(0, score)));
  }
  
  // ============================================
  // DETERMINAR ESTADO DOMINANTE
  // ============================================
  
  private determineState(
    focusScore: number,
    stressScore: number,
    fatigueScore: number,
    distractionScore: number
  ): { state: CognitiveState; confidence: number } {
    const scores = {
      focus: focusScore,
      stress: stressScore,
      fatigue: fatigueScore,
      distraction: distractionScore,
    };
    
    // Encontrar el score máximo
    const maxScore = Math.max(focusScore, stressScore, fatigueScore, distractionScore);
    
    // Si el score máximo es bajo, es estado neutral
    if (maxScore < 40) {
      return {
        state: 'neutral' as CognitiveState,
        confidence: 0.5,
      };
    }
    
    // Determinar estado según umbrales
    let dominantState: CognitiveState = 'neutral' as CognitiveState;
    
    if (focusScore >= this.config.thresholds.focus && focusScore === maxScore) {
      dominantState = 'focus' as CognitiveState;
    } else if (stressScore >= this.config.thresholds.stress && stressScore === maxScore) {
      dominantState = 'stress' as CognitiveState;
    } else if (fatigueScore >= this.config.thresholds.fatigue && fatigueScore === maxScore) {
      dominantState = 'fatigue' as CognitiveState;
    } else if (distractionScore >= this.config.thresholds.distraction && distractionScore === maxScore) {
      dominantState = 'distraction' as CognitiveState;
    }
    
    // Calcular confianza basada en la diferencia con el segundo score más alto
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const confidence = sortedScores.length > 1
      ? (sortedScores[0] - sortedScores[1]) / 100
      : 0.5;
    
    return {
      state: dominantState,
      confidence: Math.min(Math.max(confidence, 0), 1),
    };
  }
  
  // ============================================
  // APLICAR SENSIBILIDAD
  // ============================================
  
  private applySensitivity(score: number): number {
    switch (this.config.sensitivity) {
      case 'low':
        // Requiere señales más fuertes
        return score * 0.7;
      case 'high':
        // Más sensible a cambios sutiles
        return Math.min(score * 1.3, 100);
      case 'medium':
      default:
        return score;
    }
  }
}

// ============================================
// GENERADOR DE RECOMENDACIONES
// ============================================

export class RecommendationEngine {
  generateRecommendations(metrics: CognitiveMetrics): string[] {
    const recommendations: string[] = [];
    
    switch (metrics.currentState) {
      case 'focus':
        recommendations.push('🎯 Excelente concentración. Continúa así.');
        if (metrics.focusScore > 80) {
          recommendations.push('💡 Considera tomar un descanso en 20 minutos.');
        }
        break;
        
      case 'stress':
        recommendations.push('😰 Nivel de estrés elevado detectado.');
        recommendations.push('🧘 Prueba la técnica 4-7-8: inhala 4s, sostén 7s, exhala 8s.');
        if (metrics.stressScore > 70) {
          recommendations.push('⏸️ Considera tomar un descanso de 5 minutos.');
        }
        break;
        
      case 'fatigue':
        recommendations.push('😴 Signos de fatiga detectados.');
        recommendations.push('💧 Hidrátate y descansa tus ojos.');
        if (metrics.fatigueScore > 60) {
          recommendations.push('⏰ Recomendado: descanso de 10-15 minutos.');
        }
        break;
        
      case 'distraction':
        recommendations.push('👀 Nivel de distracción alto.');
        recommendations.push('🔕 Minimiza notificaciones y ruido ambiental.');
        if (metrics.distractionScore > 70) {
          recommendations.push('📱 Activa modo "No molestar".');
        }
        break;
        
      case 'neutral':
        recommendations.push('😊 Estado normal. Listo para trabajar.');
        break;
    }
    
    return recommendations;
  }
}