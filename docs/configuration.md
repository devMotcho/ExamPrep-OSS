# Configuration

Everything below goes in `.env`. Branding, colours and feature switches live in **Settings** in the app instead. Prefer not to manage any of this? [escolhamultipla.pt](https://escolhamultipla.pt) is ready to use.

## Required

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | At least 32 bytes, or the backend won't start |
| `DEFAULT_ADMIN_EMAIL` | First admin, created once |
| `DEFAULT_ADMIN_PASSWORD` | 12 or more characters; a weak value creates no admin |

## Instance

| Variable | Default | Notes |
|---|---|---|
| `HTTP_PORT` | `8080` | Port published on the host |
| `PUBLIC_URL` | `http://localhost:8080` | Used for CORS, email links and social sign-in |
| `COOKIE_SECURE` | `false` | Set to `true` with HTTPS |
| `COOKIE_SAME_SITE` | `Lax` | `None` requires `COOKIE_SECURE=true`, or startup fails |
| `APP_TIMEZONE` | `UTC` | When a study day starts, for streaks and reminders |
| `POSTGRES_USER`, `POSTGRES_DB` | `examprep` | |
| `DEFAULT_DEV_EMAIL`, `DEFAULT_DEV_PASSWORD` | empty | Optional maintainer account, same password rule |

## Email

Needed for password reset, reminders and contact replies.

| Variable | Default | Notes |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT` | empty, `587` | |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | empty | |
| `CONFIRMATION_CODE_SENDS_PER_HOUR` | `5` | Codes one address can receive per hour, 0 turns it off |
| `SMTP_FROM` | `SMTP_USERNAME` | If neither is a valid address, email stays off and the log says why |
| `EMAIL_SENDER_NAME` | `ExamPrep` | |

## Image storage

Any S3-compatible service. Without it, uploads return 503 and everything else works.

| Variable | Notes |
|---|---|
| `AWS_S3_ACCESS_KEY`, `AWS_S3_SECRET_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET` | |
| `AWS_S3_ENDPOINT` | Set this for MinIO, R2 and others |
| `AWS_S3_PUBLIC_ENDPOINT` | The address browsers use, if different from `AWS_S3_ENDPOINT` |

## Upload limits

| Variable | Default | Notes |
|---|---|---|
| `MAX_UPLOAD_MB` | `10` | Gallery images and question files. `0` turns it off; requests are capped at 50 MB regardless |
| `MAX_UPLOADS_PER_DAY` | `100` | Per user, per UTC day. `0` turns it off |

## Social sign-in

Register the redirect URI `PUBLIC_URL/api/auth/oauth2/callback/google` (or `/microsoft`) with the provider.

| Variable | Default |
|---|---|
| `OAUTH_GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `false`, empty, empty |
| `OAUTH_MICROSOFT_ENABLED`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `false`, empty, empty |
| `MICROSOFT_TENANT_ID` | `common` |

An existing account is linked only when the provider confirms the email is verified. Microsoft doesn't always say so, and in that case the sign-in is refused rather than linked.

## Limits

| Variable | Default | Notes |
|---|---|---|
| `MAX_STUDY_AREAS_PER_USER` | `100` | 0 turns it off. Administrators have no limit |
| `MAX_IMPORT_QUESTIONS` | `500` | Questions in one import file |
| `RATE_LIMIT_DEFAULT` | `120` | Requests per minute per client to one route |
| `RATE_LIMIT_TOTAL` | `600` | Requests per minute per client overall. Raise both if many people share one address, such as a school |

## Web container

| Variable | Default | Notes |
|---|---|---|
| `HSTS_HEADER_VALUE` | empty | For example `max-age=31536000`. See [security headers](self-hosting.md#security-headers) |
| `CSP_EXTRA_MEDIA_SOURCES` | empty | Plain-HTTP image hosts, such as a local MinIO |

## AI generation

| Variable | Notes |
|---|---|
| `AI_SETTINGS_ENCRYPTION_KEY` | `openssl rand -base64 32`. Without it AI generation is unavailable, and S3 and SMTP secrets entered in the settings are stored unencrypted, which the settings page points out |

The provider, key, model and spending limits are set in the app. See [Writing questions](writing-questions.md#turning-on-ai-generation).

## Advanced

These aren't passed through by `docker-compose.yml`, so add them under `backend.environment` to use them.

| Variable | Notes |
|---|---|
| `RATE_LIMIT_TELEMETRY` | Visit pings per minute per IP, default 30 |
| `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES` | Regex of trusted proxies, replacing Tomcat's private-range default |
