# AURA Database

## Technology
- PostgreSQL via Supabase

## Tables
| Table | Purpose |
|-------|---------|
| platform_content | Landing page sections |
| health_metrics | Patient dashboard metrics |
| appointments | Doctor appointments |
| medications | Medication tracking |
| health_timeline | Health event timeline |
| risk_trends | Predictive risk monitoring |
| chat_messages | AI companion conversations |
| symptom_assessments | Triage results |
| medical_reports | Uploaded report analysis |
| condition_logs | Chronic condition readings |
| lifestyle_simulations | What-if scenario results |
| patient_summaries | Doctor view patient data |
| agent_status | Multi-agent AI status |
| audit_logs | System governance |
| wearable_devices | Connected sensor devices |

## Setup
1. Run `schema.sql` to create tables
2. Run `seed_data.sql` to populate demo data
3. Configure Supabase Storage bucket `health-reports` for file uploads
