import type * as FaceApi from "@vladmandic/face-api"

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
export type ExpressionMap = Record<ExpressionKey, number>

export const normalizeExpressions = (expressions: FaceApi.FaceExpressions): ExpressionMap => ({
  neutral: expressions.neutral ?? 0,
  happy: expressions.happy ?? 0,
  sad: expressions.sad ?? 0,
  angry: expressions.angry ?? 0,
  fearful: expressions.fearful ?? 0,
  disgusted: expressions.disgusted ?? 0,
  surprised: expressions.surprised ?? 0
})

export type EyeState = {
  earAvg: number
  eyesClosed: boolean
  eyeClosureDurationMs: number
  perclos: number
  slowBlinkCount: number
  microsleepCount: number
}

export type FaceStabilizerConfig = {
  expSmoothAlpha: number
  poseSmoothAlpha: number
  gazeSmoothAlpha: number
  earBaselineAlpha: number
  blinkCloseRatio: number
  blinkOpenHysteresis: number
  minBlinkMs: number
  maxBlinkMs: number
  perclosWindowMs: number
  slowBlinkMinMs: number
  slowBlinkMaxMs: number
  microsleepMinMs: number
}

const defaultConfig: FaceStabilizerConfig = {
  expSmoothAlpha: 0.35,
  poseSmoothAlpha: 0.25,
  gazeSmoothAlpha: 0.2,
  earBaselineAlpha: 0.03,
  blinkCloseRatio: 0.65,
  blinkOpenHysteresis: 0.02,
  minBlinkMs: 60,
  maxBlinkMs: 400,
  perclosWindowMs: 60000,
  slowBlinkMinMs: 400,
  slowBlinkMaxMs: 1500,
  microsleepMinMs: 1500
}

export const createFaceStabilizers = (config: Partial<FaceStabilizerConfig> = {}) => {
  const cfg = { ...defaultConfig, ...config }

  let smoothedExpressions: ExpressionMap | null = null
  let smoothedPose: { yaw: number; pitch: number; roll: number } | null = null
  let smoothedGaze: { x: number; y: number } | null = null

  let earBaseline: number | null = null
  let blinkState: { isBlinking: boolean; startedAt: number | null } = {
    isBlinking: false,
    startedAt: null
  }
  let blinkHistory: number[] = []
  let lastEarAvg = 0
  let eyeClosedSince: number | null = null
  let perclosFrames: { ts: number; closed: boolean }[] = []
  let slowBlinkHistory: number[] = []
  let microsleepHistory: number[] = []

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
  const smoothValue = (prev: number, next: number, alpha: number) => prev + alpha * (next - prev)

  const computeEyeAspectRatio = (eye: FaceApi.Point[]) => {
    if (eye.length < 6) return 0
    const height1 = Math.abs(eye[1].y - eye[5].y)
    const height2 = Math.abs(eye[2].y - eye[4].y)
    const width = Math.abs(eye[3].x - eye[0].x)
    return (height1 + height2) / Math.max(1e-6, 2 * width)
  }

  const smoothExpressions = (expressions: FaceApi.FaceExpressions): ExpressionMap => {
    const base = normalizeExpressions(expressions)
    if (!smoothedExpressions) {
      smoothedExpressions = base
      return base
    }

    const next: ExpressionMap = { ...smoothedExpressions }
    for (const k of EXPRESSION_KEYS) {
      next[k] = clamp(smoothValue(smoothedExpressions[k], base[k], cfg.expSmoothAlpha), 0, 1)
    }
    smoothedExpressions = next
    return next
  }

  const smoothPose = (pose: { yaw: number; pitch: number; roll: number }) => {
    if (!smoothedPose) {
      smoothedPose = pose
      return pose
    }
    smoothedPose = {
      yaw: smoothValue(smoothedPose.yaw, pose.yaw, cfg.poseSmoothAlpha),
      pitch: smoothValue(smoothedPose.pitch, pose.pitch, cfg.poseSmoothAlpha),
      roll: smoothValue(smoothedPose.roll, pose.roll, cfg.poseSmoothAlpha)
    }
    return smoothedPose
  }

  const smoothGaze = (gaze: { x: number; y: number }) => {
    if (!smoothedGaze) {
      smoothedGaze = gaze
      return gaze
    }
    smoothedGaze = {
      x: smoothValue(smoothedGaze.x, gaze.x, cfg.gazeSmoothAlpha),
      y: smoothValue(smoothedGaze.y, gaze.y, cfg.gazeSmoothAlpha)
    }
    return smoothedGaze
  }

  const updateBlinkState = (landmarks: FaceApi.FaceLandmarks68, now: number = Date.now()) => {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const leftEAR = computeEyeAspectRatio(leftEye)
    const rightEAR = computeEyeAspectRatio(rightEye)
    const avgEAR = (leftEAR + rightEAR) / 2
    lastEarAvg = avgEAR

    if (!blinkState.isBlinking) {
      earBaseline =
        earBaseline === null
          ? avgEAR
          : smoothValue(earBaseline, avgEAR, cfg.earBaselineAlpha)
    }

    const baseline = earBaseline ?? avgEAR
    const closeThreshold = Math.max(0.08, baseline * cfg.blinkCloseRatio)
    const openThreshold = closeThreshold + cfg.blinkOpenHysteresis

    // PERCLOS: track whether eyes are closed this frame (P70 standard)
    const p70Threshold = Math.max(0.08, baseline * 0.70)
    const closedThisFrame = avgEAR < p70Threshold
    perclosFrames.push({ ts: now, closed: closedThisFrame })
    perclosFrames = perclosFrames.filter((f) => now - f.ts < cfg.perclosWindowMs)

    // Track sustained eye closure duration
    if (avgEAR < closeThreshold) {
      if (!eyeClosedSince) eyeClosedSince = now
    } else {
      if (eyeClosedSince) {
        const closureDuration = now - eyeClosedSince
        // Classify the closure event when eyes reopen
        if (closureDuration >= cfg.microsleepMinMs) {
          microsleepHistory.push(now)
        } else if (closureDuration >= cfg.slowBlinkMinMs) {
          slowBlinkHistory.push(now)
        }
      }
      eyeClosedSince = null
    }

    // Blink detection (original logic for normal blinks)
    if (!blinkState.isBlinking) {
      if (avgEAR < closeThreshold) {
        blinkState.isBlinking = true
        blinkState.startedAt = now
      }
    } else {
      if (avgEAR > openThreshold) {
        const startedAt = blinkState.startedAt ?? now
        const duration = now - startedAt
        blinkState.isBlinking = false
        blinkState.startedAt = null

        if (duration >= cfg.minBlinkMs && duration <= cfg.maxBlinkMs) {
          blinkHistory.push(now)
        }
      }
    }

    return blinkState.isBlinking
  }

  const getBlinkRate = (now: number = Date.now()) => {
    blinkHistory = blinkHistory.filter((time) => now - time < 60000)
    return blinkHistory.length
  }

  const getEyeState = (now: number = Date.now()): EyeState => {
    // Prune old history
    slowBlinkHistory = slowBlinkHistory.filter((t) => now - t < 60000)
    microsleepHistory = microsleepHistory.filter((t) => now - t < 300000) // 5 min window

    // PERCLOS: fraction of frames where eyes were closed
    const perclos =
      perclosFrames.length >= 5
        ? perclosFrames.filter((f) => f.closed).length / perclosFrames.length
        : 0

    // Current eye closure duration
    const closureDurationMs = eyeClosedSince ? now - eyeClosedSince : 0

    return {
      earAvg: lastEarAvg,
      eyesClosed: eyeClosedSince !== null,
      eyeClosureDurationMs: closureDurationMs,
      perclos,
      slowBlinkCount: slowBlinkHistory.length,
      microsleepCount: microsleepHistory.length
    }
  }

  const reset = () => {
    smoothedExpressions = null
    smoothedPose = null
    smoothedGaze = null
    earBaseline = null
    blinkState = { isBlinking: false, startedAt: null }
    blinkHistory = []
    lastEarAvg = 0
    eyeClosedSince = null
    perclosFrames = []
    slowBlinkHistory = []
    microsleepHistory = []
  }

  return {
    smoothExpressions,
    smoothPose,
    smoothGaze,
    updateBlinkState,
    getBlinkRate,
    getEyeState,
    reset
  }
}
