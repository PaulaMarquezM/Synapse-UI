import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import SessionsDashboard from "~components/SessionsDashboard"
import AuthForm from "~components/AuthForm"
import SessionControl from "~components/SessionControl"
import SessionSummaryModal from "~components/SessionSummaryModal"
import { useAuth } from "~hooks/useAuth"
import { signOut } from "~lib/supabase"
import { LogOut, Loader } from "lucide-react"
import type { DetectionData } from "~components/CameraFeed"
import type { SessionSummary } from "~lib/SessionManager"
import "./sidepanel.css"

import {
  createMetricsSmoother,
  defaultSmoothingConfig,
  type Metrics,
  type MetricsLevels
} from "~lib/metricsSmoothing"

import { createCalibrator, type CalibrationState, type Baseline } from "~lib/calibration"
import { createCognitiveCalculator } from "~lib/Cognitivethresholds"

const CALIBRATION_DURATION_MS = 12_000
const TARGET_SAMPLES = 20
const FALLBACK_MIN_SAMPLES = 8
const NUDGE_COOLDOWN_MS = 15000
const NO_FACE_MS = 4000
const OFFSCREEN_NUDGE_MS = 8000
const LOW_FOCUS_MS = 15000
const LOW_FOCUS_THRESHOLD = 40
const RECOVERY_FOCUS_THRESHOLD = 50


const SidePanel = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  
  const [data, setData] = useState<DetectionData | null>(null)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)
  const [nudge, setNudge] = useState<{ id: string; type: 'info' | 'warn' | 'danger'; text: string } | null>(null)
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })

  // Estados para el sistema de sesiones
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null)

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
  const cognitiveCalculatorRef = useRef(createCognitiveCalculator(null))
  const lastDetectionAtRef = useRef(0)
  const nudgeCooldownRef = useRef(0)
  const lowFocusSinceRef = useRef<number | null>(null)


  const clearNudge = (id?: string) => {
    setNudge((prev) => {
      if (!prev) return null
      if (!id || prev.id === id) return null
      return prev
    })
  }

  const pushNudge = (id: string, type: 'info' | 'warn' | 'danger', textMsg: string) => {
    const now = Date.now()
    if (now - nudgeCooldownRef.current < NUDGE_COOLDOWN_MS) return
    nudgeCooldownRef.current = now
    setNudge({ id, type, text: textMsg })
  }

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
    
    // Actualizar el calculador cognitivo con el nuevo baseline
    if (baseline) {
      cognitiveCalculatorRef.current.updateBaseline(baseline)
      console.log('🎯 Umbrales adaptativos actualizados:', cognitiveCalculatorRef.current.getThresholds())
    }
    
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
    if (!isAuthenticated) return
    const id = window.setInterval(() => {
      if (lastDetectionAtRef.current == 0) return
      const since = Date.now() - lastDetectionAtRef.current
      if (since > NO_FACE_MS) {
        pushNudge('no-face', 'warn', 'No te veo en la camara. Vuelve al encuadre para continuar el analisis.')
      } else {
        clearNudge('no-face')
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [isAuthenticated])

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
    lastDetectionAtRef.current = Date.now()
    clearNudge('no-face')
    setData(detectedData)
    if (calState.isCalibrating && !calState.isCalibrated) {
      calibratorRef.current.addSample(detectedData)
      const samples = calibratorRef.current.getSamples()
      const { timeElapsed } = calibratorRef.current.getProgress()
      if (samples >= TARGET_SAMPLES || (timeElapsed && samples >= FALLBACK_MIN_SAMPLES)) {
        finalizeCalibration()
      }
    }

    // NUEVO: Usar el sistema científico de cálculo cognitivo
    const cognitiveMetrics = cognitiveCalculatorRef.current.calculate(detectedData)
    if (cognitiveMetrics.alerts.highStress) {
      pushNudge('stress', 'danger', 'Estres alto detectado. Respira profundo 1-2 minutos y vuelve cuando te sientas mejor.')
    }
    if (cognitiveMetrics.alerts.phoneLooking) {
      pushNudge('phone', 'warn', 'Parece que miras el celular. Si puedes, regresa tu mirada a la pantalla.')
    }
    if (!cognitiveMetrics.attention.onScreen && cognitiveMetrics.attention.offScreenMs > OFFSCREEN_NUDGE_MS) {
      pushNudge('offscreen', 'info', 'Te alejaste de la pantalla. Vuelve para mantener el enfoque.')
    }
    
    // Aplicar smoothing a las métricas científicas
    const raw: Metrics = {
      focus: cognitiveMetrics.focus,
      stress: cognitiveMetrics.stress,
      alert: 100 - cognitiveMetrics.fatigue // Invertir fatigue para "alertness"
    }
    
    const { smoothed, levels: lv } = smootherRef.current.update(raw)
    setFocusScore(smoothed.focus)
    setStressLevel(smoothed.stress)
    setAlertLevel(smoothed.alert)
    setLevels(lv)

    if (smoothed.focus < LOW_FOCUS_THRESHOLD) {
      if (!lowFocusSinceRef.current) lowFocusSinceRef.current = Date.now()
      const lowFor = Date.now() - (lowFocusSinceRef.current || Date.now())
      if (lowFor > LOW_FOCUS_MS) {
        pushNudge('low-focus', 'info', 'Parece que tu foco bajo. Un pequeno ajuste y sigues avanzando.')
      }
    } else if (smoothed.focus >= RECOVERY_FOCUS_THRESHOLD) {
      lowFocusSinceRef.current = null
    }


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
        // Agregar métricas científicas adicionales
        cognitiveState: cognitiveMetrics.dominantState,
        confidence: cognitiveMetrics.confidence,
        alerts: cognitiveMetrics.alerts
      }
    })
  }

  const openDashboard = () => {
    const url = chrome.runtime.getURL("sidepanel.html?view=dashboard")
    chrome.tabs.create({ url })
  }

  const handleLogout = async () => {
    await signOut()
    startCalibration()
  }

  const handleAuthSuccess = () => {
    startCalibration()
  }

  const handleSessionEnd = (summary: SessionSummary) => {
    setLastSessionSummary(summary)
    setShowSummaryModal(true)
  }

  const handleCloseSummary = () => {
    setShowSummaryModal(false)
  }

  const isDashboardView = new URLSearchParams(window.location.search).get("view") === "dashboard"
  if (isDashboardView) {
    return <SessionsDashboard />
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
            onClick={openDashboard}
            style={{
              padding: 8,
              borderRadius: 8,
              background: 'rgba(96, 165, 250, 0.12)',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              cursor: 'pointer',
              display: 'flex'
            }}
            title="Abrir dashboard"
          >
            <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>DB</span>
          </motion.button>
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

                {nudge && (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: nudge.type === 'danger'
                ? 'rgba(239, 68, 68, 0.12)'
                : nudge.type === 'warn'
                ? 'rgba(251, 191, 36, 0.12)'
                : 'rgba(96, 165, 250, 0.12)',
              border: nudge.type === 'danger'
                ? '1px solid rgba(239, 68, 68, 0.35)'
                : nudge.type === 'warn'
                ? '1px solid rgba(251, 191, 36, 0.35)'
                : '1px solid rgba(96, 165, 250, 0.35)',
              color: 'white',
              fontSize: 12
            }}
          >
            {nudge.text}
          </div>
        )}

{/* CONTROL DE SESIONES */}
        {calState.isCalibrated && (
          <SessionControl
            onSessionEnd={handleSessionEnd}
            currentMetrics={data ? {
              focus: focusScore,
              stress: stressLevel,
              fatigue: 100 - alertLevel, // Usar fatigue real
              distraction: 100 - focusScore,
              dominantState: levels.focus === "Alto" ? "focus" : 
                            levels.stress === "Alto" ? "stress" : 
                            levels.alert === "Bajo" ? "fatigue" : "neutral",
              confidence: cognitiveCalculatorRef.current.calculate(data).confidence
            } : null}
          />
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

      {/* MODAL DE RESUMEN */}
      <SessionSummaryModal
        isOpen={showSummaryModal}
        onClose={handleCloseSummary}
        summary={lastSessionSummary}
      />
    </div>
  )
}

export default SidePanel
