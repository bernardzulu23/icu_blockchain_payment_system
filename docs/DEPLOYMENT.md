# Deployment — Supabase + VPS (no Neon, no Vercel)

This stack uses:

| Layer | Host |
|-------|------|
| PostgreSQL | **Supabase** |
| File storage | **Supabase Storage** (private bucket `icu-uploads`) |
| Express API + OCR + Fabric | **Your VPS** (long-lived Node process) |
| React frontend | **VPS (nginx)** or Cloudflare Pages / Netlify — **not Vercel** |

## 1. Create a Supabase project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Note the database password you set
3. **Settings → Database → Connection string**
   - **Transaction** pooler → `DATABASE_URL` (app runtime, port `6543`)
   - **Session** or **Direct** → `DATABASE_DIRECT_URL` (migrations, port `5432`)
4. **Settings → API**
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**)

## 2. Configure the API (`backend/.env`)

```bash
cp backend/.env.example backend/.env
# Fill DATABASE_URL, DATABASE_DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# FRONTEND_URL=https://your-frontend-host
# JWT_SECRET=$(openssl rand -hex 32)
# JWT_REFRESH_SECRET=$(openssl rand -hex 32)
```

## 3. Run migrations + create storage bucket

```bash
cd backend
npm install
npm run db:migrate
```

This applies all SQL under `backend/migrations/` and ensures the private `icu-uploads` bucket exists.

## 4. Run the API on a VPS

```bash
cd backend
npm start
# OCR (optional, same host):
# cd python-services && python api_server.py
```

Point nginx (or similar) at the Node port (default `5000`) as `https://api.your-domain.example`.

Fabric chaincode stays on the Fabric VPS — set `FABRIC_*` and `BLOCKCHAIN_OPTIONAL=false` there.

## 5. Build & host the frontend (not Vercel)

```bash
cd frontend
# Point at your API
echo "VITE_API_URL=https://api.your-domain.example/api" > .env.production
npm install
npm run build
# dist/ → serve with nginx, or upload to Cloudflare Pages / Netlify
```

CORS: set `FRONTEND_URL` on the API to your frontend origin.

## 6. Environment checklist

| Variable | Frontend | API (VPS) |
|----------|----------|-----------|
| `VITE_API_URL` | ✅ build-time | ❌ |
| `DATABASE_URL` | ❌ | ✅ Supabase pooler |
| `DATABASE_DIRECT_URL` | ❌ | ✅ migrations |
| `SUPABASE_URL` | ❌ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | ❌ | ✅ |
| `FRONTEND_URL` | ❌ | ✅ |
| `FABRIC_*` / `PYTHON_SERVICE_URL` | ❌ | ✅ on Fabric/OCR host |

## Local development

```bash
# backend/.env → Supabase URLs (or local Postgres)
cd backend && npm run db:migrate && npm run dev
cd frontend && npm run dev
```

## Migrating off Neon / Vercel

1. Export data from Neon if needed (`pg_dump`), import into Supabase (`psql` / SQL editor)
2. Point `DATABASE_*` and `SUPABASE_*` at the new project
3. Remove Vercel project / Neon integration — this repo no longer uses `vercel.json`
4. Redeploy frontend to your new static host; keep API on VPS

## Security notes

- Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend
- Storage bucket is **private**; files are served via authenticated `/api/files`
- Rotate JWT secrets when leaving shared/free-tier hosts
