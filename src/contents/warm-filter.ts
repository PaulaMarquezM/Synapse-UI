import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const OVERLAY_ID = "synapse-warm-filter"

const createOverlay = () => {
  if (document.getElementById(OVERLAY_ID)) return
  const overlay = document.createElement("div")
  overlay.id = OVERLAY_ID
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100vw",
    "height:100vh",
    "pointer-events:none",
    "z-index:2147483647",
    "background:rgba(255,160,50,0.14)",
    "mix-blend-mode:multiply",
    "transition:opacity 0.8s ease",
    "opacity:0"
  ].join(";")
  document.documentElement.appendChild(overlay)
  requestAnimationFrame(() => {
    overlay.style.opacity = "1"
  })
}

const removeOverlay = () => {
  const el = document.getElementById(OVERLAY_ID)
  if (!el) return
  el.style.opacity = "0"
  setTimeout(() => el.remove(), 800)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "WARM_FILTER") {
    if (msg.enabled) {
      createOverlay()
    } else {
      removeOverlay()
    }
  }
})
