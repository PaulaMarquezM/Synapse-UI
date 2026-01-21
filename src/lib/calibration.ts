// src/lib/calibration.ts
import type { DetectionData } from "~components/CameraFeed"

/**
 * Keys soportadas por face-api.js en FaceExpressions.
 * Tipado fuerte para evitar casts inseguros.
 */
export const EXPRESSION_KEYS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgusted",
  "surprised"
] as const

export type ExpressionKey = (typeof EXPRESSION_KEYS)[number]

export type Baseline = {
  gazeX: number
  gazeY: number
  blinkRate: number
  headPose: { yaw: number; pitch: number; roll: number }
  expressions: Record<ExpressionKey, number>

  samples: number
  startedAt: number
  finishedAt: number | null
}

export type CalibrationState = {
  isCalibrating: boolean
  isCalibrated: boolean
  progress: number // 0..1
  secondsRemaining: number
  baseline: Baseline | null

  // UI extra (para no “adivinar” qué pasa)
  samples: number
  targetSamples: number
  message?: string
}

export type CalibrationConfig = {
  durationMs: number
}

const defaultExpressions = (): Record<ExpressionKey, number> => ({
  neutral: 0,
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0
})

/**
 * Calibrador:
 * - Acumula promedios.
 * - NO decide por sí solo cuándo terminar (para evitar quedar colgado).
 * - El caller (popup) decide cuándo "finalizar" según tiempo + samples.
 */
export const createCalibrator = (config: CalibrationConfig) => {
  const startedAt = Date.now()
  let samples = 0

  // acumuladores
  let sumGazeX = 0
  let sumGazeY = 0
  let sumBlink = 0
  let sumYaw = 0
  let sumPitch = 0
  let sumRoll = 0

  const sumExpr: Record<ExpressionKey, number> = defaultExpressions()

  let finishedAt: number | null = null

  const addSample = (d: DetectionData) => {
    if (finishedAt) return

    samples += 1
    sumGazeX += d.gazeX
    sumGazeY += d.gazeY
    sumBlink += d.blinkRate
    sumYaw += d.headPose.yaw
    sumPitch += d.headPose.pitch
    sumRoll += d.headPose.roll

    for (const k of EXPRESSION_KEYS) {
      sumExpr[k] += d.expressions[k] ?? 0
    }
  }

  const getProgress = () => {
    const now = Date.now()
    const elapsed = now - startedAt
    const progress = Math.min(1, Math.max(0, elapsed / config.durationMs))
    const secondsRemaining = Math.max(0, Math.ceil((config.durationMs - elapsed) / 1000))
    const timeElapsed = elapsed >= config.durationMs
    return { progress, secondsRemaining, elapsed, timeElapsed }
  }

  const getSamples = () => samples

  const isDone = () => finishedAt !== null

  const finish = () => {
    if (!finishedAt) finishedAt = Date.now()
  }

  const buildBaseline = (): Baseline | null => {
    if (!finishedAt) return null
    if (samples <= 0) return null

    const exprAvg: Record<ExpressionKey, number> = defaultExpressions()
    for (const k of EXPRESSION_KEYS) {
      exprAvg[k] = sumExpr[k] / samples
    }

    return {
      gazeX: sumGazeX / samples,
      gazeY: sumGazeY / samples,
      blinkRate: sumBlink / samples,
      headPose: {
        yaw: sumYaw / samples,
        pitch: sumPitch / samples,
        roll: sumRoll / samples
      },
      expressions: exprAvg,
      samples,
      startedAt,
      finishedAt
    }
  }

  return {
    addSample,
    getProgress,
    getSamples,
    finish,
    isDone,
    buildBaseline
  }
}
