import type * as FaceApi from "face-api.js"

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

export type FaceStabilizerConfig = {
  expSmoothAlpha: number
  poseSmoothAlpha: number
  gazeSmoothAlpha: number
  earBaselineAlpha: number
  blinkCloseRatio: number
  blinkOpenHysteresis: number
  minBlinkMs: number
  maxBlinkMs: number
}

const defaultConfig: FaceStabilizerConfig = {
  expSmoothAlpha: 0.35,
  poseSmoothAlpha: 0.25,
  gazeSmoothAlpha: 0.2,
  earBaselineAlpha: 0.03,
  blinkCloseRatio: 0.65,
  blinkOpenHysteresis: 0.02,
  minBlinkMs: 60,
  maxBlinkMs: 400
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

    if (!blinkState.isBlinking) {
      earBaseline =
        earBaseline === null
          ? avgEAR
          : smoothValue(earBaseline, avgEAR, cfg.earBaselineAlpha)
    }

    const baseline = earBaseline ?? avgEAR
    const closeThreshold = Math.max(0.08, baseline * cfg.blinkCloseRatio)
    const openThreshold = closeThreshold + cfg.blinkOpenHysteresis

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

  const reset = () => {
    smoothedExpressions = null
    smoothedPose = null
    smoothedGaze = null
    earBaseline = null
    blinkState = { isBlinking: false, startedAt: null }
    blinkHistory = []
  }

  return {
    smoothExpressions,
    smoothPose,
    smoothGaze,
    updateBlinkState,
    getBlinkRate,
    reset
  }
}
