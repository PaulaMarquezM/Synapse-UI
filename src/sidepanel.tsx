import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import AuthForm from "~components/AuthForm"
import { useAuth } from "~hooks/useAuth"
import { signOut } from "~lib/supabase"
import { LogOut, Loader } from "lucide-react"
import type { DetectionData } from "~components/CameraFeed"
import "./sidepanel.css"

import {
  createMetricsSmoother,
  defaultSmoothingConfig,
  type Metrics,
  type MetricsLevels
} from "~lib/metricsSmoothing"

import { createCalibrator, type CalibrationState, type Baseline } from "~lib/calibration"

const CALIBRATION_DURATION_MS = 12_000
const TARGET_SAMPLES = 20
const FALLBACK_MIN_SAMPLES = 8
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const SidePanel = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  
  const [data, setData] = useState<DetectionData | null>(null)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })

  const [calState, setCalState] = useState<CalibrationState>({
    isCalibrating: true,
    isCalibrated: false,
    progress: 0,
    secondsRemaining: Math.ceil(CALIBRATION_DURATION_MS / 1000),
    baseline: null,
    samples: 0,
    targetSamples: TARGET_SAMPLES,
    message: undefined
  })

  const calibratorRef = useRef(createCalibrator({ durationMs: CALIBRATION_DURATION_MS }))
  const smootherRef = useRef(
    createMetricsSmoother(
      { focus: 50, stress: 20, alert: 80 },
      { ...defaultSmoothingConfig, alpha: 0.12, maxDeltaPerTick: 5 }
    )
  )

  const startCalibration = () => {
    calibratorRef.current = createCalibrator({ durationMs: CALIBRATION_DURATION_MS })
    setCalState({
      isCalibrating: true,
      isCalibrated: false,
      progress: 0,
      secondsRemaining: Math.ceil(CALIBRATION_DURATION_MS / 1000),
      baseline: null,
      samples: 0,
      targetSamples: TARGET_SAMPLES,
      message: undefined
    })
  }

  const finalizeCalibration = () => {
    calibratorRef.current.finish()
    const baseline = calibratorRef.current.buildBaseline()
    setCalState((prev) => ({
      ...prev,
      isCalibrating: false,
      isCalibrated: true,
      progress: 1,
      secondsRemaining: 0,
      baseline
    }))
  }

  useEffect(() => {
    if (!calState.isCalibrating || !isAuthenticated) return
    const id = window.setInterval(() => {
      const { progress, secondsRemaining, timeElapsed } = calibratorRef.current.getProgress()
      const samples = calibratorRef.current.getSamples()
      setCalState((prev) => {
        if (!prev.isCalibrating) return prev
        let message = prev.message
        if (timeElapsed && samples < FALLBACK_MIN_SAMPLES) {
          message = "Pocas detecciones. Mejora iluminación."
        } else {
          message = undefined
        }
        return { ...prev, progress, secondsRemaining, samples, message }
      })
    }, 200)
    return () => window.clearInterval(id)
  }, [calState.isCalibrating, isAuthenticated])

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData)
    if (calState.isCalibrating && !calState.isCalibrated) {
      calibratorRef.current.addSample(detectedData)
      const samples = calibratorRef.current.getSamples()
      const { timeElapsed } = calibratorRef.current.getProgress()
      if (samples >= TARGET_SAMPLES || (timeElapsed && samples >= FALLBACK_MIN_SAMPLES)) {
        finalizeCalibration()
      }
    }

    const raw: Metrics = {
      focus: calculateFocusScore(detectedData),
      stress: calculateStressLevel(detectedData),
      alert: calculateAlertLevel(detectedData)
    }
    const adjusted = applyBaseline(raw, detectedData, calState.baseline)
    const { smoothed, levels: lv } = smootherRef.current.update(adjusted)
    setFocusScore(smoothed.focus)
    setStressLevel(smoothed.stress)
    setAlertLevel(smoothed.alert)
    setLevels(lv)

    const exprAny = detectedData.expressions as any
    const emotion = Object.keys(exprAny).reduce((a, b) => (exprAny[a] > exprAny[b] ? a : b))
    chrome.runtime.sendMessage({
      type: "UPDATE_FOCUS_DATA",
      data: {
        ...detectedData,
        emotion,
        focusScore: smoothed.focus,
        stressLevel: smoothed.stress,
        alertLevel: smoothed.alert,
        levels: lv
      }
    })
  }

  const applyBaseline = (raw: Metrics, d: DetectionData, baseline: Baseline | null): Metrics => {
    if (!baseline) return raw
    const yawDev = Math.min(1, Math.abs(d.headPose.yaw - baseline.headPose.yaw) / 35)
    const pitchDev = Math.min(1, Math.abs(d.headPose.pitch - baseline.headPose.pitch) / 25)
    const dx = Math.abs(d.gazeX - baseline.gazeX)
    const dy = Math.abs(d.gazeY - baseline.gazeY)
    const screenW = window.screen.width || 1
    const screenH = window.screen.height || 1
    const gazeDev = Math.min(1, (dx / screenW + dy / screenH) / 0.6)
    const blinkDev = Math.min(1, Math.abs(d.blinkRate - baseline.blinkRate) / 12)
    const expr = d.expressions
    const baseExpr = baseline.expressions
    const negNow = (expr.angry ?? 0) + (expr.sad ?? 0) + (expr.fearful ?? 0) + (expr.disgusted ?? 0)
    const negBase = (baseExpr.angry ?? 0) + (baseExpr.sad ?? 0) + (baseExpr.fearful ?? 0) + (baseExpr.disgusted ?? 0)
    const negDelta = clamp(negNow - negBase, -1, 1)
    const neutralDelta = clamp((expr.neutral ?? 0) - (baseExpr.neutral ?? 0), -1, 1)
    const focusPenalty = yawDev * 18 + pitchDev * 14 + gazeDev * 20
    const stressBoost = negDelta * 35 + blinkDev * 12
    const alertPenalty = neutralDelta * 18 + blinkDev * 10
    return {
      focus: clamp(raw.focus - focusPenalty, 0, 100),
      stress: clamp(raw.stress + stressBoost, 0, 100),
      alert: clamp(raw.alert - alertPenalty, 0, 100)
    }
  }

  const calculateFocusScore = (data: DetectionData): number => {
    const { expressions, gazeX, gazeY, headPose, blinkRate } = data
    const emotionalWeight = (expressions.neutral + expressions.happy) * 0.5
    const headAlignment = Math.max(0, 1 - (Math.abs(headPose.yaw) + Math.abs(headPose.pitch)) / 60)
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

  const handleLogout = async () => {
    await signOut()
    startCalibration()
  }

  const handleAuthSuccess = () => {
    startCalibration()
  }

  if (authLoading) {
    return (
      <div className="sidepanel-container">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ marginBottom: 16 }}
            >
              <Loader size={40} color="#60a5fa" />
            </motion.div>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Cargando SYNAPSE UI...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="sidepanel-container">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <AuthForm onAuthSuccess={handleAuthSuccess} />
        </div>
      </div>
    )
  }

  return (
    <div className="sidepanel-container">
      {/* HEADER CON LOGO */}
      <div className="sidepanel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            boxShadow: "0 4px 12px rgba(96, 165, 250, 0.3)"
          }}>
            🧠
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>SYNAPSE UI</p>
            <p style={{
              fontSize: 10,
              color: "#94a3b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {user?.email}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            style={{
              padding: 8,
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              cursor: "pointer",
              display: "flex"
            }}
          >
            <LogOut size={16} color="#ef4444" />
          </motion.button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="sidepanel-content">
        {/* BANNER DE CALIBRACIÓN */}
        {calState.isCalibrating ? (
          <div style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 4 }}>
                  🧠 Calibrando...
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {calState.message || `${calState.secondsRemaining}s • ${calState.samples}/${calState.targetSamples} muestras`}
                </div>
              </div>
              <button
                onClick={startCalibration}
                style={{
                  fontSize: 20,
                  padding: "6px",
                  borderRadius: 8,
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                🔄
              </button>
            </div>
            <div style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${Math.round(calState.progress * 100)}%`,
                background: "linear-gradient(90deg, #60a5fa, #8b5cf6)",
                transition: "width 0.3s ease",
                boxShadow: "0 0 10px rgba(96, 165, 250, 0.5)"
              }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={startCalibration}
              className="glass-hover"
              style={{
                fontSize: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(96, 165, 250, 0.3)",
                background: "rgba(96, 165, 250, 0.1)",
                color: "#60a5fa",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              🎯 Recalibrar
            </button>
          </div>
        )}

        {/* CÁMARA */}
        <div style={{ marginBottom: 18 }}>
          <CameraFeed 
            onDetection={handleDetection} 
            preview 
            previewWidth={368} 
            previewHeight={240} 
          />
        </div>

        {/* DASHBOARD */}
        <Dashboard
          data={data}
          focusScore={focusScore}
          stressLevel={stressLevel}
          alertLevel={alertLevel}
        />
      </div>

      {/* FOOTER */}
      <div className="sidepanel-footer">
        <p style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {calState.isCalibrated ? "✅" : "⏳"} Análisis en tiempo real • Privacidad garantizada
        </p>
      </div>
    </div>
  )
}

export default SidePanel