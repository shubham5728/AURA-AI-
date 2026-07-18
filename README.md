# AURA

**Adaptive Unified Reasoning Assistant**

> Your AI Digital Twin for Personalized Healthcare

![Status](https://img.shields.io/badge/status-concept%20%2F%20in%20development-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Built for](https://img.shields.io/badge/built%20for-TetraTHON%202026-1f6feb)

---

## About the Project

AURA is an AI health companion that builds a **Digital Twin** of your health — a living, data-driven model of your body that keeps learning about you over time.

Most health apps are stateless. You ask a question, you get an answer, and the app forgets everything. AURA is different. It remembers your medical history, your lab reports, your habits, and your goals, and it uses all of that context every time it answers you.

The goal is to move healthcare from **reactive treatment** to **proactive prevention**.

> **Note:** This project is currently in the design and planning phase. The repository contains the concept, architecture, and pitch material. Code is coming soon.

---

## The Problem

Modern medicine is advanced, but the way people actually experience healthcare is broken:

- **Reactive, not preventive** — The system treats you after you fall sick instead of stopping illness early.
- **Fragmented records** — Your history, prescriptions, and lab reports are scattered across different clinics and hospitals.
- **Complex medical jargon** — Pathology reports are hard to understand without a doctor to explain them.
- **Limited consultation time** — Overloaded doctors get only a few minutes per patient, so full history rarely gets reviewed.
- **Generic advice** — Standard health tips ignore individual differences in metabolism, lifestyle, and genetics.
- **Rising lifestyle diseases** — Diabetes, hypertension, and obesity are growing rapidly worldwide.
- **No continuous intelligence** — There is no personal AI that monitors, learns, and adapts to your health over time.

**What if every person had an AI Digital Twin that understood their health, predicted risks, and gave personalized preventive guidance?**

---

## How AURA Works

AURA continuously pulls together data from many sources, runs it through AI and ML models, and updates your Digital Twin. The Twin then becomes the baseline for every insight you receive.

```mermaid
flowchart TD
    A[User Data Aggregation] --> B[AI Processing & ML Analysis]
    B --> C[Digital Twin Synthesis]
    C --> D[Personalized Insights]
    D --> E[Better Health Decisions]
```

**Data the Twin learns from:**

| | |
|---|---|
| User profile | Wearable telemetry *(optional)* |
| Daily lifestyle habits | Nutrition and diet logs |
| Historical medical data | Exercise routines |
| Pathology / blood reports | Sleep cycles and quality |
| Active prescriptions | Personal health goals |

---

## Core Features

### AI Digital Twin
A continuous virtual representation of your health profile. It acts as the baseline for all predictions and personalized guidance.

### Medical Report Analyzer
Upload a blood report or prescription. AURA uses OCR and AI models to read the tables, extract the values, and explain the medical terms in plain, conversational language.

### Personalized Health Dashboard
One screen for all your real-time metrics:
- Health Score and Sleep Score
- Activity tracking and water intake
- Calories burned and nutritional balance
- **Risk trends** — predictive insights based on your historical data

### Lifestyle Simulation Engine
Ask "what-if" questions and see the predicted outcome. For example, *"What if I walk 8,000 steps daily?"* — AURA estimates the physiological improvements (cardiovascular endurance, weight trends) using evidence-backed medical models.

### Intelligent Medication Assistant
More than a reminder alarm. It provides contextual medicine reminders, automatic drug-interaction checks, and food precautions tied to each prescription.

### AI Health Chatbot
Natural, context-aware conversation that already knows your history:
- *"I feel unusually tired today."*
- *"Explain the lipid profile section of my recent blood report."*
- *"What dietary changes should I focus on this week to lower my cholesterol?"*

---

## Multi-Agent AI Architecture

Instead of one general-purpose model, AURA uses specialized agents. Each one analyzes a different part of your health, and all of them feed into a central reasoning core.

| Agent | Responsibility |
|---|---|
| **Doctor Agent** | Analyzes symptoms and medical history |
| **Nutrition Agent** | Optimizes diet and caloric intake |
| **Fitness Agent** | Recommends exercise and monitors activity |
| **Medication Agent** | Manages prescriptions and drug interactions |
| **Prediction Agent** | Forecasts health trends and risks |
| **Digital Twin Core** | Unified reasoning hub that combines all agent outputs |

---

## System Architecture

```mermaid
flowchart TD
    A[Mobile / Web App - Client UI] --> B[Firebase Authentication & Security]
    B --> C[(PostgreSQL Health Database - Encrypted)]
    C --> D[FastAPI Backend Engine]
    D --> E[Digital Twin Logic Layer]
    E --> F[Multi-Agent AI - LangChain / LLM]
    F --> G[Recommendations & Prediction Output]
    G --> H[User Personalized Dashboard]
```

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Frontend** | Flutter (mobile), React.js (web dashboard) |
| **Backend** | FastAPI, Python |
| **Database & Auth** | PostgreSQL, Firebase Authentication |
| **Artificial Intelligence** | LangChain, Gemini API / OpenAI API, RAG, LLM agents |
| **OCR & Processing** | Google Vision API, Tesseract OCR |
| **Machine Learning** | Scikit-learn, XGBoost |
| **Data Visualization** | Plotly, Chart.js |
| **Deployment & DevOps** | Docker, Firebase Hosting, Render, GitHub |

---

## Roadmap

Development is split into two phases — a hackathon MVP followed by enterprise-scale features.

See **[ROADMAP.md](ROADMAP.md)** for the full plan and current progress.

---

## What Makes AURA Different

- **Beyond chatbots** — Builds a persistent Digital Twin instead of isolated, stateless chat sessions.
- **Multi-agent reasoning** — Specialized agents for nutrition, fitness, and medication improve accuracy.
- **Proactive, not reactive** — Continuous monitoring shifts the focus to prevention.
- **Explainable AI** — Turns complex medical reports into language you actually understand.
- **Startup-ready** — Designed for scalability and real commercial use.

---

## Who Benefits

Patients · Doctors and clinicians · Hospitals and clinics · Health startups · Insurance companies · Government healthcare programs

---

## Getting Started

The backend is running. Frontend is not built yet.

**Requirements:** Python 3.10+

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000/docs** for the interactive API documentation.

### Trying it without Firebase

A Firebase project is not required for local development. While `ENV=development`, the API accepts a dev token so endpoints can be exercised immediately:

```bash
curl -X PUT http://127.0.0.1:8000/api/profile \
  -H "Authorization: Bearer dev you@example.com" \
  -H "Content-Type: application/json" \
  -d '{"dob":"1998-04-12","sex":"male","height_cm":175,"weight_kg":78,
       "conditions":["prediabetes"],"allergies":[],"goals":["lower HbA1c"]}'
```

> ⚠️ Dev tokens are **not verified** — any caller can claim any identity. They are refused whenever `ENV=production`, and the server logs a warning at startup while they are active.

By default the app uses a local SQLite file, so no database setup is needed. To run PostgreSQL instead:

```bash
docker compose up -d
# then set DATABASE_URL=postgresql://aura:aura@localhost:5432/aura in .env
```

### Available endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check (no auth) |
| `GET` | `/api/me` | Current authenticated user |
| `GET` | `/api/profile` | Read profile, with derived age and BMI |
| `PUT` | `/api/profile` | Create or update profile (onboarding) |
| `GET` | `/api/twin/context` | De-identified snapshot the AI layer receives |
| `POST` | `/api/reports` | Upload a report, extract and flag its values |
| `GET` | `/api/reports` | List uploaded reports |
| `GET` | `/api/reports/{id}` | One report with all its biomarkers |
| `GET` | `/api/reports/trends` | Each marker tracked across every report |
| `DELETE` | `/api/reports/{id}` | Delete a report and its biomarkers |
| `GET` | `/api/score` | Health Score with its full breakdown |
| `PUT` | `/api/logs/{date}` | Log steps, sleep, water, calories for a day |
| `GET` | `/api/logs` | Recent daily logs |
| `POST` | `/api/medications` | Add a prescription |
| `GET` | `/api/medications` | List prescriptions |
| `GET` | `/api/medications/interactions` | Known interactions among them |
| `DELETE` | `/api/medications/{id}` | Remove a prescription |

`/api/twin/context` exists to make the privacy boundary inspectable — call it to see exactly what reaches a third-party model, and confirm your name, email, and date of birth are not in it.

### Report parsing

Uploads are read by a multimodal model that returns structured JSON, rather than by generic OCR. Whether a value is low, normal, or high is then decided **in our code** by comparing against the reference range — never by the model, which can misjudge it.

Set `GEMINI_API_KEY` in `.env` to enable real parsing. Get a key from **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)** — it is free, and separate from any Gemini app subscription.

Without a key the API falls back to a mock parser that returns fixed sample data, so the full upload flow still works end to end.

### The Health Score

`/api/score` never returns a bare number. Every response carries the deductions that produced it, each with a reason and the evidence behind it:

```json
{
  "score": 36,
  "status": "scored",
  "summary": "Multiple areas need attention. The largest single factor is daily activity.",
  "coverage": { "labs": true, "sleep": true, "medication": true, "...": "..." },
  "deductions": [
    {
      "category": "activity",
      "points": 12.0,
      "reason": "Averaging 3,200 steps a day, below the 8,000 step target.",
      "evidence": "Average over 3 logged day(s)."
    },
    {
      "category": "labs",
      "points": 6.0,
      "reason": "HbA1c: moderately above the normal range.",
      "evidence": "6.4 % measured on 2026-07-10"
    }
  ]
}
```

Two properties worth knowing:

**Missing data is never scored as good.** A user who has logged nothing gets `"score": null` and `"status": "insufficient_data"` — not 100. The `coverage` object states exactly which areas were assessed, so an incomplete picture is visible rather than flattering.

**The calculation is pure.** `calculate_score()` depends only on its input state — no database, no clock. That is what lets the Lifestyle Simulator answer "what if I walked 8,000 steps?" by rebuilding the state with one field changed and calling the same function, so a projection and a real score can never drift apart.

### Running tests

```bash
cd backend
pytest
```

---

## Medical Disclaimer

⚠️ **AURA is an informational and educational tool. It is not a medical device and does not provide medical diagnosis or treatment.**

Nothing produced by AURA should be treated as professional medical advice. Always consult a qualified doctor or licensed healthcare provider before making any decision about your health, medication, or treatment. Never ignore or delay professional medical advice because of something you read in this application. In an emergency, contact your local emergency services immediately.

---

## License

Released under the [MIT License](LICENSE).
