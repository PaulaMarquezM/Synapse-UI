import React, { useMemo, useRef, useState } from "react"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import type { DetectionData } from "~components/CameraFeed"
import "./popup.css"

import {
  createMetricsSmoother,
  defaultSmoothingConfig,
  type Metrics,
  type MetricsLevels
} from "~lib/metricsSmoothing"

const Popup = () => {
  const [data, setData] = useState<DetectionData | null>(null)

  // Lo que se renderiza (suavizado)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)

  // Si luego quieres mostrar estados discretos
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })

  // Smoother con estado interno
  const smootherRef = useRef(
    createMetricsSmoother(
      { focus: 50, stress: 20, alert: 80 },
      {
        ...defaultSmoothingConfig,
        alpha: 0.09,
        maxDeltaPerTick: 3
      }
    )
  )

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData)

    // 1) RAW metrics (tu lógica actual)
    const raw: Metrics = {
      focus: calculateFocusScore(detectedData),
      stress: calculateStressLevel(detectedData),
      alert: calculateAlertLevel(detectedData)
    }

    // 2) Smoothed + levels
    const { smoothed, levels: lv } = smootherRef.current.update(raw)

    setFocusScore(smoothed.focus)
    setStressLevel(smoothed.stress)
    setAlertLevel(smoothed.alert)
    setLevels(lv)

    // Emoción dominante
    const emotion = Object.keys(detectedData.expressions).reduce((a, b) =>
      detectedData.expressions[a] > detectedData.expressions[b] ? a : b
    )

    // 3) Enviar (usa suavizados)
    chrome.runtime.sendMessage({
      type: "UPDATE_FOCUS_DATA",
      data: {
        ...detectedData,
        emotion,
        focusScore: smoothed.focus,
        stressLevel: smoothed.stress,
        alertLevel: smoothed.alert,
        // opcional: estados discretos
        levels: lv
      }
    })
  }

  // ---- Tus funciones RAW (sin cambios) ----
  const calculateFocusScore = (data: DetectionData): number => {
    const { expressions, gazeX, gazeY, headPose, blinkRate } = data

    const emotionalWeight = (expressions.neutral + expressions.happy) * 0.5
    const headAlignment = Math.max(
      0,
      1 - (Math.abs(headPose.yaw) + Math.abs(headPose.pitch)) / 60
    )
    const blinkFactor = blinkRate > 10 && blinkRate < 25 ? 1 : 0.7

    const screenWidth = window.screen.width
    const screenHeight = window.screen.height

    const isGazeReasonable =
      gazeX > screenWidth * 0.2 &&
      gazeX < screenWidth * 0.8 &&
      gazeY > screenHeight * 0.1 &&
      gazeY < screenHeight * 0.9

    let score = 0

    if (isGazeReasonable && expressions.neutral > 0.4) {
      score = 70 + emotionalWeight * 30
    } else if (expressions.angry > 0.2 || expressions.sad > 0.2) {
      score = 10 + emotionalWeight * 20
    } else {
      score = 40 + emotionalWeight * 20
    }

    score = score * headAlignment * blinkFactor
    return Math.round(Math.min(100, Math.max(0, score)))
  }

  const calculateStressLevel = (data: DetectionData): number => {
    const { expressions } = data
    const negativeEmotions = expressions.angry + expressions.sad + expressions.surprised
    const positiveEmotions = expressions.happy + expressions.neutral
    const stress = negativeEmotions - positiveEmotions * 0.5
    const level = (stress + 1) * 50
    return Math.round(Math.min(100, Math.max(0, level)))
  }

  const calculateAlertLevel = (data: DetectionData): number => {
    const { expressions } = data
    if (expressions.sad > 0.3 || expressions.neutral > 0.8) {
      return Math.round(30 + expressions.happy * 40)
    }
    return Math.round(60 + (expressions.surprised + expressions.happy) * 20)
  }

  return (
    <div style={{ minHeight: "520px" }}>
      {/* Feed offscreen */}
      <div
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: 640,
          height: 480,
          opacity: 0,
          pointerEvents: "none"
        }}
      >
        <CameraFeed onDetection={handleDetection} />
      </div>

      <Dashboard
        data={data}
        focusScore={focusScore}
        stressLevel={stressLevel}
        alertLevel={alertLevel}
      />

      {/* Debug opcional */}
      {/* <pre style={{ color: "white" }}>{JSON.stringify(levels, null, 2)}</pre> */}
    </div>
  )
}

export default Popup
