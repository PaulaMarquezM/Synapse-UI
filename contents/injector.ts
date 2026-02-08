// contents/injector.ts

import cssText from "data-text:./style.css";
import type { PlasmoCSConfig } from "plasmo";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import Aura from "~components/Aura";

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
};

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
};

// Variable para controlar el estado del aura
let currentAuraType: 'calm' | 'focus' | 'alert' | null = null;
let auraRoot: Root | null = null;
let auraContainer: HTMLDivElement | null = null;

// Función para mostrar/ocultar el aura
const toggleAura = (type: 'calm' | 'focus' | 'alert' | null) => {
  if (type === null) {
    // Remover el aura
    if (auraContainer) {
      auraRoot?.unmount();
      auraContainer.remove();
      auraContainer = null;
      auraRoot = null;
    }
    return;
  }

  // Crear o actualizar el aura
  if (!auraContainer) {
    auraContainer = document.createElement('div');
    auraContainer.id = 'synapse-aura-root';
    document.body.appendChild(auraContainer);
    auraRoot = createRoot(auraContainer);
  }

  currentAuraType = type;
  auraRoot.render(React.createElement(Aura, { isActive: true, type }));
};

// Escuchar mensajes del background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "STATE_UPDATED" && request.state) {
    const { focusScore, stressLevel, alertLevel } = request.state;
    console.log(`[SYNAPSE UI] Focus: ${focusScore}, Estrés: ${stressLevel}, Alerta: ${alertLevel}`);
    
    const body = document.body;
    
    // Remover todas las clases primero
    body.classList.remove('synapse-stressed', 'synapse-focused', 'synapse-neutral', 'synapse-fatigued');

    // Determinar estado y aplicar efectos
    if (stressLevel >= 60) {
      // Alto estrés: Modo calmante
      body.classList.add('synapse-stressed');
      toggleAura('calm');
    } else if (focusScore >= 75) {
      // Alto foco: Modo minimalista
      body.classList.add('synapse-focused');
      toggleAura('focus');
    } else if (alertLevel < 30) {
      // Baja alerta: Fatiga detectada
      body.classList.add('synapse-fatigued');
      toggleAura('alert');
    } else {
      // Estado normal
      body.classList.add('synapse-neutral');
      toggleAura(null);
    }
  }
});

// Componente Plasmo (necesario para que funcione)
const PlasmoOverlay = () => {
  return null;
};

export default PlasmoOverlay;
