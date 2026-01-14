import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';

// Definimos la interfaz para los datos que enviaremos
export interface DetectionData {
  expressions: faceapi.FaceExpressions;
  gazeX: number;
  gazeY: number;
  headPose: {
    yaw: number;   // Rotación izq/der
    pitch: number; // Arriba/abajo
    roll: number;  // Inclinación
  };
  blinkRate: number; // Frecuencia de parpadeo
}

interface CameraFeedProps {
  onDetection: (data: DetectionData) => void;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onDetection }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Estado para simular el seguimiento de mirada (basado en posición de cara)
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 });
  
  // Contador de parpadeos
  const blinkHistory = useRef<number[]>([]);
  const lastEyeState = useRef<boolean>(true); // true = ojos abiertos

  // Cargar modelos de face-api
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        
        console.log('[SYNAPSE] Modelos de IA cargados correctamente');
        setModelsLoaded(true);
      } catch (error) {
        console.error('[SYNAPSE] Error al cargar modelos:', error);
      }
    };

    loadModels();
  }, []);

  // Iniciar video cuando los modelos estén cargados
  useEffect(() => {
    if (modelsLoaded && !isInitialized) {
      startVideo();
    }
  }, [modelsLoaded, isInitialized]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsInitialized(true);
        console.log('[SYNAPSE] Cámara inicializada');
      }
    } catch (err) {
      console.error('[SYNAPSE] Error al acceder a la cámara:', err);
    }
  };

  // Calcular orientación de cabeza basada en landmarks
  const calculateHeadPose = (landmarks: faceapi.FaceLandmarks68) => {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Calcular centro de la cara
    const noseTip = nose[3];
    const leftEyeCenter = leftEye[0];
    const rightEyeCenter = rightEye[3];
    
    // Yaw (rotación horizontal): basado en la posición de la nariz respecto a los ojos
    const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
    const noseOffset = noseTip.x - (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const yaw = (noseOffset / eyeDistance) * 45; // Normalizado a grados aproximados
    
    // Pitch (arriba/abajo): basado en altura de nariz vs ojos
    const eyeLevel = (leftEyeCenter.y + rightEyeCenter.y) / 2;
    const nosePitch = (noseTip.y - eyeLevel) / 50;
    const pitch = Math.max(-30, Math.min(30, nosePitch * 30));
    
    // Roll (inclinación): basado en ángulo entre ojos
    const eyeAngle = Math.atan2(
      rightEyeCenter.y - leftEyeCenter.y,
      rightEyeCenter.x - leftEyeCenter.x
    );
    const roll = (eyeAngle * 180) / Math.PI;
    
    return { yaw, pitch, roll };
  };

  // Detectar parpadeo basado en la apertura del ojo
  const detectBlink = (landmarks: faceapi.FaceLandmarks68): boolean => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    // Calcular apertura vertical de cada ojo
    const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
    const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
    
    // Calcular ancho horizontal promedio
    const leftEyeWidth = Math.abs(leftEye[3].x - leftEye[0].x);
    const rightEyeWidth = Math.abs(rightEye[3].x - rightEye[0].x);
    
    // Ratio de apertura (Eye Aspect Ratio)
    const leftEAR = leftEyeHeight / leftEyeWidth;
    const rightEAR = rightEyeHeight / rightEyeWidth;
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // Umbral para detectar ojo cerrado
    return avgEAR < 0.15;
  };

  // Estimar posición de mirada basada en la posición de la cara en el frame
  const estimateGaze = (detection: faceapi.WithFaceLandmarks<any>) => {
    const box = detection.detection.box;
    const videoWidth = videoRef.current?.videoWidth || 640;
    const videoHeight = videoRef.current?.videoHeight || 480;
    
    // Calcular centro de la cara en el video
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    
    // Normalizar a coordenadas de pantalla (0 a window width/height)
    // Invertir X porque la cámara es espejo
    const screenX = window.screen.width * (1 - faceCenterX / videoWidth);
    const screenY = window.screen.height * (faceCenterY / videoHeight);
    
    setGazeData({ x: screenX, y: screenY });
    
    return { x: screenX, y: screenY };
  };

  // Calcular frecuencia de parpadeo
  const updateBlinkRate = () => {
    const now = Date.now();
    blinkHistory.current = blinkHistory.current.filter(time => now - time < 60000); // Últimos 60s
    return blinkHistory.current.length; // Parpadeos por minuto
  };

  // Loop principal de detección
  const handleVideoOnPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const detect = async () => {
      if (!videoRef.current || !modelsLoaded) return;

      try {
        const detections = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections) {
          // Calcular orientación de cabeza
          const headPose = calculateHeadPose(detections.landmarks);
          
          // Detectar parpadeo
          const isBlinking = detectBlink(detections.landmarks);
          if (isBlinking && lastEyeState.current) {
            blinkHistory.current.push(Date.now());
          }
          lastEyeState.current = !isBlinking;
          
          const blinkRate = updateBlinkRate();
          
          // Estimar mirada
          const gaze = estimateGaze(detections);

          // Preparar datos combinados
          const combinedData: DetectionData = {
            expressions: detections.expressions,
            gazeX: gaze.x,
            gazeY: gaze.y,
            headPose: headPose,
            blinkRate: blinkRate
          };

          // Enviar al componente padre
          onDetection(combinedData);
        }
      } catch (error) {
        console.error('[SYNAPSE] Error en detección:', error);
      }

      // Continuar el loop
      setTimeout(detect, 150); // Actualizar cada 150ms
    };

    detect();
  };

  return (
    <div style={{ position: 'relative' }}>
      <video 
        ref={videoRef} 
        onPlay={handleVideoOnPlay} 
        style={{ display: 'none' }} 
        autoPlay 
        muted 
        playsInline 
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {!modelsLoaded && (
        <div style={{ 
          color: '#fbbf24', 
          padding: '10px',
          background: 'rgba(251, 191, 36, 0.1)',
          borderRadius: '8px',
          fontSize: '12px'
        }}>
          ⏳ Cargando modelos de IA...
        </div>
      )}
      
      {modelsLoaded && !isInitialized && (
        <div style={{ 
          color: '#60a5fa', 
          padding: '10px',
          background: 'rgba(96, 165, 250, 0.1)',
          borderRadius: '8px',
          fontSize: '12px'
        }}>
          📹 Inicializando cámara...
        </div>
      )}
    </div>
  );
};

export default CameraFeed;