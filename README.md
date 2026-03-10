<div align="center">

# 🧠 SYNAPSE UI

### Real-Time Cognitive State Monitor — Chrome Extension

[![Plasmo](https://img.shields.io/badge/Built%20with-Plasmo%20MV3-7C3AED?style=flat-square)](https://plasmo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud%20DB-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TensorFlow](https://img.shields.io/badge/TensorFlow.js-Face%20API-FF6F00?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)

*A browser extension that uses your webcam and computer vision to infer cognitive states — focus, stress, and fatigue — in real time. Built as a cross-disciplinary project combining Human-Computer Interaction (HCI) and Cloud Databases.*

</div>

---

## What It Does

Synapse UI runs silently in your browser's side panel, continuously analyzing your facial expressions, gaze direction, head pose, and blink rate to determine how you're doing cognitively. Are you focused? Drifting? Stressed? Fatigued?

No data leaves your device until you choose to save a session — and even then, only aggregated metrics are stored in the cloud.

**Key capabilities:**

- Detects focus, stress, and fatigue using only your webcam
- Distinguishes whether you're looking at the screen, away, or at your phone
- Gives real-time nudges, motivational messages, and optional sound alerts
- Logs sessions to Supabase and renders a personal productivity dashboard
- Projects a subtle visual "Aura" overlay onto web pages as ambient feedback

---

## Demo

> *Coming soon — screenshots and GIF walkthrough*

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | [Plasmo](https://plasmo.com) (MV3) | Chrome extension scaffolding |
| UI | React 18 + TypeScript | Component-based side panel & popup |
| Styling | Tailwind CSS + Framer Motion | Responsive UI + smooth animations |
| Vision | face-api.js + TensorFlow.js | Facial landmark & expression detection |
| Object Detection | COCO-SSD | Phone/object detection via webcam |
| Database | Supabase (PostgreSQL) | Cloud session storage & auth |
| Charts | Recharts | Historical productivity trends |
| Utilities | date-fns, lucide-react | Date handling & icons |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
│                                                         │
│  ┌─────────────┐    ┌──────────────────────────────┐   │
│  │  background │◄──►│  Side Panel (sidepanel.tsx)  │   │
│  │  service    │    │                              │   │
│  │  worker     │    │  ┌────────────┐              │   │
│  └─────────────┘    │  │ CameraFeed │              │   │
│                     │  │ face-api.js│              │   │
│  ┌─────────────┐    │  └─────┬──────┘              │   │
│  │  Content    │    │        │ DetectionData        │   │
│  │  Script     │    │  ┌─────▼──────────────────┐  │   │
│  │  (Aura FX)  │    │  │  Cognitive Engine       │  │   │
│  └─────────────┘    │  │  - Calibration          │  │   │
│                     │  │  - Smoothing             │  │   │
│                     │  │  - Thresholds            │  │   │
│                     │  └─────┬──────────────────┬─┘  │   │
│                     │        │                  │    │   │
│                     │  ┌─────▼──────┐  ┌───────▼──┐ │   │
│                     │  │  Session   │  │  Nudges  │ │   │
│                     │  │  Manager   │  │  + Audio │ │   │
│                     │  └─────┬──────┘  └──────────┘ │   │
│                     └────────┼─────────────────────-─┘   │
└──────────────────────────────┼──────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Supabase Cloud DB  │
                    │   (work_sessions)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Historical Dashboard│
                    │  - Focus trends      │
                    │  - Session table     │
                    │  - Stats & filters   │
                    └─────────────────────┘
```

---

## Project Structure

```
synapse-ui/
├── background.ts              # Service worker — global state coordination
├── popup.tsx                  # Extension popup entry point
├── options.tsx                # Settings page
├── content-siderbar.tsx       # Content script: sidebar injector
├── src/
│   ├── sidepanel.tsx          # Main side panel UI
│   ├── components/
│   │   ├── CameraFeed.tsx     # Webcam + face detection loop
│   │   ├── Dashboard.tsx      # In-panel dashboard
│   │   ├── SessionControl.tsx # Start/stop session controls
│   │   ├── SessionsDashboard.tsx # Historical sessions view
│   │   ├── SessionSummaryModal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Aura.tsx           # Visual ambient feedback overlay
│   │   └── AuthForm.tsx       # Supabase auth UI
│   ├── lib/
│   │   ├── cognitivethresholds.ts   # Core cognitive inference logic
│   │   ├── metricsSmoothing.ts      # Signal smoothing algorithms
│   │   ├── calibration.ts           # Baseline calibration system
│   │   ├── sessionManager.ts        # Session lifecycle & cloud sync
│   │   ├── supabase.ts              # DB client & queries
│   │   └── dashboardUtils.ts        # Chart data processing
│   ├── hooks/                 # Custom React hooks
│   ├── features/              # Feature-based modules
│   └── contents/
│       └── injector.ts        # Aura visual effects injector
└── assets/
    └── models/                # face-api.js model weights (local)
```

---

## How Cognitive State Is Inferred

The cognitive engine processes raw facial signals through several layers:

### 1. Signal Collection (`CameraFeed.tsx`)
Captures per-frame data using face-api.js:
- **Expressions**: happiness, surprise, anger, fear, disgust, sadness, neutral
- **Gaze direction**: estimated from iris/landmark positions
- **Head pose**: yaw, pitch, roll from 3D landmark geometry
- **Blink rate**: per-eye openness tracking

### 2. Stabilization (`metricsSmoothing.ts`, `faceStabilizers.ts`)
Raw detections are noisy — stabilizers apply:
- Exponential smoothing for expressions and gaze
- Adaptive blink detection (accounts for natural variation)
- Quality filtering (low-confidence frames are discarded)

### 3. Calibration (`calibration.ts`)
On session start, a 10-second baseline is recorded to normalize metrics to the user's natural resting state.

### 4. Cognitive Thresholds (`cognitivethresholds.ts`)
Inference rules produce a composite score (0–100) for each metric:

| State | Key Signals |
|-------|------------|
| **Focus** | Stable gaze on screen, neutral expression, low blink rate |
| **Stress** | Raised brows, tense expression, irregular blink, micro-expressions |
| **Fatigue** | High blink rate, drooping eyelids, reduced head stability |

Special attention states detected:
- `ON_SCREEN` — looking at monitor
- `OFF_SCREEN` — head turned away
- `PHONE` — phone object detected via COCO-SSD
- `NO_FACE` — no face in frame

### 5. Alerts & Nudges
Threshold crossings trigger contextual interventions:
- High stress → breathing reminder
- High fatigue → break suggestion
- Eyes closed → wake nudge
- Prolonged off-screen → refocus message
- Optional audio cues for critical alerts

---

## Dashboard Features

Accessible via `sidepanel.html?view=dashboard` or the in-panel navigation.

- **Focus Trend Chart** — time-series chart of focus score across sessions (Recharts)
- **Session Table** — all recorded sessions with date, duration, and average metrics
- **Session Detail** — drill into a single session for granular data
- **Range Filter** — filter by date range
- **Summary Stats** — avg focus, total sessions, total focused time

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Chrome / Chromium browser
- A Supabase project (free tier works)

### Installation

```bash
# Clone the repo
git clone https://github.com/PaulaMarquezM/SYNAPSE-UI.git
cd SYNAPSE-UI/synapse-ui

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Add your Supabase URL and anon key
```

### Environment Variables

```env
PLASMO_PUBLIC_SUPABASE_URL=your_supabase_project_url
PLASMO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

Run this in your Supabase SQL editor:

```sql
create table work_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  started_at timestamptz not null,
  ended_at timestamptz,
  avg_focus float,
  avg_stress float,
  avg_fatigue float,
  duration_seconds int,
  created_at timestamptz default now()
);
```

### Run in Development

```bash
pnpm dev
```

Open `chrome://extensions`, enable Developer Mode, and load the `build/chrome-mv3-dev` folder.

### Build for Production

```bash
pnpm build
pnpm package  # creates a .zip ready for the Chrome Web Store
```

---

## Academic Context

This project was developed as a cross-disciplinary final project for two courses:

| Course | Contribution |
|--------|-------------|
| **Human-Computer Interaction (HCI)** | Real-time biometric feedback, UX design of cognitive nudges, attention-aware interface adaptation |
| **Cloud Databases** | Supabase integration, session persistence, historical analytics dashboard |

---

## Roadmap

- [ ] Export sessions to CSV
- [ ] Additional charts (stress trends, fatigue over time)
- [ ] Per-user calibration profiles
- [ ] Customizable alert thresholds
- [ ] Performance optimization for detection loop
- [ ] Firefox support (MV2 fallback)
- [ ] Pomodoro timer integration
- [ ] Weekly/monthly summary emails

---

## Author

**Paula Marquez** — [@PaulaMarquezM](https://github.com/PaulaMarquezM)

---

<div align="center">
  <sub>Built with React, TensorFlow.js, and a lot of coffee ☕</sub>
</div>
