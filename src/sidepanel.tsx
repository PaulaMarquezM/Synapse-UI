import React, { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import CameraFeed from "~components/CameraFeed"
import Dashboard from "~components/Dashboard"
import SessionsDashboard from "~components/SessionsDashboard"
import AuthForm from "~components/AuthForm"
import SessionControl from "~components/SessionControl"
import SessionSummaryModal from "~components/SessionSummaryModal"
import SidepanelHeader from "~components/sidepanel/SidepanelHeader"
import CalibrationBanner from "~components/sidepanel/CalibrationBanner"
import NudgeBanner from "~components/sidepanel/NudgeBanner"
import AttentionBadge from "~components/sidepanel/AttentionBadge"
import { useAuth } from "~hooks/useAuth"
import { signOut } from "~lib/supabase"
import { Loader } from "lucide-react"
import type { DetectionData } from "~components/CameraFeed"
import type { SessionSummary } from "~lib/sessionManager"
import "./sidepanel.css"

import {
  createMetricsSmoother,
  defaultSmoothingConfig,
  type Metrics,
  type MetricsLevels
} from "~lib/metricsSmoothing"

import { createCalibrator, type CalibrationState, type Baseline } from "~lib/calibration"
import { createCognitiveCalculator } from "~lib/cognitivethresholds"

const CALIBRATION_DURATION_MS = 12_000
const TARGET_SAMPLES = 20
const FALLBACK_MIN_SAMPLES = 8
const NUDGE_COOLDOWN_MS = 15000
const NO_FACE_MS = 4000
const OFFSCREEN_NUDGE_MS = 8000
const LOW_FOCUS_MS = 15000
const LOW_FOCUS_THRESHOLD = 40
const RECOVERY_FOCUS_THRESHOLD = 50
const BACKGROUND_BROADCAST_INTERVAL_MS = 1000


const SidePanel = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  
  const [data, setData] = useState<DetectionData | null>(null)
  const [focusScore, setFocusScore] = useState(50)
  const [stressLevel, setStressLevel] = useState(20)
  const [alertLevel, setAlertLevel] = useState(80)
  const [nudge, setNudge] = useState<{ id: string; type: 'info' | 'warn' | 'danger'; text: string } | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [attentionStatus, setAttentionStatus] = useState<{ label: string; color: string; bg: string }>({
    label: "En pantalla",
    color: "#4ade80",
    bg: "rgba(34, 197, 94, 0.12)"
  })
  const [levels, setLevels] = useState<MetricsLevels>({
    focus: "Normal",
    stress: "Normal",
    alert: "Normal"
  })
  const [currentConfidence, setCurrentConfidence] = useState(0.5)

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
  const lastSoundAtRef = useRef(0)
  const lastBackgroundBroadcastAtRef = useRef(0)
  const calibrationFinalizedRef = useRef(false)


  useEffect(() => {
    const stored = localStorage.getItem("synapse_sound_enabled")
    if (stored === "1") setSoundEnabled(true)
  }, [])

  const playBeep = () => {
    const now = Date.now()
    if (now - lastSoundAtRef.current < 3000) return
    lastSoundAtRef.current = now

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.value = 0.05
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
      osc.onended = () => ctx.close()
    } catch {
      // ignore audio errors
    }
  }

  const clearNudge = (id?: string) => {
    setNudge((prev) => {
      if (!prev) return null
      if (!id || prev.id === id) return null
      return prev
    })
  }

  const pushNudge = (
    id: string,
    type: 'info' | 'warn' | 'danger',
    textMsg: string,
    withSound: boolean = false
  ) => {
    const now = Date.now()
    if (now - nudgeCooldownRef.current < NUDGE_COOLDOWN_MS) return
    nudgeCooldownRef.current = now
    setNudge({ id, type, text: textMsg })
    if (soundEnabled && withSound) playBeep()
  }

  const startCalibration = () => {
    calibrationFinalizedRef.current = false
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
    if (calibrationFinalizedRef.current || calibratorRef.current.isDone()) return
    calibrationFinalizedRef.current = true
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
        setAttentionStatus({
          label: "Sin rostro",
          color: "#fbbf24",
          bg: "rgba(251, 191, 36, 0.12)"
        })
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
      if (!calibratorRef.current.isDone() && (samples >= TARGET_SAMPLES || (timeElapsed && samples >= FALLBACK_MIN_SAMPLES))) {
        finalizeCalibration()
      }
    }

    // NUEVO: Usar el sistema científico de cálculo cognitivo
    const cognitiveMetrics = cognitiveCalculatorRef.current.calculate(detectedData)
    const attention = cognitiveMetrics.attention
    if (attention.classification === "uncertain") {
      setAttentionStatus({
        label: "Ajustando",
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.12)"
      })
    } else if (attention.phoneLooking) {
      setAttentionStatus({
        label: "Celular",
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.12)"
      })
    } else if (!attention.onScreen) {
      setAttentionStatus({
        label: "Fuera",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.12)"
      })
    } else {
      setAttentionStatus({
        label: "En pantalla",
        color: "#4ade80",
        bg: "rgba(34, 197, 94, 0.12)"
      })
    }
    if (cognitiveMetrics.alerts.highStress) {
      pushNudge(
        'stress',
        'danger',
        'Estres alto detectado. Respira profundo 1-2 minutos y vuelve cuando te sientas mejor.',
        true
      )
    }
    // Nudge por celular detectado como objeto en cámara (COCO-SSD)
    if (detectedData.phoneInFrame) {
      pushNudge(
        'phone-camera',
        'warn',
        'Se detecto un celular en camara. Guardalo para mantener tu enfoque.',
        true
      )
    } else {
      clearNudge('phone-camera')
    }

    // Nudge por postura de celular (pitch + gaze)
    if (attention.phoneLooking && !detectedData.phoneInFrame) {
      pushNudge(
        'phone',
        'warn',
        'Parece que miras el celular. Si puedes, regresa tu mirada a la pantalla.',
        true
      )
    } else {
      clearNudge('phone')
    }

    if (attention.classification !== "uncertain" && !attention.onScreen && attention.offScreenMs > OFFSCREEN_NUDGE_MS) {
      pushNudge('offscreen', 'info', 'Llevas un rato sin mirar la pantalla. Vuelve para retomar el enfoque.', true)
    } else if (attention.onScreen || attention.classification === "uncertain") {
      clearNudge('offscreen')
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
    setCurrentConfidence(cognitiveMetrics.confidence)

    if (attention.classification === "uncertain") {
      lowFocusSinceRef.current = null
    } else if (smoothed.focus < LOW_FOCUS_THRESHOLD) {
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
    
    const now = Date.now()
    if (now - lastBackgroundBroadcastAtRef.current >= BACKGROUND_BROADCAST_INTERVAL_MS) {
      lastBackgroundBroadcastAtRef.current = now
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
  }

  const openDashboard = () => {
    const url = chrome.runtime.getURL("sidepanel.html?view=dashboard")
    chrome.tabs.create({ url })
  }

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem("synapse_sound_enabled", next ? "1" : "0")
    if (next) playBeep()
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
      <SidepanelHeader
        email={user?.email}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenDashboard={openDashboard}
        onLogout={handleLogout}
      />

      {/* CONTENT */}
      <div className="sidepanel-content">
        <CalibrationBanner calState={calState} onStartCalibration={startCalibration} />
        <NudgeBanner nudge={nudge} />

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
              confidence: currentConfidence
            } : null}
          />
        )}

        <AttentionBadge status={attentionStatus} />

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
