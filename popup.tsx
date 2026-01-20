import React, { useState } from 'react';
import CameraFeed from './src/components/CameraFeed';
import type { DetectionData } from './src/components/CameraFeed';
const Popup = () => {
  const [data, setData] = useState<DetectionData | null>(null);

  const handleDetection = (detectedData: DetectionData) => {
    setData(detectedData);
    const emotion = Object.keys(detectedData.expressions).reduce((a, b) => detectedData.expressions[a] > detectedData.expressions[b] ? a : b);

    // ENVIAR DATOS AL BACKGROUND SCRIPT
    chrome.runtime.sendMessage({
        type: "UPDATE_FOCUS_DATA",
        data: {
            ...detectedData,
            emotion: emotion,
        }
    });
  };

  const emotion = data ? Object.keys(data.expressions).reduce((a, b) => data.expressions[a] > data.expressions[b] ? a : b) : 'N/A';
  const gazeX = data ? data.gazeX.toFixed(0) : 'N/A';
  const gazeY = data ? data.gazeY.toFixed(0) : 'N/A';


  return (
    <div style={{ width: '400px', padding: '20px', background: '#0e0e1e', color: 'white', fontFamily: 'sans-serif' }}>
      <h1>SYNAPSE UI Dashboard</h1>
      <p>Estado Emocional: **{emotion}**</p>
      <p>Posición Mirada (X, Y): **{gazeX}, {gazeY}**</p>
      
      {/* Ocultamos el feed por ahora para centrarnos en los datos */}
      <CameraFeed onDetection={handleDetection} />

      {data && (
        <div style={{ marginTop: '15px' }}>
          <h3>Métricas de Emoción:</h3>
          <ul>
            <li>Felicidad: {(data.expressions.happy * 100).toFixed(1)}%</li>
            <li>Estrés (Enojo): {(data.expressions.angry * 100).toFixed(1)}%</li>
            <li>Neutral: {(data.expressions.neutral * 100).toFixed(1)}%</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default Popup;
