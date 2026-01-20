import React, { useState, useEffect } from 'react';
import CameraFeed from '~components/CameraFeed';
import Dashboard from '~components/Dashboard';
import type { DetectionData } from '~components/CameraFeed';
import "./popup.css";

const Popup = () => {
  const [data, setData] = useState<DetectionData | null>(null);
  const [focusScore, setFocusScore] = useState(50);
  const [stressLevel, setStressLevel] = useState(20);
  const [alertLevel, setAlertLevel] = useState(80);

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData);
    
    // Calcular métricas
    const newFocusScore = calculateFocusScore(detectedData);
    const newStressLevel = calculateStressLevel(detectedData);
    const newAlertLevel = calculateAlertLevel(detectedData);

    setFocusScore(newFocusScore);
    setStressLevel(newStressLevel);
    setAlertLevel(newAlertLevel);

    // Emoción dominante
    const emotion = Object.keys(detectedData.expressions).reduce((a, b) => 
      detectedData.expressions[a] > detectedData.expressions[b] ? a : b
    );

    // ENVIAR DATOS AL BACKGROUND SCRIPT
    chrome.runtime.sendMessage({
      type: "UPDATE_FOCUS_DATA",
      data: {
        ...detectedData,
        emotion: emotion,
        focusScore: newFocusScore,
        stressLevel: newStressLevel,
        alertLevel: newAlertLevel
      }
    });
  };

  // Función para calcular Focus Score mejorada
  const calculateFocusScore = (data: DetectionData): number => {
    const { expressions, gazeX, gazeY, headPose, blinkRate } = data;
    
    // Factor emocional: neutral y feliz aumentan el foco
    const emotionalWeight = (expressions.neutral + expressions.happy) * 0.5;
    
    // Factor de orientación de cabeza (mirando al frente = mejor foco)
    const headAlignment = Math.max(0, 1 - (Math.abs(headPose.yaw) + Math.abs(headPose.pitch)) / 60);
    
    // Factor de parpadeo (15-20 parpadeos/min es normal, muy alto o bajo = estrés/fatiga)
    const blinkFactor = blinkRate > 10 && blinkRate < 25 ? 1 : 0.7;
    
    // Verificar si la mirada está en un rango razonable
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    const isGazeReasonable = 
      gazeX > screenWidth * 0.2 && gazeX < screenWidth * 0.8 &&
      gazeY > screenHeight * 0.1 && gazeY < screenHeight * 0.9;

    let score = 0;
    
    if (isGazeReasonable && expressions.neutral > 0.4) {
      score = 70 + (emotionalWeight * 30);
    } else if (expressions.angry > 0.2 || expressions.sad > 0.2) {
      score = 10 + (emotionalWeight * 20);
    } else {
      score = 40 + (emotionalWeight * 20);
    }
    
    // Aplicar factores adicionales
    score = score * headAlignment * blinkFactor;

    return Math.round(Math.min(100, Math.max(0, score)));
  };

  // Función para calcular Nivel de Estrés
  const calculateStressLevel = (data: DetectionData): number => {
    const { expressions } = data;
    
    // Emociones negativas aumentan el estrés
    const negativeEmotions = expressions.angry + expressions.sad + expressions.surprised;
    const positiveEmotions = expressions.happy + expressions.neutral;
    
    const stress = (negativeEmotions - positiveEmotions * 0.5);
    const level = (stress + 1) * 50;

    return Math.round(Math.min(100, Math.max(0, level)));
  };

  // Función para calcular Nivel de Alerta
  const calculateAlertLevel = (data: DetectionData): number => {
    const { expressions } = data;
    
    // Si hay mucha tristeza o neutralidad extrema, baja la alerta (fatiga)
    if (expressions.sad > 0.3 || expressions.neutral > 0.8) {
      return Math.round(30 + (expressions.happy * 40));
    }
    
    // Alto nivel de alerta si hay emociones activas
    return Math.round(60 + (expressions.surprised + expressions.happy) * 20);
  };

  return (
    <div
      style={{
        width: 360,
        minHeight: 520,
        background: "#0b1220",
        padding: 12,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center"
      }}
    >
      {/* Feed de cámara invisible pero activo */}
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

      {/* Scroll interno del contenido */}
      <div style={{ width: "100%", overflowY: "auto", paddingRight: 6 }}>
        <Dashboard
          data={data}
          focusScore={focusScore}
          stressLevel={stressLevel}
          alertLevel={alertLevel}
        />
      </div>
    </div>
  );
};

export default Popup;