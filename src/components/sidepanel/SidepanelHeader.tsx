import React from "react"
import { LogOut } from "lucide-react"
import { motion } from "framer-motion"

type SidepanelHeaderProps = {
  email?: string | null
  soundEnabled: boolean
  onToggleSound: () => void
  onOpenDashboard: () => void
  onLogout: () => void
}

const SidepanelHeader: React.FC<SidepanelHeaderProps> = ({
  email,
  soundEnabled,
  onToggleSound,
  onOpenDashboard,
  onLogout
}) => {
  return (
    <div className="sidepanel-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            boxShadow: "0 4px 12px rgba(96, 165, 250, 0.3)"
          }}
        >
          S
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>SYNAPSE UI</p>
          <p
            style={{
              fontSize: 10,
              color: "#94a3b8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {email}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleSound}
          style={{
            padding: 8,
            borderRadius: 8,
            background: soundEnabled ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.12)",
            border: soundEnabled
              ? "1px solid rgba(34, 197, 94, 0.35)"
              : "1px solid rgba(148, 163, 184, 0.35)",
            cursor: "pointer",
            display: "flex"
          }}
          title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
        >
          <span style={{ fontSize: 12, color: soundEnabled ? "#4ade80" : "#cbd5e1", fontWeight: 700 }}>
            SND
          </span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onOpenDashboard}
          style={{
            padding: 8,
            borderRadius: 8,
            background: "rgba(96, 165, 250, 0.12)",
            border: "1px solid rgba(96, 165, 250, 0.35)",
            cursor: "pointer",
            display: "flex"
          }}
          title="Abrir dashboard"
        >
          <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>DB</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onLogout}
          style={{
            padding: 8,
            borderRadius: 8,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            cursor: "pointer",
            display: "flex"
          }}
        >
          <LogOut size={16} color="#ef4444" />
        </motion.button>
      </div>
    </div>
  )
}

export default SidepanelHeader
