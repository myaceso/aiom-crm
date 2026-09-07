# enone.app CRM

## Auth
- Server sessions: jose JWT cookie + PBKDF2 password hashes
- User store: `KV_REST_API_URL` + `KV_REST_API_TOKEN` (preferred), or `POSTGRES_URL`, or local `.data/enone-users.json`
- Public signup creates a **pending** staff user with empty permissions until email verification
- Verification tokens are SHA-256 hashed in KV/Postgres/local with 24h expiry
- Email via Resend: `RESEND_API_KEY` + `EMAIL_FROM`. Admin alerts: `ADMIN_NOTIFY_EMAIL` (fallback: first active admin)

## CRM sync
- Authenticated `GET/PUT /api/crm/state` stores per-user CRM JSON (`enone:crm:{userId}`)
- Zustand loads CRM on login and debounces saves to the server
- Browser localStorage only keeps UI prefs (`sidebarCollapsed`); media binary blobs stay device-local for now

## Env
See `.env.example` for `AUTH_SECRET`, `KV_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`, `NEXT_PUBLIC_APP_URL`.
