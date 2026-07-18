# AURA Backend

## Technology
- Vercel Serverless Functions (Node.js)
- Supabase JavaScript Client

## API Routes

### `/api/platform`
Universal CRUD endpoint for all database tables.
- `GET /api/platform?resource=metrics` - List resources
- `POST /api/platform` - Create resource
- `PUT /api/platform` - Update resource
- `DELETE /api/platform` - Delete resource

### `/api/chat`
AI Health Companion messages.
- `GET /api/chat` - Fetch conversation history
- `POST /api/chat` - Send message, receive AI response

### `/api/triage`
Symptom triage assessment.
- `GET /api/triage` - List past assessments
- `POST /api/triage` - Submit symptoms, get urgency + guidance

### `/api/upload`
Medical report upload with OCR analysis.
- `POST /api/upload` - Upload file to Supabase Storage + analyze

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
