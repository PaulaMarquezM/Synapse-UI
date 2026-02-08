// src/components/CameraFeed.tsx
import React, { useEffect, useRef, useState } from "react"
import type * as FaceApi from "@vladmandic/face-api"
import { installModelFetchPatch } from "~lib/installModelFetchPatch"
import { createFaceStabilizers, normalizeExpressions, type ExpressionMap } from "~lib/vision/faceStabilizers"
import { loadPhoneDetector, detectPhone } from "~lib/vision/phoneDetector"

// Datos que se envían al Dashboard
export interface DetectionQuality {
  reliable: boolean
  score: number
  faceScore: number
  areaRatio: number
  centeredness: number
}

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
  quality?: DetectionQuality
  phoneInFrame?: boolean
}

interface CameraFeedProps {
  onDetection: (data: DetectionData) => void

  // NUEVO: preview para IHC (ver cámara + overlay)
  preview?: boolean
  previewWidth?: number
  previewHeight?: number
}

const DETECTION_INTERVAL_MS = 200
const PHONE_DETECTION_INTERVAL_MS = 2000
const TINY_INPUT_SIZE = 320
const MIN_FACE_SCORE = 0.45
const MIN_FACE_AREA = 0.03
const MAX_FACE_AREA = 0.6
const IDEAL_FACE_AREA = 0.12

const RESET_STABILIZERS_AFTER_MS = 2000

const CameraFeed: React.FC<CameraFeedProps> = ({
  onDetection,
  preview = false,
  previewWidth = 260,
  previewHeight = 195
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Módulo face-api
  const faceapiRef = useRef<typeof import("@vladmandic/face-api") | null>(null)
  const tinyOptionsRef = useRef<FaceApi.TinyFaceDetectorOptions | null>(null)

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stabilizersRef = useRef(createFaceStabilizers())
  const lastGoodDetectionAtRef = useRef(0)

  // Control loop
  const isDetectingRef = useRef(false)
  const isMountedRef = useRef(true)

  // Phone detection state (updated by separate COCO-SSD loop)
  const phoneInFrameRef = useRef(false)
  const phoneLoopRunningRef = useRef(false)

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

        console.log("[SYNAPSE] Importando face-api (vladmandic)...")
        const faceapi = await import("@vladmandic/face-api")
        faceapiRef.current = faceapi
        console.log("[SYNAPSE] face-api importado ✅")

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

        // Cargar COCO-SSD en paralelo (no bloquea face detection)
        loadPhoneDetector().then((ok) => {
          if (ok) console.log("✅ [SYNAPSE] COCO-SSD listo para detección de celular")
        })
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
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
        streamRef.current = null
      }
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user"
        }
      })
      streamRef.current = stream

      if (!videoRef.current) {
        for (const track of stream.getTracks()) track.stop()
        streamRef.current = null
        return
      }
      videoRef.current.srcObject = stream

      try {
        await videoRef.current.play()
      } catch (e) {
        console.warn("[SYNAPSE] play() warning:", e)
      }

      setIsInitialized(true)
      console.log("[SYNAPSE] Cámara inicializada ✅")
    } catch (err: unknown) {
      console.error("[SYNAPSE] Error al acceder a la cámara:", err)
      const errorName = err instanceof Error ? err.name : ""
      if (errorName === "NotAllowedError") {
        setCameraError("Permiso de cámara bloqueado o descartado. Habilítalo y pulsa Reintentar.")
      } else if (errorName === "NotFoundError") {
        setCameraError("No se detectó cámara en este dispositivo.")
      } else if (errorName === "NotReadableError") {
        setCameraError("La cámara está en uso por otra app o pestaña.")
      } else {
        setCameraError("No se pudo iniciar la cámara. Intenta nuevamente.")
      }
      setIsInitialized(false)
    }
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      isDetectingRef.current = false
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
        streamRef.current = null
      }
    }
  }, [])

  
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  const resetStabilizers = () => {
    stabilizersRef.current.reset()
  }

  const assessDetectionQuality = (
    detections: FaceApi.WithFaceLandmarks<any> & FaceApi.WithFaceExpressions<any>,
    vw: number,
    vh: number
  ): DetectionQuality => {
    const score = detections.detection.score ?? 1
    const b = detections.detection.box
    const areaRatio = (b.width * b.height) / Math.max(1, vw * vh)

    const centerX = clamp((b.x + b.width / 2) / Math.max(1, vw), 0, 1)
    const centerY = clamp((b.y + b.height / 2) / Math.max(1, vh), 0, 1)
    const centeredness = 1 - Math.min(1, Math.hypot(centerX - 0.5, centerY - 0.5) / 0.71)

    const scoreQuality = clamp(
      (score - MIN_FACE_SCORE) / Math.max(0.001, 1 - MIN_FACE_SCORE),
      0,
      1
    )
    const areaDistance = Math.abs(areaRatio - IDEAL_FACE_AREA) / Math.max(0.001, IDEAL_FACE_AREA)
    const areaQuality = clamp(1 - areaDistance, 0, 1)
    const qualityScore = clamp(scoreQuality * 0.5 + areaQuality * 0.3 + centeredness * 0.2, 0, 1)

    return {
      reliable: score >= MIN_FACE_SCORE && areaRatio >= MIN_FACE_AREA && areaRatio <= MAX_FACE_AREA,
      score: qualityScore,
      faceScore: score,
      areaRatio,
      centeredness
    }
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

        if (detections) {
          const quality = assessDetectionQuality(detections, vw, vh)
          if (!quality.reliable) {
            if (preview && canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d")
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            }

            if (Date.now() - lastGoodDetectionAtRef.current > RESET_STABILIZERS_AFTER_MS) {
              resetStabilizers()
            }
            setTimeout(tick, DETECTION_INTERVAL_MS)
            return
          }

          lastGoodDetectionAtRef.current = Date.now()

          const stabilizers = stabilizersRef.current
          const expressions = stabilizers.smoothExpressions(detections.expressions)
          const headPose = stabilizers.smoothPose(calculateHeadPose(detections.landmarks))
          const gaze = stabilizers.smoothGaze(estimateGaze(detections))

          // overlay visual (si preview)
          if (preview) drawOverlay(detections, expressions)

          stabilizers.updateBlinkState(detections.landmarks)
          const blinkRate = stabilizers.getBlinkRate()

          const combinedData: DetectionData = {
            expressions,
            gazeX: gaze.x,
            gazeY: gaze.y,
            headPose,
            blinkRate,
            quality,
            phoneInFrame: phoneInFrameRef.current || undefined
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

    // Loop paralelo de COCO-SSD para detección de celular (~2s)
    if (!phoneLoopRunningRef.current) {
      phoneLoopRunningRef.current = true
      const phoneTick = async () => {
        if (!isMountedRef.current) {
          phoneLoopRunningRef.current = false
          return
        }
        const vid = videoRef.current
        if (vid && vid.readyState >= 2) {
          const result = await detectPhone(vid)
          phoneInFrameRef.current = result.detected
        }
        setTimeout(phoneTick, PHONE_DETECTION_INTERVAL_MS)
      }
      void phoneTick()
    }
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

      {cameraError && (
        <div
          style={{
            color: "#fca5a5",
            padding: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: "8px",
            fontSize: "12px",
            marginTop: 10,
            border: "1px solid rgba(239, 68, 68, 0.25)"
          }}
        >
          <div style={{ marginBottom: 8 }}>{cameraError}</div>
          <button
            onClick={() => void startVideo()}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#fecaca",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600
            }}
          >
            Reintentar cámara
          </button>
        </div>
      )}
    </div>
  )
}

export default CameraFeed
