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
let blueLightFilter: HTMLDivElement | null = null;

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

// Filtro anti-luz azul (overlay amarillo cálido)
const toggleBlueLightFilter = (active: boolean) => {
  if (active) {
    if (!blueLightFilter) {
      blueLightFilter = document.createElement('div');
      blueLightFilter.id = 'synapse-bluelight-filter';
      blueLightFilter.style.opacity = '0';
      document.documentElement.appendChild(blueLightFilter);
      // Forzar reflow para que la transición CSS funcione
      blueLightFilter.offsetHeight;
      blueLightFilter.style.opacity = '1';
      console.log('[SYNAPSE UI] Filtro anti-luz azul activado');
    }
  } else {
    if (blueLightFilter) {
      blueLightFilter.style.opacity = '0';
      const el = blueLightFilter;
      blueLightFilter = null;
      setTimeout(() => el.remove(), 1500); // esperar transición CSS
      console.log('[SYNAPSE UI] Filtro anti-luz azul desactivado');
    }
  }
};

// Escuchar mensajes del background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "STATE_UPDATED" && request.state) {
    const { focusScore, stressLevel, fatigueLevel, distractionLevel } = request.state;
    console.log(`[SYNAPSE UI] Focus: ${focusScore}, Estrés: ${stressLevel}, Fatiga: ${fatigueLevel}, Distracción: ${distractionLevel}`);

    const body = document.body;

    // Remover todas las clases primero
    body.classList.remove('synapse-stressed', 'synapse-focused', 'synapse-neutral', 'synapse-fatigued');

    // Determinar estado y aplicar efectos
    if (stressLevel >= 60) {
      body.classList.add('synapse-stressed');
      toggleAura('calm');
    } else if (focusScore >= 75) {
      body.classList.add('synapse-focused');
      toggleAura('focus');
    } else if (fatigueLevel >= 70) {
      body.classList.add('synapse-fatigued');
      toggleAura('alert');
    } else {
      body.classList.add('synapse-neutral');
      toggleAura(null);
    }

    // Filtro anti-luz azul cuando fatiga >= 70
    toggleBlueLightFilter(fatigueLevel >= 70);
  }
});

// Componente Plasmo (necesario para que funcione)
const PlasmoOverlay = () => {
  return null;
};

export default PlasmoOverlay;
