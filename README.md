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

## Billing (Stripe + PayPal)
- Per-account one-time subscription payment ($10 preset or custom USD, min $1)
- UI: `/dashboard/billing` (sidebar **Billing**)
- Status stored server-side at `enone:billing:{userId}` (KV / Postgres / local `.data`)
- APIs:
  - `GET /api/billing/status`
  - `POST /api/billing/stripe/checkout` `{ amountCents }`
  - `POST /api/billing/stripe/webhook` (`checkout.session.completed`)
  - `POST /api/billing/paypal/create` `{ amountCents }`
  - `POST /api/billing/paypal/capture` `{ orderId }`
- Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`
- Stripe webhook URL: `https://<host>/api/billing/stripe/webhook`
