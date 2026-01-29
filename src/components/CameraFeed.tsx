// src/components/CameraFeed.tsx
import React, { useEffect, useRef, useState } from "react"
import type * as FaceApi from "face-api.js"
import { installModelFetchPatch } from "~lib/installModelFetchPatch"

const EXPRESSION_KEYS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"] as const
type ExpressionKey = (typeof EXPRESSION_KEYS)[number]
type ExpressionMap = Record<ExpressionKey, number>

const normalizeExpressions = (expressions: FaceApi.FaceExpressions): ExpressionMap => ({
  neutral: expressions.neutral ?? 0,
  happy: expressions.happy ?? 0,
  sad: expressions.sad ?? 0,
  angry: expressions.angry ?? 0,
  fearful: expressions.fearful ?? 0,
  disgusted: expressions.disgusted ?? 0,
  surprised: expressions.surprised ?? 0
})


// Datos que se envían al Dashboard
export interface DetectionData {
  expressions: ExpressionMap
  gazeX: number
  gazeY: number
  headPose: {
    yaw: number
    pitch: number
    roll: number
  }
  blinkRate: number
}

interface CameraFeedProps {
  onDetection: (data: DetectionData) => void

  // NUEVO: preview para IHC (ver cámara + overlay)
  preview?: boolean
  previewWidth?: number
  previewHeight?: number
}

const DETECTION_INTERVAL_MS = 200
const TINY_INPUT_SIZE = 320
const MIN_FACE_SCORE = 0.45
const MIN_FACE_AREA = 0.03
const MAX_FACE_AREA = 0.6

const EXP_SMOOTH_ALPHA = 0.35
const POSE_SMOOTH_ALPHA = 0.25
const GAZE_SMOOTH_ALPHA = 0.2
const EAR_BASELINE_ALPHA = 0.03
const BLINK_CLOSE_RATIO = 0.65
const BLINK_OPEN_HYSTERESIS = 0.02
const MIN_BLINK_MS = 60
const MAX_BLINK_MS = 400
const RESET_STABILIZERS_AFTER_MS = 2000

const CameraFeed: React.FC<CameraFeedProps> = ({
  onDetection,
  preview = false,
  previewWidth = 260,
  previewHeight = 195
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Módulo face-api
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null)
  const tinyOptionsRef = useRef<FaceApi.TinyFaceDetectorOptions | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Parpadeo
  const blinkHistory = useRef<number[]>([])
  const blinkStateRef = useRef<{ isBlinking: boolean; startedAt: number | null }>({
    isBlinking: false,
    startedAt: null
  })
  const earBaselineRef = useRef<number | null>(null)

  // Stabilizers
  const smoothedExpressionsRef = useRef<ExpressionMap | null>(null)
  const smoothedPoseRef = useRef<{ yaw: number; pitch: number; roll: number } | null>(null)
  const smoothedGazeRef = useRef<{ x: number; y: number } | null>(null)
  const lastGoodDetectionAtRef = useRef(0)

  // Control loop
  const isDetectingRef = useRef(false)
  const isMountedRef = useRef(true)

  /* ============================
     CARGA DE MODELOS
     ============================ */
  useEffect(() => {
    isMountedRef.current = true
    let isActive = true

    const loadModels = async () => {
      try {
        console.log("========== [SYNAPSE] INICIO CARGA MODELOS ==========")
        console.log("[SYNAPSE] UserAgent:", navigator.userAgent)
        console.log("[SYNAPSE] Location:", window.location.href)
        console.log("[SYNAPSE] Extension ID (host):", window.location.host)

        console.log("[SYNAPSE] Instalando GLOBAL fetch patch...")
        installModelFetchPatch()
        console.log("[SYNAPSE] GLOBAL fetch patch instalado ✅")

        console.log("[SYNAPSE] Importando face-api.js dinámicamente...")
        const faceapi = await import("face-api.js")
        faceapiRef.current = faceapi
        console.log("[SYNAPSE] face-api.js importado ✅")

        const BASE = chrome.runtime.getURL("assets/models/")
        console.log("[SYNAPSE] MODEL_BASE =", BASE)

        const requiredFiles = [
          "tiny_face_detector_model-weights_manifest.json",
          "tiny_face_detector_model-shard1",
          "face_expression_model-weights_manifest.json",
          "face_expression_model-shard1",
          "face_landmark_68_model-weights_manifest.json",
          "face_landmark_68_model-shard1"
        ]

        console.log("[SYNAPSE] Verificando accesibilidad de archivos...")
        for (const file of requiredFiles) {
          const url = `${BASE}${file}`
          const r = await fetch(url, { cache: "no-store" })
          console.log("[SYNAPSE] CHECK FILE:", r.status, r.ok, url)
          if (!r.ok) throw new Error(`Archivo no accesible: ${url}`)
        }
        console.log("[SYNAPSE] Accesibilidad OK ✅")

        console.log("[SYNAPSE] Iniciando face-api loadFromUri(BASE)...")
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(BASE),
          faceapi.nets.faceExpressionNet.loadFromUri(BASE),
          faceapi.nets.faceLandmark68Net.loadFromUri(BASE)
        ])

        if (!isActive) return
        console.log("✅ [SYNAPSE] MODELOS DE IA CARGADOS CORRECTAMENTE")
        setModelsLoaded(true)
      } catch (error) {
        console.error("❌ [SYNAPSE] ERROR CARGANDO MODELOS:", error)
      }
    }

    void loadModels()

    return () => {
      isActive = false
      isMountedRef.current = false
      console.log("[SYNAPSE] Cleanup loadModels")
    }
  }, [])

  /* ============================
     INICIALIZAR CÁMARA
     ============================ */
  useEffect(() => {
    if (modelsLoaded && !isInitialized) {
      void startVideo()
    }
  }, [modelsLoaded, isInitialized])

  const startVideo = async () => {
    try {
      console.log("[SYNAPSE] Solicitando cámara...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user"
        }
      })

      if (!videoRef.current) return
      videoRef.current.srcObject = stream

      try {
        await videoRef.current.play()
      } catch (e) {
        console.warn("[SYNAPSE] play() warning:", e)
      }

      setIsInitialized(true)
      console.log("[SYNAPSE] Cámara inicializada ✅")
    } catch (err) {
      console.error("[SYNAPSE] Error al acceder a la cámara:", err)
    }
  }

  
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  const smoothValue = (prev: number, next: number, alpha: number) =>
    prev + alpha * (next - prev)

  const smoothPose = (pose: { yaw: number; pitch: number; roll: number }) => {
    const prev = smoothedPoseRef.current
    if (!prev) {
      smoothedPoseRef.current = pose
      return pose
    }
    const next = {
      yaw: smoothValue(prev.yaw, pose.yaw, POSE_SMOOTH_ALPHA),
      pitch: smoothValue(prev.pitch, pose.pitch, POSE_SMOOTH_ALPHA),
      roll: smoothValue(prev.roll, pose.roll, POSE_SMOOTH_ALPHA)
    }
    smoothedPoseRef.current = next
    return next
  }

  const smoothGaze = (gaze: { x: number; y: number }) => {
    const prev = smoothedGazeRef.current
    if (!prev) {
      smoothedGazeRef.current = gaze
      return gaze
    }
    const next = {
      x: smoothValue(prev.x, gaze.x, GAZE_SMOOTH_ALPHA),
      y: smoothValue(prev.y, gaze.y, GAZE_SMOOTH_ALPHA)
    }
    smoothedGazeRef.current = next
    return next
  }

  const smoothExpressions = (expressions: FaceApi.FaceExpressions): ExpressionMap => {
    const base = normalizeExpressions(expressions)
    const prev = smoothedExpressionsRef.current
    if (!prev) {
      smoothedExpressionsRef.current = base
      return base
    }

    const next: ExpressionMap = { ...prev }
    for (const k of EXPRESSION_KEYS) {
      const prevVal = prev[k]
      const nextVal = base[k]
      next[k] = clamp(smoothValue(prevVal, nextVal, EXP_SMOOTH_ALPHA), 0, 1)
    }
    smoothedExpressionsRef.current = next
    return next
  }

  const resetStabilizers = () => {
    smoothedExpressionsRef.current = null
    smoothedPoseRef.current = null
    smoothedGazeRef.current = null
    earBaselineRef.current = null
    blinkStateRef.current = { isBlinking: false, startedAt: null }
  }

  const computeEyeAspectRatio = (eye: FaceApi.Point[]) => {
    if (eye.length < 6) return 0
    const height1 = Math.abs(eye[1].y - eye[5].y)
    const height2 = Math.abs(eye[2].y - eye[4].y)
    const width = Math.abs(eye[3].x - eye[0].x)
    return (height1 + height2) / Math.max(1e-6, 2 * width)
  }

  const isDetectionReliable = (
    detections: FaceApi.WithFaceLandmarks<any> & FaceApi.WithFaceExpressions<any>,
    vw: number,
    vh: number
  ) => {
    const score = detections.detection.score ?? 1
    if (score < MIN_FACE_SCORE) return false
    const b = detections.detection.box
    const areaRatio = (b.width * b.height) / Math.max(1, vw * vh)
    if (areaRatio < MIN_FACE_AREA || areaRatio > MAX_FACE_AREA) return false
    return true
  }

  /* ============================
     CÁLCULO DE ORIENTACIÓN
     ============================ */
  const calculateHeadPose = (landmarks: FaceApi.FaceLandmarks68) => {
    const nose = landmarks.getNose()
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const noseTip = nose[3]
    const leftEyeCenter = leftEye[0]
    const rightEyeCenter = rightEye[3]

    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x)
    const noseOffset = noseTip.x - (leftEyeCenter.x + rightEyeCenter.x) / 2
    const yaw = (noseOffset / Math.max(1, eyeDistance)) * 45

    const eyeLevel = (leftEyeCenter.y + rightEyeCenter.y) / 2
    const nosePitch = (noseTip.y - eyeLevel) / 50
    const pitch = Math.max(-30, Math.min(30, nosePitch * 30))

    const eyeAngle = Math.atan2(
      rightEyeCenter.y - leftEyeCenter.y,
      rightEyeCenter.x - leftEyeCenter.x
    )
    const roll = (eyeAngle * 180) / Math.PI

    return { yaw, pitch, roll }
  }

  /* ============================
     DETECCIÓN DE PARPADEO
     ============================ */
  const updateBlinkState = (landmarks: FaceApi.FaceLandmarks68): boolean => {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const leftEAR = computeEyeAspectRatio(leftEye)
    const rightEAR = computeEyeAspectRatio(rightEye)
    const avgEAR = (leftEAR + rightEAR) / 2

    if (!blinkStateRef.current.isBlinking) {
      earBaselineRef.current =
        earBaselineRef.current === null
          ? avgEAR
          : smoothValue(earBaselineRef.current, avgEAR, EAR_BASELINE_ALPHA)
    }

    const baseline = earBaselineRef.current ?? avgEAR
    const closeThreshold = Math.max(0.08, baseline * BLINK_CLOSE_RATIO)
    const openThreshold = closeThreshold + BLINK_OPEN_HYSTERESIS

    const now = Date.now()

    if (!blinkStateRef.current.isBlinking) {
      if (avgEAR < closeThreshold) {
        blinkStateRef.current.isBlinking = true
        blinkStateRef.current.startedAt = now
      }
    } else {
      if (avgEAR > openThreshold) {
        const startedAt = blinkStateRef.current.startedAt ?? now
        const duration = now - startedAt
        blinkStateRef.current.isBlinking = false
        blinkStateRef.current.startedAt = null

        if (duration >= MIN_BLINK_MS && duration <= MAX_BLINK_MS) {
          blinkHistory.current.push(now)
        }
      }
    }

    return blinkStateRef.current.isBlinking
  }

  /* ============================
     ESTIMACIÓN DE MIRADA (proxy)
     ============================ */
  const estimateGaze = (detection: FaceApi.WithFaceLandmarks<any>) => {
    const box = detection.detection.box
    const videoWidth = videoRef.current?.videoWidth || 640
    const videoHeight = videoRef.current?.videoHeight || 480

    const faceCenterX = box.x + box.width / 2
    const faceCenterY = box.y + box.height / 2

    const screenW = window.screen.width || 1
    const screenH = window.screen.height || 1
    const screenX = clamp(screenW * (1 - faceCenterX / videoWidth), 0, screenW)
    const screenY = clamp(screenH * (faceCenterY / videoHeight), 0, screenH)

    return { x: screenX, y: screenY }
  }

  /* ============================
     FRECUENCIA DE PARPADEO
     ============================ */
  const updateBlinkRate = () => {
    const now = Date.now()
    blinkHistory.current = blinkHistory.current.filter((time) => now - time < 60000)
    return blinkHistory.current.length
  }

  /* ============================
     DIBUJO OVERLAY (box + landmarks)
     ============================ */
  const drawOverlay = (
    detections: FaceApi.WithFaceLandmarks<any> & FaceApi.WithFaceExpressions<any>,
    expressionsOverride?: ExpressionMap
  ) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Ajustar canvas a tamaño real del video (para dibujar coordenadas correctas)
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    if (canvas.width !== vw) canvas.width = vw
    if (canvas.height !== vh) canvas.height = vh

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // box
    const b = detections.detection.box
    ctx.strokeStyle = "rgba(96,165,250,0.95)"
    ctx.lineWidth = 3
    ctx.strokeRect(b.x, b.y, b.width, b.height)

    // landmarks (puntos)
    const pts = detections.landmarks.positions
    ctx.fillStyle = "rgba(139,92,246,0.95)"
    for (const p of pts) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // texto pequeño: emoción dominante (opcional)
    const exprAny = expressionsOverride ?? normalizeExpressions(detections.expressions)
    const emotion = Object.keys(exprAny).reduce((a, k) => (exprAny[k] > exprAny[a] ? k : a), "neutral")

    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "16px Inter, system-ui, sans-serif"
    ctx.fillText(`face: ok | ${emotion}`, Math.max(10, b.x), Math.max(20, b.y - 8))
  }

  /* ============================
     LOOP PRINCIPAL DE DETECCIÓN
     ============================ */
  const handleVideoOnPlay = () => {
    if (isDetectingRef.current) return
    if (!videoRef.current) return
    if (!canvasRef.current) return

    const faceapi = faceapiRef.current
    if (!faceapi) return

    isDetectingRef.current = true

    const tick = async () => {
      if (!isMountedRef.current) return

      const video = videoRef.current
      if (!video) return

      const vw = video.videoWidth || 0
      const vh = video.videoHeight || 0
      if (!vw || !vh) {
        setTimeout(tick, 100)
        return
      }

      if (!modelsLoaded) {
        setTimeout(tick, 150)
        return
      }

      try {
        if (!tinyOptionsRef.current) {
          tinyOptionsRef.current = new faceapi.TinyFaceDetectorOptions({
            inputSize: TINY_INPUT_SIZE,
            scoreThreshold: MIN_FACE_SCORE
          })
        }

        const detections = await faceapi
          .detectSingleFace(video, tinyOptionsRef.current)
          .withFaceLandmarks()
          .withFaceExpressions()

        if (detections && isDetectionReliable(detections, vw, vh)) {
          lastGoodDetectionAtRef.current = Date.now()

          const expressions = smoothExpressions(detections.expressions)
          const headPose = smoothPose(calculateHeadPose(detections.landmarks))
          const gaze = smoothGaze(estimateGaze(detections))

          // overlay visual (si preview)
          if (preview) drawOverlay(detections, expressions)

          updateBlinkState(detections.landmarks)
          const blinkRate = updateBlinkRate()

          const combinedData: DetectionData = {
            expressions,
            gazeX: gaze.x,
            gazeY: gaze.y,
            headPose,
            blinkRate
          }

          onDetection(combinedData)
        } else {
          // si no hay deteccion, limpiamos overlay para que sea obvio
          if (preview && canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          }

          if (Date.now() - lastGoodDetectionAtRef.current > RESET_STABILIZERS_AFTER_MS) {
            resetStabilizers()
          }
        }
      } catch (error) {
        console.error("[SYNAPSE] Error en detección:", error)
      }

      // Menos carga que 150ms. Si quieres más fluido, baja a 150 luego.
      setTimeout(tick, DETECTION_INTERVAL_MS)
    }

    void tick()
  }

  // UI preview (si preview=true)
  const previewContainerStyle: React.CSSProperties = {
    width: previewWidth,
    height: previewHeight,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)"
  }

  const previewVideoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)" // espejo típico selfie
  }

  const previewCanvasStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none"
  }

  // Modo oculto (cuando preview=false): mantenemos video/canvas fuera de pantalla
  const offscreenStyle: React.CSSProperties = {
    position: "fixed",
    left: "-10000px",
    top: 0,
    width: 640,
    height: 480,
    opacity: 0,
    pointerEvents: "none"
  }

  return (
    <div style={{ position: "relative" }}>
      {/* PREVIEW visible (IHC) */}
      {preview && (
        <div style={previewContainerStyle}>
          <video
            ref={videoRef}
            onPlay={handleVideoOnPlay}
            onLoadedMetadata={() => {
              void videoRef.current?.play()
            }}
            autoPlay
            muted
            playsInline
            style={previewVideoStyle}
          />
          <canvas ref={canvasRef} style={previewCanvasStyle} />
        </div>
      )}

      {/* MODO OCULTO (si preview=false) */}
      {!preview && (
        <>
          <video
            ref={videoRef}
            onPlay={handleVideoOnPlay}
            onLoadedMetadata={() => {
              void videoRef.current?.play()
            }}
            autoPlay
            muted
            playsInline
            style={offscreenStyle}
          />
          <canvas ref={canvasRef} style={offscreenStyle} />
        </>
      )}

      {!modelsLoaded && (
        <div
          style={{
            color: "#fbbf24",
            padding: "10px",
            background: "rgba(251, 191, 36, 0.1)",
            borderRadius: "8px",
            fontSize: "12px",
            marginTop: 10
          }}
        >
          ⏳ Cargando modelos de IA...
        </div>
      )}

      {modelsLoaded && !isInitialized && (
        <div
          style={{
            color: "#60a5fa",
            padding: "10px",
            background: "rgba(96, 165, 250, 0.1)",
            borderRadius: "8px",
            fontSize: "12px",
            marginTop: 10
          }}
        >
          📹 Inicializando cámara...
        </div>
      )}
    </div>
  )
}

export default CameraFeed
