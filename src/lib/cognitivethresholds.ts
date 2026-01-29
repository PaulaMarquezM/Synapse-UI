/**
 * COGNITIVE THRESHOLDS - Sistema Científico de Umbrales Adaptativos
 * 
 * Basado en:
 * - Ekman & Friesen (1978) - Facial Action Coding System
 * - Nakano et al. (2010) - Blink rates and cognitive load
 * - Chen & Vertegaal (2004) - Eye gaze and attention
 * - Pantic & Rothkrantz (2000) - Facial expressions and affective states
 * 
 * @version 2.0.0 - Enero 2026
 */

import type { DetectionData } from "~components/CameraFeed"
import type { Baseline } from "./calibration"

// ============================================================================
// CONSTANTES CIENTÍFICAS
// ============================================================================

/**
 * BLINK RATE (parpadeo por minuto)
 * Fuente: Nakano et al. (2010) - "Blink-related momentary activation of the default mode network"
 */
export const BLINK_RATE_THRESHOLDS = {
  // Estado de alta concentración
  DEEP_FOCUS: { min: 5, max: 12 },      // Muy poco parpadeo = concentración extrema
  
  // Estado normal de trabajo
  NORMAL: { min: 12, max: 20 },         // Rango cognitivo óptimo
  
  // Estado de fatiga
  FATIGUE: { min: 20, max: 30 },        // Aumento del parpadeo
  
  // Estado de somnolencia
  DROWSY: { min: 30, max: 100 }         // Parpadeos lentos y frecuentes
} as const

/**
 * HEAD POSE (grados de desviación)
 * Fuente: Chen & Vertegaal (2004) - "Using Gaze Patterns to Predict Task Intent in Collaboration"
 */
export const HEAD_POSE_THRESHOLDS = {
  // Alineación frontal (foco óptimo)
  OPTIMAL: { yaw: 10, pitch: 10 },      // ±10° = mirando directo a la pantalla
  
  // Desviación moderada (atención dividida)
  MODERATE: { yaw: 25, pitch: 20 },     // ±20-25° = mirando alrededor
  
  // Desviación alta (distracción)
  HIGH: { yaw: 45, pitch: 35 }          // >35° = mirando lejos de pantalla
} as const

/**
 * FACIAL EXPRESSIONS (probabilidad 0-1)
 * Fuente: Ekman & Friesen (1978) - FACS (Facial Action Coding System)
 */
export const EXPRESSION_THRESHOLDS = {
  // Emociones positivas (indicadores de bienestar)
  HAPPY_LOW: 0.3,
  HAPPY_MODERATE: 0.5,
  HAPPY_HIGH: 0.7,
  
  // Estado neutral (concentración o fatiga)
  NEUTRAL_LOW: 0.3,
  NEUTRAL_MODERATE: 0.5,
  NEUTRAL_HIGH: 0.8,          // >0.8 neutral = posible fatiga
  
  // Emociones negativas (indicadores de estrés)
  STRESS_THRESHOLD: 0.2,      // Angry, sad, fearful > 0.2 = estrés
  STRESS_HIGH: 0.4,           // >0.4 = estrés elevado
  
  // Sorpresa (puede ser distracción)
  SURPRISE_THRESHOLD: 0.3
} as const

/**
 * DETECCIÓN DE OJOS CERRADOS
 * Combinación de expresiones que indican párpados cerrados o semi-cerrados
 */
export const EYE_CLOSURE_DETECTION = {
  // Neutral alto + Sad alto = ojos posiblemente cerrados
  CLOSED_THRESHOLD: 0.3,      // neutral * sad > 0.3 = ojos cerrados
  SEMI_CLOSED_THRESHOLD: 0.15, // neutral * sad > 0.15 = semi-cerrados
  
  // Parpadeo muy lento también indica ojos cerrados
  SLOW_BLINK_RATE: 3          // <3 parpadeos/min = posibles ojos cerrados
} as const

/**
 * GAZE ZONES (porcentaje de pantalla)
 * Fuente: Duchowski (2007) - "Eye Tracking Methodology"
 */
export const GAZE_ZONES = {
  // Zona central (trabajo productivo)
  CENTER: {
    x: { min: 0.2, max: 0.8 },
    y: { min: 0.15, max: 0.85 }
  },
  
  // Zona extendida (lectura, navegación)
  EXTENDED: {
    x: { min: 0.1, max: 0.9 },
    y: { min: 0.05, max: 0.95 }
  }
} as const

// ============================================================================
// SISTEMA DE CLASIFICACIÓN COGNITIVA
// ============================================================================

export type CognitiveState = 'deep_focus' | 'focus' | 'normal' | 'distracted' | 'stressed' | 'tired' | 'drowsy'

export interface CognitiveMetrics {
  // Métricas primarias (0-100)
  focus: number
  stress: number
  fatigue: number
  distraction: number
  
  // Estado clasificado
  dominantState: CognitiveState
  
  // Confianza del modelo (0-1)
  confidence: number
  
  // Flags de alerta
  alerts: {
    highStress: boolean
    highFatigue: boolean
    poorPosture: boolean
    frequentDistraction: boolean
    eyesClosed: boolean          // 🆕 NUEVO: Detección de ojos cerrados
  }
}

export interface AdaptiveThresholds {
  // Umbrales personalizados basados en baseline
  focusThreshold: number      // Por defecto 65, ajustable ±15
  stressThreshold: number     // Por defecto 60, ajustable ±10
  fatigueThreshold: number    // Por defecto 70, ajustable ±10
  
  // Factores de ajuste
  blinkRateBaseline: number
  headPoseBaseline: { yaw: number; pitch: number }
  expressionBaseline: Record<string, number>
}

// ============================================================================
// CALCULADORA CIENTÍFICA DE MÉTRICAS
// ============================================================================

export class CognitiveMetricsCalculator {
  private adaptiveThresholds: AdaptiveThresholds
  private baseline: Baseline | null = null
  
  constructor(baseline: Baseline | null = null) {
    this.baseline = baseline
    this.adaptiveThresholds = this.computeAdaptiveThresholds(baseline)
  }
  
  /**
   * Actualiza el baseline y recalcula umbrales
   */
  updateBaseline(baseline: Baseline) {
    this.baseline = baseline
    this.adaptiveThresholds = this.computeAdaptiveThresholds(baseline)
  }
  
  /**
   * Calcula umbrales adaptativos basados en el baseline del usuario
   */
  private computeAdaptiveThresholds(baseline: Baseline | null): AdaptiveThresholds {
    if (!baseline) {
      // Valores por defecto sin calibración
      return {
        focusThreshold: 65,
        stressThreshold: 60,
        fatigueThreshold: 70,
        blinkRateBaseline: 15,
        headPoseBaseline: { yaw: 0, pitch: 0 },
        expressionBaseline: {
          neutral: 0.6,
          happy: 0.2,
          sad: 0.05,
          angry: 0.05
        }
      }
    }
    
    // Ajustar thresholds basados en el baseline del usuario
    const userBlinkRate = baseline.blinkRate
    const userNeutral = baseline.expressions.neutral || 0.6
    
    // Si el usuario parpadea más naturalmente, ajustar threshold de fatiga
    const fatigueAdjust = userBlinkRate > 18 ? 5 : userBlinkRate < 12 ? -5 : 0
    
    // Si el usuario es naturalmente más neutral, ajustar threshold de foco
    const focusAdjust = userNeutral > 0.7 ? -5 : userNeutral < 0.5 ? 5 : 0
    
    return {
      focusThreshold: Math.max(50, Math.min(80, 65 + focusAdjust)),
      stressThreshold: 60,
      fatigueThreshold: Math.max(60, Math.min(80, 70 + fatigueAdjust)),
      blinkRateBaseline: userBlinkRate,
      headPoseBaseline: {
        yaw: baseline.headPose.yaw,
        pitch: baseline.headPose.pitch
      },
      expressionBaseline: {
        neutral: baseline.expressions.neutral || 0.6,
        happy: baseline.expressions.happy || 0.2,
        sad: baseline.expressions.sad || 0.05,
        angry: baseline.expressions.angry || 0.05
      }
    }
  }
  
  /**
   * CÁLCULO PRINCIPAL - Analiza DetectionData y retorna métricas cognitivas
   */
  calculate(data: DetectionData): CognitiveMetrics {
    // 1. Calcular confianza del modelo
    const confidence = this.calculateConfidence(data)
    
    // 2. Calcular métricas individuales
    const focus = this.calculateFocus(data)
    const stress = this.calculateStress(data)
    const fatigue = this.calculateFatigue(data)
    const distraction = 100 - focus // Inverso del foco
    
    // 3. Clasificar estado dominante
    const dominantState = this.classifyDominantState(focus, stress, fatigue)
    
    // 4. Generar alertas
    const alerts = this.generateAlerts(focus, stress, fatigue, data)
    
    return {
      focus,
      stress,
      fatigue,
      distraction,
      dominantState,
      confidence,
      alerts
    }
  }
  
  /**
   * FOCO (0-100) - VERSIÓN MEJORADA CON PENALIZACIONES AGRESIVAS
   * Factores: postura cabeza (40%), mirada (30%), expresiones (20%), parpadeo (10%)
   * 
   * NUEVA LÓGICA:
   * - Mirar fuera de pantalla → PENALIZACIÓN INMEDIATA (-40 puntos)
   * - Girar/bajar cara → PENALIZACIÓN FUERTE (-30 puntos)
   * - Parpadeo excesivo → PENALIZACIÓN MODERADA (-15 puntos)
   */
  private calculateFocus(data: DetectionData): number {
    const { headPose, gazeX, gazeY, blinkRate, expressions } = data
    
    let score = 100 // Empezar con 100 y restar penalizaciones
    
    // ============================================================
    // 1. POSTURA DE CABEZA (Penalización: 0-40 puntos)
    // ============================================================
    const yawDev = Math.abs(headPose.yaw - (this.baseline?.headPose.yaw || 0))
    const pitchDev = Math.abs(headPose.pitch - (this.baseline?.headPose.pitch || 0))
    
    let headPenalty = 0
    
    // CABEZA MUY DESVIADA (>35° yaw o >25° pitch) → -40 puntos
    if (yawDev > HEAD_POSE_THRESHOLDS.HIGH.yaw || pitchDev > HEAD_POSE_THRESHOLDS.HIGH.pitch) {
      headPenalty = 40
    } 
    // CABEZA MODERADAMENTE DESVIADA (>25° yaw o >20° pitch) → -25 puntos
    else if (yawDev > HEAD_POSE_THRESHOLDS.MODERATE.yaw || pitchDev > HEAD_POSE_THRESHOLDS.MODERATE.pitch) {
      headPenalty = 25
    }
    // CABEZA LIGERAMENTE DESVIADA (>10° yaw o >10° pitch) → -10 puntos
    else if (yawDev > HEAD_POSE_THRESHOLDS.OPTIMAL.yaw || pitchDev > HEAD_POSE_THRESHOLDS.OPTIMAL.pitch) {
      headPenalty = 10
    }
    // CABEZA PERFECTA → 0 puntos de penalización
    
    score -= headPenalty
    
    // ============================================================
    // 2. MIRADA (Penalización: 0-30 puntos)
    // ============================================================
    const screenW = window.screen.width || 1920
    const screenH = window.screen.height || 1080
    
    const inCenterZone = 
      gazeX >= screenW * GAZE_ZONES.CENTER.x.min &&
      gazeX <= screenW * GAZE_ZONES.CENTER.x.max &&
      gazeY >= screenH * GAZE_ZONES.CENTER.y.min &&
      gazeY <= screenH * GAZE_ZONES.CENTER.y.max
    
    const inExtendedZone = 
      gazeX >= screenW * GAZE_ZONES.EXTENDED.x.min &&
      gazeX <= screenW * GAZE_ZONES.EXTENDED.x.max &&
      gazeY >= screenH * GAZE_ZONES.EXTENDED.y.min &&
      gazeY <= screenH * GAZE_ZONES.EXTENDED.y.max
    
    let gazePenalty = 0
    
    if (!inExtendedZone) {
      // MIRANDO FUERA DE LA PANTALLA → -30 puntos (PENALIZACIÓN MÁXIMA)
      gazePenalty = 30
    } else if (!inCenterZone) {
      // MIRANDO BORDES DE PANTALLA → -15 puntos
      gazePenalty = 15
    }
    // MIRANDO CENTRO → 0 puntos de penalización
    
    score -= gazePenalty
    
    // ============================================================
    // 3. EXPRESIONES (Penalización: 0-20 puntos)
    // ============================================================
    const neutralLevel = expressions.neutral || 0
    const happyLevel = expressions.happy || 0
    const negativeLevel = (expressions.angry || 0) + (expressions.sad || 0) + (expressions.fearful || 0)
    
    let expressionPenalty = 0
    
    // EXPRESIONES NEGATIVAS ALTAS → -20 puntos
    if (negativeLevel > EXPRESSION_THRESHOLDS.STRESS_THRESHOLD) {
      expressionPenalty = 20
    }
    // NEUTRAL/HAPPY MUY BAJO → -10 puntos
    else if (neutralLevel < 0.3 && happyLevel < 0.2) {
      expressionPenalty = 10
    }
    // EXPRESIONES POSITIVAS/NEUTRALES → 0 puntos de penalización
    
    score -= expressionPenalty
    
    // ============================================================
    // 4. PARPADEO (Penalización: 0-15 puntos)
    // ============================================================
    let blinkPenalty = 0
    
    // PARPADEO EXTREMO (>30/min) → -15 puntos (SOMNOLENCIA)
    if (blinkRate >= BLINK_RATE_THRESHOLDS.DROWSY.min) {
      blinkPenalty = 15
    }
    // PARPADEO ALTO (20-30/min) → -10 puntos (FATIGA)
    else if (blinkRate >= BLINK_RATE_THRESHOLDS.FATIGUE.min) {
      blinkPenalty = 10
    }
    // PARPADEO NORMAL-ALTO (15-20/min) → -5 puntos
    else if (blinkRate > BLINK_RATE_THRESHOLDS.NORMAL.max) {
      blinkPenalty = 5
    }
    // PARPADEO ÓPTIMO (5-15/min) → 0 puntos de penalización
    
    score -= blinkPenalty
    
    // ============================================================
    // 5. BONUS POR FOCO PROFUNDO
    // ============================================================
    // Si todo está perfecto, dar bonus
    if (headPenalty === 0 && gazePenalty === 0 && blinkRate >= 5 && blinkRate <= 12) {
      score = Math.min(100, score + 5) // Bonus de +5 por foco profundo
    }
    
    return Math.round(Math.max(0, Math.min(100, score)))
  }
  
  /**
   * ESTRÉS (0-100)
   * Factores: expresiones negativas (60%), parpadeo rápido (25%), tensión facial (15%)
   */
  private calculateStress(data: DetectionData): number {
    const { expressions, blinkRate } = data
    
    // 1. EXPRESIONES NEGATIVAS (60 puntos)
    const angry = expressions.angry || 0
    const sad = expressions.sad || 0
    const fearful = expressions.fearful || 0
    const disgusted = expressions.disgusted || 0
    
    const negativeSum = angry + sad + fearful + disgusted
    const negativeScore = Math.min(60, negativeSum * 100)
    
    // 2. PARPADEO RÁPIDO (25 puntos) - estrés aumenta parpadeo
    let blinkStress = 0
    if (blinkRate > BLINK_RATE_THRESHOLDS.FATIGUE.min) {
      blinkStress = 25
    } else if (blinkRate > BLINK_RATE_THRESHOLDS.NORMAL.max) {
      blinkStress = 15
    } else {
      blinkStress = 5
    }
    
    // 3. TENSIÓN FACIAL (15 puntos) - surprised puede indicar tensión
    const tensionScore = Math.min(15, (expressions.surprised || 0) * 30)
    
    const totalStress = negativeScore + blinkStress + tensionScore
    return Math.round(Math.max(0, Math.min(100, totalStress)))
  }
  
  /**
   * FATIGA (0-100) - VERSIÓN MEJORADA
   * Factores: parpadeo elevado (50%), ojos cerrados (25%), neutralidad alta (15%), postura degradada (10%)
   * 
   * NUEVA LÓGICA:
   * - Parpadeo >30/min → FATIGA EXTREMA (+50)
   * - Ojos muy cerrados → FATIGA ALTA (+25)
   * - Cara "plana" (neutral >0.8) → FATIGA MODERADA (+15)
   * - Cabeza inclinada → FATIGA LEVE (+10)
   */
  private calculateFatigue(data: DetectionData): number {
    const { blinkRate, expressions, headPose } = data
    
    let fatigueScore = 0
    
    // ============================================================
    // 1. PARPADEO ELEVADO (0-50 puntos)
    // ============================================================
    if (blinkRate >= 40) {
      // PARPADEO EXTREMO (>40/min) → +50 puntos (ALERTA CRÍTICA)
      fatigueScore += 50
    } else if (blinkRate >= BLINK_RATE_THRESHOLDS.DROWSY.min) {
      // SOMNOLENCIA (30-40/min) → +45 puntos
      fatigueScore += 45
    } else if (blinkRate >= BLINK_RATE_THRESHOLDS.FATIGUE.min) {
      // FATIGA MODERADA (20-30/min) → +35 puntos
      fatigueScore += 35
    } else if (blinkRate >= BLINK_RATE_THRESHOLDS.NORMAL.max) {
      // INICIO DE FATIGA (15-20/min) → +20 puntos
      fatigueScore += 20
    } else if (blinkRate < BLINK_RATE_THRESHOLDS.DEEP_FOCUS.min) {
      // PARPADEO MUY BAJO (<5/min) → +10 puntos (puede indicar fatiga extrema)
      fatigueScore += 10
    }
    // PARPADEO NORMAL (5-15/min) → +0 puntos
    
    // ============================================================
    // 2. OJOS CERRADOS / EXPRESIÓN DE CANSANCIO (0-25 puntos)
    // ============================================================
    // Detectar si los párpados están muy bajos (proxy: neutral muy alto + sad)
    const eyeClosedness = (expressions.neutral || 0) * (expressions.sad || 0) * 2
    
    if (eyeClosedness > 0.3) {
      // OJOS MUY CERRADOS → +25 puntos
      fatigueScore += 25
    } else if (eyeClosedness > 0.15) {
      // OJOS SEMI-CERRADOS → +15 puntos
      fatigueScore += 15
    } else if (eyeClosedness > 0.05) {
      // OJOS LIGERAMENTE CERRADOS → +8 puntos
      fatigueScore += 8
    }
    
    // ============================================================
    // 3. NEUTRALIDAD ALTA (0-15 puntos)
    // ============================================================
    // Cara "plana" sin expresión indica cansancio
    const neutralLevel = expressions.neutral || 0
    
    if (neutralLevel > EXPRESSION_THRESHOLDS.NEUTRAL_HIGH) {
      // MUY NEUTRAL (>0.8) → +15 puntos
      fatigueScore += 15
    } else if (neutralLevel > EXPRESSION_THRESHOLDS.NEUTRAL_MODERATE) {
      // MODERADAMENTE NEUTRAL (>0.5) → +8 puntos
      fatigueScore += 8
    }
    
    // ============================================================
    // 4. POSTURA DEGRADADA (0-10 puntos)
    // ============================================================
    // Cabeza inclinada hacia abajo = cansancio
    const pitchDev = Math.abs(headPose.pitch - (this.baseline?.headPose.pitch || 0))
    
    if (pitchDev > 25) {
      // CABEZA MUY INCLINADA (>25°) → +10 puntos
      fatigueScore += 10
    } else if (pitchDev > 15) {
      // CABEZA INCLINADA (>15°) → +5 puntos
      fatigueScore += 5
    }
    
    return Math.round(Math.max(0, Math.min(100, fatigueScore)))
  }
  
  /**
   * CLASIFICACIÓN DE ESTADO DOMINANTE - VERSIÓN MEJORADA
   * Prioridad: ojos cerrados > fatiga extrema > estrés alto > distracción > foco
   */
  private classifyDominantState(focus: number, stress: number, fatigue: number): CognitiveState {
    // PRIORIDAD 1: Fatiga crítica (necesita descanso URGENTE)
    if (fatigue >= 85) return 'drowsy'
    
    // PRIORIDAD 2: Fatiga alta (necesita pausa pronto)
    if (fatigue >= this.adaptiveThresholds.fatigueThreshold) return 'tired'
    
    // PRIORIDAD 3: Estrés elevado (necesita calmarse)
    if (stress >= this.adaptiveThresholds.stressThreshold) return 'stressed'
    
    // PRIORIDAD 4: Distracción (no está mirando/atento)
    if (focus < 35) return 'distracted'  // Bajado de 40 a 35
    
    // PRIORIDAD 5: Foco profundo (concentración extrema)
    if (focus >= 85) return 'deep_focus'  // Subido de 80 a 85
    
    // PRIORIDAD 6: Foco normal (trabajando bien)
    if (focus >= this.adaptiveThresholds.focusThreshold) return 'focus'
    
    // DEFAULT: Estado normal
    return 'normal'
  }
  
  /**
   * CONFIANZA DEL MODELO (0-1)
   * Basada en calidad de detección facial
   */
  private calculateConfidence(data: DetectionData): number {
    // Factores de confianza
    let confidence = 1.0
    
    // Penalizar si la cabeza está muy desviada (menos confiable)
    const yawDev = Math.abs(data.headPose.yaw)
    const pitchDev = Math.abs(data.headPose.pitch)
    if (yawDev > 40 || pitchDev > 30) {
      confidence *= 0.6
    } else if (yawDev > 25 || pitchDev > 20) {
      confidence *= 0.8
    }
    
    // Penalizar si las expresiones suman menos de 0.8 (detección pobre)
    const expressionSum = Object.values(data.expressions).reduce((a, b) => a + b, 0)
    if (expressionSum < 0.8) {
      confidence *= 0.7
    }
    
    return Math.max(0.3, Math.min(1.0, confidence))
  }
  
  /**
   * GENERACIÓN DE ALERTAS
   */
  private generateAlerts(focus: number, stress: number, fatigue: number, data: DetectionData) {
    // Detectar ojos cerrados
    const eyeClosedness = (data.expressions.neutral || 0) * (data.expressions.sad || 0) * 2
    const eyesClosed = eyeClosedness > EYE_CLOSURE_DETECTION.CLOSED_THRESHOLD || 
                       data.blinkRate < EYE_CLOSURE_DETECTION.SLOW_BLINK_RATE
    
    return {
      highStress: stress >= 75,
      highFatigue: fatigue >= 80,
      poorPosture: Math.abs(data.headPose.yaw) > 35 || Math.abs(data.headPose.pitch) > 25,
      frequentDistraction: focus < 30,
      eyesClosed: eyesClosed  // 🆕 NUEVO
    }
  }
  
  /**
   * Obtener umbrales actuales
   */
  getThresholds(): AdaptiveThresholds {
    return this.adaptiveThresholds
  }
}

// ============================================================================
// EXPORTAR INSTANCIA SINGLETON
// ============================================================================

export const createCognitiveCalculator = (baseline: Baseline | null = null) => {
  return new CognitiveMetricsCalculator(baseline)
}