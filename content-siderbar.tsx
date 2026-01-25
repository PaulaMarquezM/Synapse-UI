/**
 * SYNAPSE UI - Sidebar Content Script
 * Inyecta el sidebar persistente en todas las páginas web
 */

import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import Sidebar from "~components/Sidebar"
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Esto hace que Plasmo inyecte el componente
const SidebarOverlay = () => {
  return <Sidebar />
}

export default SidebarOverlay