import React from "react"
import { RefreshCcw, LogOut, X, BarChart2, Download } from "lucide-react"

type DashboardHeaderProps = {
  email?: string | null
  loading: boolean
  onClose: () => void
  onRefresh: () => void
  onLogout: () => void
  onDownload: () => void
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  email,
  loading,
  onClose,
  onRefresh,
  onLogout,
  onDownload
}) => {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 18px rgba(96,165,250,0.35)"
          }}
        >
          <BarChart2 size={22} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>SYNAPSE UI - Dashboard</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{email}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDownload}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: "rgba(148, 163, 184, 0.12)",
            color: "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
          title="Descargar CSV"
        >
          <Download size={14} />
          Descargar
        </button>

        <button
          onClick={onClose}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: "rgba(148, 163, 184, 0.12)",
            color: "#cbd5e1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
          title="Cerrar"
        >
          <X size={14} />
          Cerrar
        </button>

        <button
          onClick={onRefresh}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(96, 165, 250, 0.35)",
            background: "rgba(96, 165, 250, 0.12)",
            color: "#93c5fd",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <RefreshCcw size={14} />
          {loading ? "Cargando" : "Actualizar"}
        </button>

        <button
          onClick={onLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.12)",
            color: "#fca5a5",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>
    </div>
  )
}

export default DashboardHeader
