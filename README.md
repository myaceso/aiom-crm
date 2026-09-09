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

## AI Smart Agent
- UI: `/dashboard/ai-assistants` (overview) and `/dashboard/ai-assistants/agent` (ChatGPT-style chat)
- API: `POST /api/ai/chat` `{ messages: [{ role, content }], conversationId? }` (session cookie auth)
- Also: `GET /api/ai/chat` (list threads), `GET /api/ai/chat?id=…`, `DELETE /api/ai/chat?id=…`
- Threads persist per user at `enone:ai-chats:{userId}` (KV / Postgres / local `.data`)
- Env: `OPENAI_API_KEY` (preferred), optional `OPENAI_MODEL` (default `gpt-4o-mini`), optional `OPENAI_BASE_URL`; or `ANTHROPIC_API_KEY` + optional `ANTHROPIC_MODEL`
- Without keys, API returns `ai_not_configured` (503) and the UI shows Vercel setup instructions
- Module permission: `aiAssistants`
