import React from "react"

type Nudge = {
  id: string
  type: "info" | "warn" | "danger"
  text: string
}

type NudgeBannerProps = {
  nudge: Nudge | null
}

const NudgeBanner: React.FC<NudgeBannerProps> = ({ nudge }) => {
  if (!nudge) return null

  const background =
    nudge.type === "danger"
      ? "rgba(239, 68, 68, 0.12)"
      : nudge.type === "warn"
        ? "rgba(251, 191, 36, 0.12)"
        : "rgba(96, 165, 250, 0.12)"

  const border =
    nudge.type === "danger"
      ? "1px solid rgba(239, 68, 68, 0.35)"
      : nudge.type === "warn"
        ? "1px solid rgba(251, 191, 36, 0.35)"
        : "1px solid rgba(96, 165, 250, 0.35)"

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background,
        border,
        color: "white",
        fontSize: 12
      }}
    >
      {nudge.text}
    </div>
  )
}

export default NudgeBanner
