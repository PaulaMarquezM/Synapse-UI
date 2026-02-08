import { Storage } from "@plasmohq/storage"

const storage = new Storage()

interface FocusState {
  score: number
  focusScore: number
  stressLevel: number
  alertLevel: number
  emotion: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const asFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null
const asString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value : null)

const DEFAULT_STATE: FocusState = {
  score: 50,
  focusScore: 50,
  stressLevel: 20,
  alertLevel: 80,
  emotion: "neutral"
}

const normalizeFocusState = (value: unknown): FocusState => {
  if (!value || typeof value !== "object") return DEFAULT_STATE
  const maybe = value as Partial<FocusState>
  const focusScore = asFiniteNumber(maybe.focusScore ?? maybe.score) ?? DEFAULT_STATE.focusScore
  return {
    score: focusScore,
    focusScore,
    stressLevel: asFiniteNumber(maybe.stressLevel) ?? DEFAULT_STATE.stressLevel,
    alertLevel: asFiniteNumber(maybe.alertLevel) ?? DEFAULT_STATE.alertLevel,
    emotion: asString(maybe.emotion) ?? DEFAULT_STATE.emotion
  }
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error configurando Side Panel:", error))

chrome.runtime.onInstalled.addListener(() => {
  console.log("[SYNAPSE] Extension instalada")
  void storage.set("focusState", DEFAULT_STATE)
})

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === "UPDATE_FOCUS_DATA" && request.data) {
    const { expressions = {}, gazeX, gazeY, headPose, blinkRate, emotion } = request.data as {
      expressions?: Record<string, number>
      gazeX?: number
      gazeY?: number
      headPose?: { yaw: number; pitch: number; roll: number }
      blinkRate?: number
      emotion?: string
      focusScore?: number
      stressLevel?: number
      alertLevel?: number
    }

    const incomingFocusScore = asFiniteNumber(request.data.focusScore)
    const incomingStressLevel = asFiniteNumber(request.data.stressLevel)
    const incomingAlertLevel = asFiniteNumber(request.data.alertLevel)

    const newFocusScore =
      incomingFocusScore ??
      calculateFocusScore(
        asFiniteNumber(gazeX) ?? 0,
        asFiniteNumber(gazeY) ?? 0,
        expressions,
        headPose,
        asFiniteNumber(blinkRate) ?? undefined
      )

    const newStressLevel = incomingStressLevel ?? calculateStressLevel(expressions)
    const newAlertLevel =
      incomingAlertLevel ?? calculateAlertLevel(expressions, asFiniteNumber(blinkRate) ?? undefined)

    const dominantEmotion = emotion || getDominantEmotion(expressions)

    const state: FocusState = {
      score: newFocusScore,
      focusScore: newFocusScore,
      stressLevel: newStressLevel,
      alertLevel: newAlertLevel,
      emotion: dominantEmotion
    }

    storage
      .set("focusState", state)
      .then(() => {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (!tab.id) return
            chrome.tabs
              .sendMessage(tab.id, {
                type: "STATE_UPDATED",
                state
              })
              .catch(() => {
                // Ignore tabs without content script
              })
          })
        })

        sendResponse({ status: "State updated", state })
      })
      .catch((error) => {
        console.error("Error guardando focusState:", error)
        sendResponse({ status: "error", message: "No se pudo guardar focusState" })
      })

    return true
  }

  if (request.type === "GET_FOCUS_STATE") {
    storage
      .get("focusState")
      .then((state) => {
        sendResponse({ state: normalizeFocusState(state) })
      })
      .catch((error) => {
        console.error("Error leyendo focusState:", error)
        sendResponse({ state: DEFAULT_STATE, message: "No se pudo leer focusState" })
      })

    return true
  }

  return false
})

function calculateFocusScore(
  gazeX: number,
  gazeY: number,
  expressions: Record<string, number>,
  headPose?: { yaw: number; pitch: number; roll: number },
  blinkRate?: number
): number {
  const neutral = expressions.neutral ?? 0
  const happy = expressions.happy ?? 0
  const angry = expressions.angry ?? 0
  const sad = expressions.sad ?? 0

  const emotionalWeight = (neutral + happy) * 0.5

  const screenWidth = typeof window !== "undefined" ? window.screen.width : 1920
  const screenHeight = typeof window !== "undefined" ? window.screen.height : 1080

  const isGazeReasonable =
    gazeX > screenWidth * 0.2 &&
    gazeX < screenWidth * 0.8 &&
    gazeY > screenHeight * 0.1 &&
    gazeY < screenHeight * 0.9

  let headAlignment = 1
  if (headPose) {
    const yawPenalty = Math.abs(headPose.yaw) / 45
    const pitchPenalty = Math.abs(headPose.pitch) / 30
    headAlignment = Math.max(0, 1 - (yawPenalty + pitchPenalty) / 2)
  }

  let blinkFactor = 1
  if (blinkRate !== undefined) {
    blinkFactor = blinkRate > 10 && blinkRate < 25 ? 1 : 0.7
  }

  let score = 0

  if (isGazeReasonable && neutral > 0.4) {
    score = 70 + emotionalWeight * 30
  } else if (angry > 0.2 || sad > 0.2) {
    score = 10 + emotionalWeight * 20
  } else {
    score = 40 + emotionalWeight * 20
  }

  score = score * headAlignment * blinkFactor

  return Math.round(clamp(score, 0, 100))
}

function calculateStressLevel(expressions: Record<string, number>): number {
  const negativeEmotions =
    (expressions.angry ?? 0) + (expressions.sad ?? 0) + (expressions.surprised ?? 0)

  const positiveEmotions = (expressions.happy ?? 0) + (expressions.neutral ?? 0)

  const stress = negativeEmotions - positiveEmotions * 0.5
  const level = (stress + 1) * 50

  return Math.round(clamp(level, 0, 100))
}

function calculateAlertLevel(expressions: Record<string, number>, blinkRate?: number): number {
  const neutral = expressions.neutral ?? 0
  const happy = expressions.happy ?? 0
  const sad = expressions.sad ?? 0
  const base = 60 + (happy - sad) * 25 + (0.5 - neutral) * 10
  const blinkPenalty = typeof blinkRate === "number" && blinkRate > 25 ? 15 : 0
  return Math.round(clamp(base - blinkPenalty, 0, 100))
}

function getDominantEmotion(expressions: Record<string, number>): string {
  const keys = Object.keys(expressions)
  if (keys.length === 0) return "neutral"
  return keys.reduce((a, b) => (expressions[a] > expressions[b] ? a : b))
}

export const getFocusState = async (): Promise<FocusState> => {
  return normalizeFocusState(await storage.get("focusState"))
}

// Keepalive best effort for MV3 service worker in development sessions.
setInterval(() => {
  chrome.runtime.getPlatformInfo(() => {
    // no-op
  })
}, 20000)

console.log("[SYNAPSE] Background script iniciado")
