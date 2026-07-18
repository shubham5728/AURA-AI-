# AURA — Roadmap

This document tracks what AURA is being built toward, and where it currently stands.

**Current stage:** Concept and design. Implementation has not started yet.

---

## Phase 1 — Hackathon MVP

The core foundation, targeted at the 36-hour TetraTHON 2026 build. The goal is a working end-to-end demo: a user can sign up, upload a report, talk to the AI, and see a dashboard driven by their own data.

| Status | Feature | What it means |
|:---:|---|---|
| ⬜ | **User Registration & Profile** | Firebase auth, plus a profile form that collects the baseline health data the Twin needs to start. |
| ⬜ | **AI Health Chatbot** | Context-aware conversation that can read the user's stored profile and history before answering. |
| ⬜ | **Medical Report OCR Parser** | Upload a blood report or prescription, extract the values, and explain them in plain language. |
| ⬜ | **Personalized Dashboard** | One screen showing health score, sleep, activity, water intake, and calories. |
| ⬜ | **Lifestyle Simulator (v1)** | Answer basic "what-if" questions using evidence-backed models. |
| ⬜ | **Baseline Health Risk Score** | A first risk score computed from profile and report data. |

### Suggested build order

The features depend on each other, so this order avoids getting blocked:

1. **Auth + profile** — nothing else works without a user and their data.
2. **Database schema** — decide how health data is stored before writing features against it.
3. **Dashboard (static)** — render the profile data that already exists. Gives a visible demo early.
4. **OCR parser** — adds real medical data to the Twin.
5. **Chatbot** — now has actual context to reason over.
6. **Risk score + simulator** — built on top of everything above.

---

## Phase 2 — Future Scope

Post-hackathon work aimed at turning the MVP into a real product.

| Status | Feature | What it means |
|:---:|---|---|
| ⬜ | **Wearable Device Integration** | Pull live telemetry from smartwatches and fitness bands. |
| ⬜ | **Hospital EHR API Sync** | Import records directly from hospital systems instead of manual upload. |
| ⬜ | **Insurance Platform Integration** | Share verified health data with insurers, with user consent. |
| ⬜ | **Dedicated Doctor Dashboard** | A clinician-facing view of a patient's Twin. |
| ⬜ | **Continuous Anomaly Monitoring** | Detect unusual patterns in health data automatically. |
| ⬜ | **Real-time Emergency Alerts** | Notify the user or a contact when readings cross critical thresholds. |
| ⬜ | **Advanced Predictive Analytics** | Longer-horizon disease-risk forecasting from accumulated history. |

---

## Open Questions

Decisions still to be made before or during the build:

- **LLM provider** — Gemini API or OpenAI API? Affects cost, latency, and how agents are structured.
- **OCR approach** — Google Vision API (more accurate, paid) or Tesseract (free, self-hosted)?
- **Frontend for the demo** — Ship the React web dashboard first, or the Flutter mobile app? Building both in 36 hours is unlikely.
- **Health score formula** — Which specific metrics feed the score, and how are they weighted?
- **Data privacy model** — How is health data encrypted at rest, and what exactly is sent to a third-party LLM?

---

## Status Legend

| Symbol | Meaning |
|:---:|---|
| ⬜ | Not started |
| 🟨 | In progress |
| ✅ | Done |

---

*Back to [README](README.md)*
