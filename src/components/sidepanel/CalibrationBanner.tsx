import React from "react"
import type { CalibrationState } from "~lib/calibration"

type CalibrationBannerProps = {
  calState: CalibrationState
  onStartCalibration: () => void
}

const CalibrationBanner: React.FC<CalibrationBannerProps> = ({ calState, onStartCalibration }) => {
  if (!calState.isCalibrating) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={onStartCalibration}
          className="glass-hover"
          style={{
            fontSize: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(96, 165, 250, 0.3)",
            background: "rgba(96, 165, 250, 0.1)",
            color: "#60a5fa",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Recalibrar
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.25)",
        boxShadow: "0 4px 12px rgba(59, 130, 246, 0.1)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "white", marginBottom: 4 }}>Calibrando...</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {calState.message || `${calState.secondsRemaining}s • ${calState.samples}/${calState.targetSamples} muestras`}
          </div>
        </div>
        <button
          onClick={onStartCalibration}
          style={{
            fontSize: 20,
            padding: "6px",
            borderRadius: 8,
            border: "none",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            cursor: "pointer"
          }}
        >
          Reiniciar
        </button>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round(calState.progress * 100)}%`,
            background: "linear-gradient(90deg, #60a5fa, #8b5cf6)",
            transition: "width 0.3s ease",
            boxShadow: "0 0 10px rgba(96, 165, 250, 0.5)"
          }}
        />
      </div>
    </div>
  )
}

export default CalibrationBanner
