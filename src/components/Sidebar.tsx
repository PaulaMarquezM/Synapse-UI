/**
 * SYNAPSE UI - Persistent Sidebar
 * Sidebar flotante que permanece visible mientras navegas
 */

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import { useAuth } from "~hooks/useAuth"
import { signOut } from "~lib/supabase"
import { LogOut, Minimize2, Maximize2, X } from "lucide-react"
import type { DetectionData } from "~components/CameraFeed"

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

const Sidebar = () => {
  const { user, isAuthenticated } = useAuth()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Estados cognitivos
  const [data, setData] = useState<DetectionData | null>(null)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })

  // Calibración
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
      {
        ...defaultSmoothingConfig,
        alpha: 0.12,
        maxDeltaPerTick: 5
      }
    )
  )

  // ============================================
  // CALIBRATION LOGIC
  // ============================================

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
    if (!calState.isCalibrating) return

    const id = window.setInterval(() => {
      const { progress, secondsRemaining, timeElapsed } = calibratorRef.current.getProgress()
      const samples = calibratorRef.current.getSamples()

      setCalState((prev) => {
        if (!prev.isCalibrating) return prev
        let message = prev.message
        if (timeElapsed && samples < FALLBACK_MIN_SAMPLES) {
          message = "Pocas detecciones. Mejora la iluminación frontal."
        } else {
          message = undefined
        }
        return { ...prev, progress, secondsRemaining, samples, message }
      })
    }, 200)

    return () => window.clearInterval(id)
  }, [calState.isCalibrating])

  // ============================================
  // DETECTION HANDLER
  // ============================================

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData)

    // Calibración
    if (calState.isCalibrating && !calState.isCalibrated) {
      calibratorRef.current.addSample(detectedData)
      const samples = calibratorRef.current.getSamples()
      const { timeElapsed } = calibratorRef.current.getProgress()

      if (samples >= TARGET_SAMPLES || (timeElapsed && samples >= FALLBACK_MIN_SAMPLES)) {
        finalizeCalibration()
      }
    }

    // Calcular métricas
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

  // ============================================
  // HANDLERS
  // ============================================

  const handleLogout = async () => {
    await signOut()
  }

  if (!isAuthenticated || !isVisible) return null

  return (
    <motion.div
      initial={{ x: 400 }}
      animate={{ x: 0 }}
      exit={{ x: 400 }}
      transition={{ type: "spring", damping: 20 }}
      className="synapse-sidebar"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: isMinimized ? "60px" : "380px",
        height: "100vh",
        background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
        boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.5)",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.3s ease"
      }}
    >
      {/* Header */}
      <div style={{
        padding: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.3)"
      }}>
        {!isMinimized && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>SYNAPSE UI</p>
            <p style={{
              fontSize: 11,
              fontWeight: 600,
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {user?.email}
            </p>
          </div>
        )}
        
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              padding: 6,
              borderRadius: 6,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
              color: "white"
            }}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          
          {!isMinimized && (
            <>
              <button
                onClick={handleLogout}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444"
                }}
              >
                <LogOut size={14} />
              </button>
              
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: "pointer",
                  color: "white"
                }}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {/* Calibration Banner */}
          {calState.isCalibrating && (
            <div style={{
              marginBottom: 12,
              padding: "10px",
              borderRadius: 10,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)"
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "white", marginBottom: 4 }}>
                🧠 Calibrando...
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                {calState.message || `${calState.secondsRemaining}s • ${calState.samples}/${calState.targetSamples}`}
              </div>
              <div style={{
                height: 4,
                marginTop: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${calState.progress * 100}%`,
                  background: "linear-gradient(90deg, #60a5fa, #8b5cf6)",
                  transition: "width 0.3s"
                }} />
              </div>
            </div>
          )}

          {/* Camera Preview (pequeño) */}
          <div style={{ marginBottom: 12, display: calState.isCalibrating ? "block" : "none" }}>
            <CameraFeed 
              onDetection={handleDetection} 
              preview 
              previewWidth={356} 
              previewHeight={200} 
            />
          </div>

          {/* Dashboard */}
          <Dashboard
            data={data}
            focusScore={focusScore}
            stressLevel={stressLevel}
            alertLevel={alertLevel}
          />
        </div>
      )}

      {/* Footer */}
      {!isMinimized && (
        <div style={{
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center",
          background: "rgba(0,0,0,0.2)"
        }}>
          <p style={{ fontSize: 9, color: "#64748b" }}>
            {calState.isCalibrated ? "✅ Calibrado" : "⏳ Calibrando..."} • Privacidad garantizada
          </p>
        </div>
      )}
    </motion.div>
  )
}

export default Sidebar