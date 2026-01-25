/**
 * SYNAPSE UI - Main Popup (Integrated)
 * Combina autenticación + calibración + análisis cognitivo
 */

import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import AuthForm from "~components/AuthForm"
import { useAuth } from "~hooks/useAuth"
import { signOut } from "~lib/supabase"
import { LogOut, Loader } from "lucide-react"
import type { DetectionData } from "~components/CameraFeed"
import "./popup.css"

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

const Popup = () => {
  // ============================================
  // AUTH STATE
  // ============================================
  const { user, loading: authLoading, isAuthenticated } = useAuth()

  // ============================================
  // COGNITIVE STATE
  // ============================================
  const [data, setData] = useState<DetectionData | null>(null)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })

  // ============================================
  // CALIBRATION STATE
  // ============================================
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
  // CALIBRATION FUNCTIONS
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

  // Timer de UI (progreso + samples)
  useEffect(() => {
    if (!calState.isCalibrating || !isAuthenticated) return

    const id = window.setInterval(() => {
      const { progress, secondsRemaining, timeElapsed } = calibratorRef.current.getProgress()
      const samples = calibratorRef.current.getSamples()

      setCalState((prev) => {
        if (!prev.isCalibrating) return prev

        let message = prev.message

        if (timeElapsed && samples < FALLBACK_MIN_SAMPLES) {
          message =
            "Pocas detecciones. Evita contraluz, acerca el rostro y mejora iluminación frontal."
        } else {
          message = undefined
        }

        return {
          ...prev,
          progress,
          secondsRemaining,
          samples,
          message
        }
      })
    }, 200)

    return () => window.clearInterval(id)
  }, [calState.isCalibrating, isAuthenticated])

  // ============================================
  // DETECTION HANDLER
  // ============================================

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData)

    // Calibración: acumular muestras
    if (calState.isCalibrating && !calState.isCalibrated) {
      calibratorRef.current.addSample(detectedData)

      const samples = calibratorRef.current.getSamples()
      const { timeElapsed } = calibratorRef.current.getProgress()

      if (samples >= TARGET_SAMPLES) {
        finalizeCalibration()
      } else if (timeElapsed && samples >= FALLBACK_MIN_SAMPLES) {
        finalizeCalibration()
      }
    }

    // RAW metrics
    const raw: Metrics = {
      focus: calculateFocusScore(detectedData),
      stress: calculateStressLevel(detectedData),
      alert: calculateAlertLevel(detectedData)
    }

    // Ajuste por baseline
    const adjusted = applyBaseline(raw, detectedData, calState.baseline)

    // Smoothed + levels
    const { smoothed, levels: lv } = smootherRef.current.update(adjusted)

    setFocusScore(smoothed.focus)
    setStressLevel(smoothed.stress)
    setAlertLevel(smoothed.alert)
    setLevels(lv)

    // Emoción dominante
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
        levels: lv,
        calibration: {
          isCalibrated: calState.isCalibrated,
          progress: calState.progress,
          secondsRemaining: calState.secondsRemaining,
          samples: calState.samples,
          targetSamples: calState.targetSamples
        }
      }
    })
  }

  // ============================================
  // BASELINE ADJUSTMENT
  // ============================================

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

    const negNow =
      (expr.angry ?? 0) + (expr.sad ?? 0) + (expr.fearful ?? 0) + (expr.disgusted ?? 0)
    const negBase =
      (baseExpr.angry ?? 0) +
      (baseExpr.sad ?? 0) +
      (baseExpr.fearful ?? 0) +
      (baseExpr.disgusted ?? 0)

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

  // ============================================
  // RAW METRICS CALCULATION
  // ============================================

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

  // ============================================
  // AUTH HANDLERS
  // ============================================

  const handleLogout = async () => {
    const { error } = await signOut()
    if (!error) {
      console.log("✅ Sesión cerrada")
      // Resetear calibración al cerrar sesión
      startCalibration()
    }
  }

  const handleAuthSuccess = () => {
    console.log("✅ Autenticación exitosa")
    // Iniciar calibración automáticamente al autenticarse
    startCalibration()
  }

  // ============================================
  // RENDER CALIBRATION BANNER
  // ============================================

  const renderCalibrationBanner = () => {
    if (!calState.isCalibrating && calState.isCalibrated) {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={startCalibration}
            style={{
              fontSize: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)"
            }}
            title="Recalibrar baseline"
          >
            🎯 Recalibrar
          </button>
        </div>
      )
    }

    if (!calState.isCalibrating) return null

    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          marginBottom: 10,
          padding: "10px 12px",
          borderRadius: 12,
          background: "rgba(59, 130, 246, 0.1)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          color: "white"
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>🧠 Calibrando...</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {calState.message
                ? calState.message
                : `Mantén el rostro centrado ${calState.secondsRemaining}s • muestras ${calState.samples}/${calState.targetSamples}`}
            </div>
          </div>

          <button
            onClick={startCalibration}
            style={{
              fontSize: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)"
            }}
            title="Reiniciar calibración"
          >
            🔄 Reiniciar
          </button>
        </div>

        <div
          style={{
            height: 6,
            marginTop: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(calState.progress * 100)}%`,
              background: "linear-gradient(90deg, rgba(96,165,250,1), rgba(139,92,246,1))",
              transition: "width 0.3s ease"
            }}
          />
        </div>
      </div>
    )
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (authLoading) {
    return (
      <div
        style={{
          width: "360px",
          minHeight: "520px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ marginBottom: 16 }}
          >
            <Loader size={48} color="#60a5fa" />
          </motion.div>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Cargando SYNAPSE UI...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // NOT AUTHENTICATED - SHOW LOGIN
  // ============================================

  if (!isAuthenticated) {
    return (
      <div
        style={{
          width: "360px",
          minHeight: "520px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
          padding: "20px"
        }}
      >
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </div>
    )
  }

  // ============================================
  // AUTHENTICATED - SHOW MAIN INTERFACE
  // ============================================

  return (
    <div style={{ minHeight: "520px", background: "#0b1220", color: "white" }}>
      {/* Header compacto con usuario y logout */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0,0,0,0.2)"
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>Conectado como</p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Cerrar sesión"
        >
          <LogOut size={16} color="#ef4444" />
        </motion.button>
      </div>

      {/* Contenido principal */}
      <div style={{ padding: "12px" }}>
        {renderCalibrationBanner()}

        {/* Cámara con preview */}
        <div style={{ marginBottom: 12 }}>
          <CameraFeed onDetection={handleDetection} preview previewWidth={336} previewHeight={220} />
        </div>

        {/* Dashboard de métricas */}
        <Dashboard
          data={data}
          focusScore={focusScore}
          stressLevel={stressLevel}
          alertLevel={alertLevel}
        />
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
          background: "rgba(0,0,0,0.2)"
        }}
      >
        <p style={{ fontSize: 10, color: "#64748b" }}>
          {calState.isCalibrated ? "✅ Calibrado" : "⏳ Calibrando..."} • Análisis en tiempo real •
          Privacidad garantizada
        </p>
      </div>
    </div>
  )
}

export default Popup