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
- Browser localStorage only keeps UI prefs (`sidebarCollapsed`)
- Social media files are uploaded to **Vercel Blob** (public URLs, synced via `mediaAssets[].url`); IndexedDB keeps a local copy for fast previews

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

## Facebook + Instagram auto-publishing (Marketing)
**Flow:** Marketing → compose → choose Facebook / Instagram / both → *Publicar ahora* or *Programar*.
Everything runs server-side, so scheduled posts publish even with no browser open.

- **Credentials:** Integraciones → *Meta · Facebook + Instagram* card (Page ID, Page access token, optional IG Business ID override).
  *Probar conexión* validates the token (read-only) and shows the Page name + linked Instagram @username.
  Stored in the per-user CRM state (`socialConnections` facebook/instagram: `pageId`, `accessToken`, `igUserId`).
- **Media:** uploaded from the browser straight to Vercel Blob via client uploads (`POST /api/media/upload`, auth + per-user path
  `social/{userId}/…`). Images are converted to JPEG client-side (Instagram only accepts JPEG). Limits: images 10 MB, videos 200 MB.
- **Posts/jobs:** `GET/POST /api/social/posts`, `PATCH /api/social/posts/{id}` (`retry` | `cancel` | `reschedule`), `DELETE` (removes from list only).
  Stored in KV/Postgres at `enone:social:post:{userId}:{id}` with `status` (scheduled / publishing / published / failed / cancelled),
  `attempts`, `lastError`, `results.facebook.id` (FB post id) / `results.instagram.id` (IG media id), permalinks.
  Due index: set `enone:social:due`. Failed attempts auto-retry up to 3× (5 / 10 min backoff); already-successful channels are never re-posted.
- **Cron:** `vercel.json` runs `GET /api/cron/publish` every 5 minutes (Vercel Pro plan). Protected by `Authorization: Bearer $CRON_SECRET`
  (401 otherwise, 503 if `CRON_SECRET` is unset). Fallback for Hobby plans (daily-only crons): point any external cron
  (e.g. cron-job.org) at `https://www.enone.app/api/cron/publish` every 5 min with header `Authorization: Bearer <CRON_SECRET>`.
- **Graph API** (`lib/metaPublish.ts`, default `v26.0`, override `META_GRAPH_VERSION`):
  - Facebook: text → `/{page-id}/feed` (first URL passed as `link`); 1 image → `/{page-id}/photos?url=`; several images →
    unpublished photos + `/feed` with `attached_media`; video → `/{page-id}/videos?file_url=`.
  - Instagram: IG id from `/{page-id}?fields=instagram_business_account` (or manual override). Image → `/{ig-id}/media?image_url=`;
    video → `media_type=REELS&video_url=`; 2–10 files → carousel. Polls `status_code` until `FINISHED` (long videos resume on the next cron run), then `/{ig-id}/media_publish`.
  - User tokens are upgraded to the Page token automatically; `POST /api/social/meta/exchange` (needs `META_APP_ID`/`META_APP_SECRET`)
    exchanges a short-lived user token → long-lived user token → `/me/accounts` Page tokens (these don't expire).

### Env vars
| Var | Required | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | yes | Set automatically by connecting the Blob store (`enone-media`) to the project |
| `CRON_SECRET` | yes | Random string; Vercel Cron sends it as Bearer token |
| `META_APP_ID`, `META_APP_SECRET` | optional | Enables the in-app "convert to permanent Page token" helper and token debug info |
| `META_GRAPH_VERSION` | optional | Defaults to `v26.0` |

### Meta setup (one time)
1. Instagram account → **Professional** (Business or Creator) and **linked to the Facebook Page** (Meta Business Suite → Settings → Accounts → Instagram accounts, or Page settings → Linked accounts).
2. developers.facebook.com → **Create app** → type *Business* → add *Facebook Login for Business* and *Instagram Graph API* (Instagram API with Facebook Login).
3. Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
   (`business_management` may be needed if the Page is owned by a Business portfolio).
4. **Graph API Explorer** → select the app → *Get User Access Token* with those permissions → copy token.
5. Make it permanent: either paste it in Integraciones → *Convertir token…* (if `META_APP_ID/SECRET` are set), or manually:
   Access Token Debugger → *Extend Access Token* → in Graph API Explorer call `me/accounts` with the long token → copy the Page `access_token` (never expires) and the Page `id`.
6. Integraciones → paste Page ID + token → **Probar conexión** (should show Page name + @instagram) → **Guardar y conectar**.
7. App in *Development* mode works only for people with a role on the app (admins/developers/testers) — fine for your own Page.
   To let other enone users connect their Pages you need **Business Verification** + **App Review** (advanced access) for the permissions above, then switch the app to *Live*.
