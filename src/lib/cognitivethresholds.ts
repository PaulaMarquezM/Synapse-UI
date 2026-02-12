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
  CLOSED_THRESHOLD: 0.2,      // neutral * sad > 0.2 = ojos cerrados (más sensible)
  SEMI_CLOSED_THRESHOLD: 0.08, // neutral * sad > 0.08 = semi-cerrados

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

export const ATTENTION_RULES = {
  offscreenGraceMs: 2000,
  offscreenMaxMs: 8000,
  offscreenMaxPenalty: 35,
  phonePitchDeg: 18,
  phoneGazeY: 0.75,
  lookUpPitchDeg: 15,
  lookUpGazeY: 0.12,
  sideYawDeg: 25,
  offscreenYawDeg: 35,
  minQualityForDecision: 0.55,
  holdToDistractedMs: 1000,
  holdToOnScreenMs: 450,
  holdToUncertainMs: 300
} as const


// ============================================================================
// SISTEMA DE CLASIFICACIÓN COGNITIVA
// ============================================================================

export type CognitiveState = 'deep_focus' | 'focus' | 'normal' | 'distracted' | 'stressed' | 'tired' | 'drowsy'
export type AttentionClassification = "on_screen" | "off_screen" | "phone_like" | "side_like" | "uncertain"
type AttentionState = {
  onScreen: boolean
  offScreenMs: number
  phoneLooking: boolean
  sideLooking: boolean
  classification: AttentionClassification
  qualityScore: number
  reliable: boolean
}


export interface CognitiveMetrics {
  // Métricas primarias (0-100)
  focus: number
  stress: number
  fatigue: number
  distraction: number
  
  // Estado clasificado
  dominantState: CognitiveState
  
  // Atencion visual
  attention: AttentionState

  // Confianza del modelo (0-1)
  confidence: number
  
  // Flags de alerta
  alerts: {
    highStress: boolean
    highFatigue: boolean
    poorPosture: boolean
    frequentDistraction: boolean
    eyesClosed: boolean
    microsleep: boolean
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
  private offScreenSince: number | null = null
  private lastSeenAt: number = 0
  private lastOnScreenAt: number = 0
  private stableAttention: AttentionClassification = "on_screen"
  private attentionCandidateSince: number | null = null
  private lowQualitySince: number | null = null
  private accumulatedFatigue: number = 0
  private lastFatigueUpdateAt: number = 0

  
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
    const now = Date.now()
    this.lastSeenAt = now
    const attention = this.evaluateAttention(data, now)

    // Trackear tiempo con baja calidad de detección (ojos cerrados, cara parcial)
    const isLowQuality = data.quality && !data.quality.reliable
    if (isLowQuality) {
      if (!this.lowQualitySince) this.lowQualitySince = now
    } else {
      this.lowQualitySince = null
    }
    const lowQualityMs = this.lowQualitySince ? now - this.lowQualitySince : 0

    // 1. Calcular confianza del modelo
    const confidence = this.calculateConfidence(data)

    // 2. Calcular métricas individuales
    const focus = this.calculateFocus(data, attention)
    const stress = this.calculateStress(data)
    let fatigue = this.calculateFatigue(data)

    // Fallback: si la detección es de baja calidad por >1s (ojos cerrados, cara parcial)
    // face-api a veces no da buenos EAR landmarks con ojos cerrados,
    // así que usamos lowQuality como señal secundaria de fatiga
    if (lowQualityMs > 800) {
      const extraFatigue = Math.min(50, Math.round((lowQualityMs - 800) / 150))
      fatigue = Math.min(100, Math.max(fatigue, extraFatigue))
    }

    // Proxy adicional: expresión neutral alta + sad = ojos probablemente cerrados
    const eyeClosednessProxy = (data.expressions.neutral || 0) * (data.expressions.sad || 0) * 2
    if (eyeClosednessProxy > 0.2) {
      fatigue = Math.min(100, fatigue + Math.round(eyeClosednessProxy * 40))
    }

    const distraction = 100 - focus // Inverso del foco

    // 3. Clasificar estado dominante
    const dominantState = this.classifyDominantState(focus, stress, fatigue)

    // 4. Generar alertas
    const alerts = this.generateAlerts(focus, stress, fatigue, data, attention)

    return {
      focus,
      stress,
      fatigue,
      distraction,
      dominantState,
      attention,
      confidence,
      alerts
    }
  }
  
  private getHoldMsForAttention(candidate: AttentionClassification): number {
    if (candidate === "on_screen") return ATTENTION_RULES.holdToOnScreenMs
    if (candidate === "uncertain") return ATTENTION_RULES.holdToUncertainMs
    return ATTENTION_RULES.holdToDistractedMs
  }

  private evaluateAttention(data: DetectionData, now: number): AttentionState {
    const screenW = window.screen.width || 1
    const screenH = window.screen.height || 1
    const gazeXn = data.gazeX / screenW
    const gazeYn = data.gazeY / screenH
    const baseYaw = this.baseline?.headPose.yaw ?? 0
    const basePitch = this.baseline?.headPose.pitch ?? 0
    const yawDev = Math.abs(data.headPose.yaw - baseYaw)
    const pitchDev = Math.abs(data.headPose.pitch - basePitch)
    const qualityScore = data.quality?.score ?? 0.75
    const reliable = (data.quality?.reliable ?? true) && qualityScore >= ATTENTION_RULES.minQualityForDecision

    const inExtended =
      gazeXn >= GAZE_ZONES.EXTENDED.x.min && gazeXn <= GAZE_ZONES.EXTENDED.x.max &&
      gazeYn >= 0.15 && gazeYn <= GAZE_ZONES.EXTENDED.y.max
    const inCenter =
      gazeXn >= GAZE_ZONES.CENTER.x.min && gazeXn <= GAZE_ZONES.CENTER.x.max &&
      gazeYn >= GAZE_ZONES.CENTER.y.min && gazeYn <= GAZE_ZONES.CENTER.y.max

    const onScreenCandidate = inExtended && yawDev < ATTENTION_RULES.offscreenYawDeg && pitchDev < 28
    const phoneCandidate = pitchDev > ATTENTION_RULES.phonePitchDeg && gazeYn > ATTENTION_RULES.phoneGazeY
    const phoneObjectDetected = data.phoneInFrame === true
    // Mirar hacia arriba: pitch negativo (cabeza inclinada arriba) + gaze en zona superior
    const rawPitch = data.headPose.pitch - basePitch
    const lookUpCandidate = rawPitch < -ATTENTION_RULES.lookUpPitchDeg && gazeYn < ATTENTION_RULES.lookUpGazeY
    const sideCandidate =
      yawDev > ATTENTION_RULES.sideYawDeg || !inCenter

    let candidate: AttentionClassification
    if (!reliable) candidate = "uncertain"
    else if (phoneObjectDetected) candidate = "phone_like"
    else if (onScreenCandidate && !lookUpCandidate) candidate = "on_screen"
    else if (phoneCandidate) candidate = "phone_like"
    else if (lookUpCandidate) candidate = "off_screen"
    else if (sideCandidate) candidate = "side_like"
    else candidate = "off_screen"

    if (candidate === this.stableAttention) {
      this.attentionCandidateSince = null
    } else if (this.attentionCandidateSince == null) {
      this.attentionCandidateSince = now
    } else {
      const holdMs = this.getHoldMsForAttention(candidate)
      if (now - this.attentionCandidateSince >= holdMs) {
        this.stableAttention = candidate
        this.attentionCandidateSince = null
      }
    }

    const stable = this.stableAttention
    if (stable === "on_screen") {
      this.offScreenSince = null
      this.lastOnScreenAt = now
    } else if (stable === "uncertain") {
      // No avanzamos timer de offscreen cuando la deteccion no es confiable.
    } else if (!this.offScreenSince) {
      this.offScreenSince = now
    }

    const offScreenMs =
      stable === "on_screen" || stable === "uncertain" || !this.offScreenSince
        ? 0
        : now - this.offScreenSince

    return {
      onScreen: stable === "on_screen",
      offScreenMs,
      phoneLooking: stable === "phone_like",
      sideLooking: stable === "side_like" || stable === "off_screen",
      classification: stable,
      qualityScore,
      reliable
    }
  }

  private computeAttentionPenalty(attention: AttentionState): number {
    if (attention.onScreen || attention.classification === "uncertain" || !attention.reliable) return 0
    const effectiveMs = Math.max(0, attention.offScreenMs - ATTENTION_RULES.offscreenGraceMs)
    const range = Math.max(1, ATTENTION_RULES.offscreenMaxMs - ATTENTION_RULES.offscreenGraceMs)
    const t = Math.min(1, effectiveMs / range)
    let penalty = ATTENTION_RULES.offscreenMaxPenalty * t
    if (attention.phoneLooking) penalty += 10
    else if (attention.sideLooking) penalty += 5
    const qualityBoost = 0.75 + attention.qualityScore * 0.25
    return Math.min(45, penalty * qualityBoost)
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
  private calculateFocus(data: DetectionData, attention: AttentionState): number {
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
    
    const visualPenaltyFactor =
      attention.classification === "uncertain" ? 0.25 : 0.6 + attention.qualityScore * 0.4
    score -= Math.round(headPenalty * visualPenaltyFactor)
    
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
    
    score -= Math.round(gazePenalty * visualPenaltyFactor)
    
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
    // 4.1. OJOS CERRADOS (Penalización: 0-40 puntos)
    // Si los ojos están cerrados, NO hay foco posible
    // ============================================================
    const { eyeState } = data
    if (eyeState.eyesClosed) {
      const closureMs = eyeState.eyeClosureDurationMs
      if (closureMs > 2000) {
        // >2s cerrados → -40 (prácticamente 0 foco)
        score -= 40
      } else if (closureMs > 500) {
        // 500ms-2s → -15 a -40 proporcional
        score -= 15 + Math.round((closureMs - 500) / 1500 * 25)
      } else {
        // <500ms parpadeo → -5
        score -= 5
      }
    }
    // PERCLOS alto también reduce foco
    if (eyeState.perclos > 0.15) {
      score -= Math.round(Math.min(20, (eyeState.perclos - 0.15) / 0.25 * 20))
    }
    
    // ============================================================
    // 4.2. DETECCIÓN BAJA CALIDAD = posibles ojos cerrados (fallback)
    // face-api no siempre da buen EAR cuando los ojos están cerrados
    // ============================================================
    if (data.quality && !data.quality.reliable) {
      score -= 15
    }
    // Proxy por expresiones: neutral alto + sad = párpados caídos
    const eyeClosednessProxy = (expressions.neutral || 0) * (expressions.sad || 0) * 2
    if (eyeClosednessProxy > 0.2) {
      score -= Math.round(Math.min(25, eyeClosednessProxy * 50))
    }

    // ============================================================
    // 4.5. ATENCION VISUAL (penaliza si mira fuera de pantalla)
    // ============================================================
    const attentionPenalty = this.computeAttentionPenalty(attention)
    score -= Math.round(attentionPenalty * visualPenaltyFactor)

    // ============================================================
    // 4.6. CELULAR EN PANTALLA → penalización directa fuerte
    // ============================================================
    if (data.phoneInFrame) {
      score -= 35
    }

    // ============================================================
    // 4.7. MIRAR MUY ARRIBA O MUY ABAJO → no estás en pantalla
    // ============================================================
    const rawPitch = headPose.pitch - (this.baseline?.headPose.pitch || 0)
    if (rawPitch > 22 || rawPitch < -22) {
      // Cabeza muy inclinada arriba o abajo → -30
      score -= 30
    } else if (rawPitch > 15 || rawPitch < -15) {
      // Cabeza moderadamente inclinada → -15
      score -= 15
    }

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
   * FATIGA (0-100) - BASADA EN EAR/PERCLOS REAL
   *
   * Componentes con pesos científicos (Wierwille 1994, Caffier 2003, Dinges 1998):
   * - PERCLOS P70 (35%): Gold standard de somnolencia (FHWA)
   * - Cierre sostenido de ojos (25%): Microsueños y cierres prolongados
   * - Frecuencia de parpadeo (15%): Curva U - muy alto o muy bajo = fatiga
   * - Parpadeos lentos >400ms (10%): Indicador temprano de fatiga (Caffier 2003)
   * - Postura degradada (10%): Cabeza inclinada = somnolencia
   * - Expresión plana (5%): Indicador de apoyo
   *
   * Con acumulación temporal: fatiga sube rápido, baja lento (inercia)
   */
  private calculateFatigue(data: DetectionData): number {
    const { blinkRate, expressions, headPose, eyeState } = data
    const now = Date.now()

    let instantScore = 0

    // ============================================================
    // 1. PERCLOS - P70 (0-35 puntos) - SEÑAL DOMINANTE
    // Porcentaje de tiempo con ojos cerrados en ventana de 60s
    // FHWA: >15% = fatiga, >25% = somnolencia severa
    // ============================================================
    const perclos = eyeState.perclos
    if (perclos < 0.08) {
      instantScore += perclos / 0.08 * 5
    } else if (perclos < 0.15) {
      instantScore += 5 + (perclos - 0.08) / 0.07 * 10
    } else if (perclos < 0.25) {
      instantScore += 15 + (perclos - 0.15) / 0.10 * 10
    } else {
      instantScore += 25 + Math.min(10, (perclos - 0.25) / 0.15 * 10)
    }

    // ============================================================
    // 2. CIERRE SOSTENIDO DE OJOS (0-25 puntos)
    // >500ms = parpadeo lento, >1.5s = microsueño, >3s = dormido
    // ============================================================
    const closureMs = eyeState.eyeClosureDurationMs
    if (closureMs > 3000) {
      // Ojos cerrados >3s = DORMIDO → 25 puntos INMEDIATO
      instantScore += 25
    } else if (closureMs > 1500) {
      // Microsueño (1.5-3s) → 18-25 puntos
      instantScore += 18 + Math.min(7, (closureMs - 1500) / 1500 * 7)
    } else if (closureMs > 500) {
      // Parpadeo lento (500ms-1.5s) → 8-18 puntos
      instantScore += 8 + (closureMs - 500) / 1000 * 10
    } else if (eyeState.eyesClosed) {
      // Ojos cerrándose (<500ms) → 0-8 puntos proporcional
      instantScore += closureMs / 500 * 8
    }

    // Bonus por microsueños recientes (últimos 5 min)
    if (eyeState.microsleepCount > 0) {
      instantScore += Math.min(10, eyeState.microsleepCount * 5)
    }

    // ============================================================
    // 3. FRECUENCIA DE PARPADEO (0-15 puntos)
    // Curva U: normal (10-18) = 0, alto o muy bajo = fatiga
    // ============================================================
    if (blinkRate >= 10 && blinkRate <= 18) {
      // Normal → 0
    } else if (blinkRate > 18 && blinkRate <= 25) {
      instantScore += (blinkRate - 18) / 7 * 5
    } else if (blinkRate > 25) {
      instantScore += 5 + Math.min(10, (blinkRate - 25) / 15 * 10)
    } else if (blinkRate >= 5) {
      instantScore += (10 - blinkRate) / 5 * 5
    } else {
      // <5 bpm con ojos abiertos = fatiga profunda o microsueño
      instantScore += 5 + Math.min(7, (5 - blinkRate) / 5 * 7)
    }

    // ============================================================
    // 4. PARPADEOS LENTOS >400ms (0-10 puntos)
    // Caffier 2003: duración media del parpadeo es el indicador más sensible
    // ============================================================
    const slowBlinks = eyeState.slowBlinkCount
    if (slowBlinks >= 5) {
      instantScore += 10
    } else if (slowBlinks >= 3) {
      instantScore += 7
    } else if (slowBlinks >= 1) {
      instantScore += 3
    }

    // ============================================================
    // 5. POSTURA DEGRADADA (0-10 puntos)
    // ============================================================
    const pitchDev = Math.abs(headPose.pitch - (this.baseline?.headPose.pitch || 0))
    if (pitchDev > 25) {
      instantScore += 10
    } else if (pitchDev > 15) {
      instantScore += 5
    }

    // ============================================================
    // 6. EXPRESIÓN PLANA (0-5 puntos)
    // ============================================================
    const neutralLevel = expressions.neutral || 0
    if (neutralLevel > 0.85) {
      instantScore += 5
    } else if (neutralLevel > 0.7) {
      instantScore += (neutralLevel - 0.7) / 0.15 * 5
    }

    instantScore = Math.max(0, Math.min(100, instantScore))

    // ============================================================
    // ACUMULACIÓN TEMPORAL: fatiga sube rápido, baja lento
    // ============================================================
    const dt = this.lastFatigueUpdateAt > 0 ? (now - this.lastFatigueUpdateAt) / 1000 : 0.2
    this.lastFatigueUpdateAt = now

    if (instantScore > this.accumulatedFatigue) {
      // Subir rápido: 60% del gap por segundo
      const riseRate = 0.6
      this.accumulatedFatigue += (instantScore - this.accumulatedFatigue) * riseRate * Math.min(dt, 1)
    } else {
      // Bajar lento: 5% del gap por segundo (la fatiga no se va rápido)
      const decayRate = 0.05
      this.accumulatedFatigue += (instantScore - this.accumulatedFatigue) * decayRate * Math.min(dt, 1)
    }

    this.accumulatedFatigue = Math.max(0, Math.min(100, this.accumulatedFatigue))

    // Retornar el mayor entre instantáneo y acumulado (nunca bajar debajo del instant)
    return Math.round(Math.max(instantScore, this.accumulatedFatigue))
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

    if (data.quality) {
      confidence = confidence * 0.65 + data.quality.score * 0.35
      if (!data.quality.reliable) confidence *= 0.75
    }
    
    return Math.max(0.2, Math.min(1.0, confidence))
  }
  
  /**
   * GENERACIÓN DE ALERTAS
   */
  private generateAlerts(focus: number, stress: number, fatigue: number, data: DetectionData, attention: AttentionState) {
    return {
      highStress: stress >= 75,
      highFatigue: fatigue >= 70,
      poorPosture:
        attention.reliable &&
        (Math.abs(data.headPose.yaw) > 35 || Math.abs(data.headPose.pitch) > 25),
      frequentDistraction: attention.classification !== "uncertain" && focus < 30,
      eyesClosed: data.eyeState.eyesClosed && data.eyeState.eyeClosureDurationMs > 500,
      microsleep: data.eyeState.eyeClosureDurationMs > 1500
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
