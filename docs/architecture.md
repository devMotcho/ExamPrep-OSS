# Architecture

```
browser ── nginx (web) ──┬── static React build
                         └── /api ── Spring Boot (backend) ── PostgreSQL
                                          ├── S3-compatible storage (optional)
                                          ├── SMTP (optional)
                                          └── Anthropic / OpenAI (optional)
```

## Where things live

| Path | Contents |
|---|---|
| `backend/src/main/java/com/exam_prep/api/service` | Exams, study areas, retention, reminders |
| `.../study` | Study plan, readiness, marks and saved exam setups |
| `.../aigen` | PDF validation, prompts, the generation worker, provider clients |
| `.../user` | Accounts, authentication, JWT and OAuth |
| `.../blog`, `.../contact`, `.../notification` | Supporting features |
| `backend/src/main/resources/db/migration` | Flyway migrations |
| `frontend/src/pages` | One component per route |
| `frontend/src/components`, `frontend/src/features` | Shared UI and feature modules |
| `frontend/src/i18n/locales` | `en.json`, `pt.json` |
| `infra/` | The web image and nginx config |

## Two things that will surprise you

**`/api/api`.** The servlet context path is `/api`, and most controllers also map to `/api`. So the study area route really is `/api/api/study-areas`. It's ugly but consistent; authentication routes are at `/api/auth/...`.

**Settings are in the database.** `site_config` holds branding, feature flags and integration settings, and the admin page edits it. On startup, `EnvConfigSeeder` copies the non-secret integration variables from the environment over those rows, so a value set in `.env` wins after a restart. S3 and SMTP secrets are different: `ServiceSettings` reads them from the environment first, they are never copied to the database, and a row is cleared when the environment has the value. Secrets entered in the settings are encrypted when `AI_SETTINGS_ENCRYPTION_KEY` is set. A secret is tied to where it goes (`ServiceSettings.secretTiedTo`): changing the host, username or endpoint in the settings clears it, and is refused when the environment holds either side. `GET /api/config/public` serves only an explicit allowlist of keys, so a new setting stays private until you add it there.

## Authentication

All sign-in paths use HttpOnly cookies with a short-lived JWT and a rotating refresh token; tokens are never readable by JavaScript or accepted in a header. Refresh tokens are stored as SHA-256 hashes and belong to a family per sign-in. Logout ends the family, a password change ends all of them except a new one for the current browser, and presenting an already rotated token ends its family (a repeat within 10 seconds, such as another tab, gets a 409 instead).

Social sign-in redirects to the app with a single-use code, valid for 60 seconds and tied to a cookie set on the same redirect. The app posts it to `/api/auth/oauth2/exchange`, which sets the cookies. It links to an existing account only when the provider confirms the email is verified, and a new account counts as confirmed only then too.

An account is confirmed once someone has shown they own its address: a code at registration or from `/api/auth/confirm-email`, a password reset, or a provider that says the email is verified. Without confirmation codes turned on, a password registration stays unconfirmed. Signing in does not require confirmation. When ownership is shown on an unconfirmed account, what its creator set up goes: a verified provider removes the password and all sessions, and a password reset removes the social sign-in link and all sessions.

Confirmation codes are bound to their purpose (`purpose` in `/api/auth/send-code`), are gone after 5 wrong guesses, and an address receives at most `CONFIRMATION_CODE_SENDS_PER_HOUR` per hour.

## Content safety

Prompts and explanations are rendered as HTML. `RichTextSanitizer` reduces them on write to what the Tiptap editor produces, and `frontend/src/lib/sanitizeHtml.ts` applies the same list when displaying them, which also covers rows saved before the server check existed. Change both together. Titles, descriptions and options are plain text and lose any markup on write.

## Rate limits

`RateLimitFilter` keeps one bucket per limit class, route and client: a POST to a sensitive route has its own stricter bucket that no other request can touch, and ids in a path share one route. Each client also has a total per minute. IPv6 clients count per /64, here and in login lockout. Everything is in memory, so a single backend instance is assumed.

## Roles

`ROLE_USER` studies. `ROLE_ADMIN` manages users, settings and articles. `ROLE_DEV` is an optional extra account for instance maintainers.

## Local development

```bash
cp .env.example .env   # also set DEFAULT_*, POSTGRES_USER, POSTGRES_DB, JWT_*_MS, ALLOWED_ORIGINS, FRONTEND_URL
docker compose -f docker-compose.dev.yml up
```

Frontend at <http://localhost:5173>, API at <http://localhost:8080/api>, pgAdmin at <http://localhost:5050>.

Run the tests without Docker:

```bash
cd backend && mvn test
```

```bash
cd frontend && npm ci && npm test
```
