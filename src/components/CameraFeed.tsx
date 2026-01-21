// src/components/CameraFeed.tsx
import React, { useEffect, useRef, useState } from "react"
import type * as FaceApi from "face-api.js"
import { installModelFetchPatch } from "~lib/installModelFetchPatch"

// Datos que se envían al Dashboard
export interface DetectionData {
  expressions: FaceApi.FaceExpressions
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

  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Parpadeo
  const blinkHistory = useRef<number[]>([])
  const lastEyeState = useRef<boolean>(true)

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
  const detectBlink = (landmarks: FaceApi.FaceLandmarks68): boolean => {
    const leftEye = landmarks.getLeftEye()
    const rightEye = landmarks.getRightEye()

    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y)
    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y)

    const leftEyeWidth = Math.abs(leftEye[3].x - leftEye[0].x)
    const rightEyeWidth = Math.abs(rightEye[3].x - rightEye[0].x)

    const leftEAR = leftEyeHeight / Math.max(1e-6, leftEyeWidth)
    const rightEAR = rightEyeHeight / Math.max(1e-6, rightEyeWidth)
    const avgEAR = (leftEAR + rightEAR) / 2

    return avgEAR < 0.15
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

    const screenX = window.screen.width * (1 - faceCenterX / videoWidth)
    const screenY = window.screen.height * (faceCenterY / videoHeight)

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
  const drawOverlay = (detections: FaceApi.WithFaceLandmarks<any> & FaceApi.WithFaceExpressions<any>) => {
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
    const exprAny = detections.expressions as any
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
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()

        if (detections) {
          // overlay visual (si preview)
          if (preview) drawOverlay(detections)

          const headPose = calculateHeadPose(detections.landmarks)

          const isBlinking = detectBlink(detections.landmarks)
          if (isBlinking && lastEyeState.current) blinkHistory.current.push(Date.now())
          lastEyeState.current = !isBlinking

          const blinkRate = updateBlinkRate()
          const gaze = estimateGaze(detections)

          const combinedData: DetectionData = {
            expressions: detections.expressions,
            gazeX: gaze.x,
            gazeY: gaze.y,
            headPose,
            blinkRate
          }

          onDetection(combinedData)
        } else {
          // si no hay detección, limpiamos overlay para que sea obvio
          if (preview && canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d")
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          }
        }
      } catch (error) {
        console.error("[SYNAPSE] Error en detección:", error)
      }

      // Menos carga que 150ms. Si quieres más fluido, baja a 150 luego.
      setTimeout(tick, 200)
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
