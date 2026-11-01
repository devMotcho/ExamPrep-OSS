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

**Settings are in the database.** `site_config` holds branding, feature flags and integration settings, and the admin page edits it. On startup, `EnvConfigSeeder` copies the integration variables from the environment over those rows, so a value set in `.env` wins after a restart. `GET /api/config/public` serves only an explicit allowlist of keys, so a new setting stays private until you add it there.

## Authentication

Password sign-in uses httpOnly cookies with a short-lived JWT and a rotating refresh token. Social sign-in links to an existing account only when the provider confirms the email is verified.

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
