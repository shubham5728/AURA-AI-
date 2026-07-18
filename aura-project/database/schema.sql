-- AURA Health Platform Database Schema
-- PostgreSQL (Supabase)

-- Platform content (landing page sections)
CREATE TABLE platform_content (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Health metrics for patient dashboard
CREATE TABLE health_metrics (
  id SERIAL PRIMARY KEY,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  change TEXT,
  trend JSONB
);

-- Appointments
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  doctor TEXT,
  specialty TEXT,
  day TEXT,
  month TEXT,
  time TEXT
);

-- Medications
CREATE TABLE medications (
  id SERIAL PRIMARY KEY,
  name TEXT,
  dose TEXT,
  schedule TEXT,
  taken BOOLEAN DEFAULT false
);

-- Health timeline events
CREATE TABLE health_timeline (
  id SERIAL PRIMARY KEY,
  time TEXT,
  title TEXT,
  detail TEXT
);

-- Risk trends
CREATE TABLE risk_trends (
  id SERIAL PRIMARY KEY,
  name TEXT,
  status TEXT,
  level TEXT
);

-- AI Chat messages
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  role TEXT,
  content TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Symptom assessments
CREATE TABLE symptom_assessments (
  id SERIAL PRIMARY KEY,
  symptom TEXT,
  urgency TEXT,
  guidance TEXT,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Medical reports
CREATE TABLE medical_reports (
  id SERIAL PRIMARY KEY,
  file_name TEXT,
  file_url TEXT,
  status TEXT,
  summary TEXT,
  extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chronic condition logs
CREATE TABLE condition_logs (
  id SERIAL PRIMARY KEY,
  condition_name TEXT,
  value TEXT,
  unit TEXT,
  logged_at TIMESTAMPTZ,
  status TEXT
);

-- Lifestyle simulations
CREATE TABLE lifestyle_simulations (
  id SERIAL PRIMARY KEY,
  scenario TEXT,
  projected_score INTEGER,
  risk_reduction INTEGER,
  timeline_weeks INTEGER
);

-- Patient summaries (doctor view)
CREATE TABLE patient_summaries (
  id SERIAL PRIMARY KEY,
  name TEXT,
  age INTEGER,
  condition TEXT,
  risk TEXT,
  health_score INTEGER,
  last_sync TEXT,
  ai_summary TEXT,
  recommendation TEXT,
  trend JSONB
);

-- AI agent statuses
CREATE TABLE agent_status (
  id SERIAL PRIMARY KEY,
  name TEXT,
  focus TEXT,
  status TEXT,
  latest_action TEXT,
  detail TEXT,
  updated TEXT
);

-- Audit logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  event TEXT,
  actor TEXT,
  resource TEXT,
  time TEXT,
  status TEXT
);

-- Wearable devices
CREATE TABLE wearable_devices (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  battery INTEGER NOT NULL DEFAULT 100,
  last_sync TEXT,
  latest_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
