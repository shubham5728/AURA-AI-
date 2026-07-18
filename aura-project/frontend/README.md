# AURA Frontend

## Technology
- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Framer Motion
- React Router DOM
- Lucide React

## Structure
```
src/
  App.tsx          - Main application with all pages
  main.tsx         - Entry point
  index.css        - Global styles
  contexts/
    AuthContext.tsx - Authentication state
  lib/
    supabase.ts     - Supabase client
    googleAuth.ts   - Google OAuth helper
public/
  images/           - Digital twin assets
  favicon.svg       - App icon
```

## Pages
- `/` - Landing page
- `/login` - Authentication
- `/app` - Patient Dashboard
- `/app/companion` - AI Health Companion
- `/app/triage` - Symptom Triage
- `/app/twin` - Digital Twin
- `/app/wearables` - Wearable Devices
- `/app/reports` - Report Analyzer
- `/app/chronic` - Chronic Care
- `/app/simulator` - Lifestyle Simulator
- `/app/agents` - Multi-Agent AI
- `/app/doctor` - Doctor Dashboard
- `/app/admin` - Admin Dashboard

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
