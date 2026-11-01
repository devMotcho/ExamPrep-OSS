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

Port 465 uses TLS from the start. Other ports use STARTTLS, which is required on 25, 587 and 2525 and whenever a username is set; only a server without credentials on another port, such as a local mail catcher, may do without it. The server's certificate has to match its name.

Changing the SMTP host or username in the settings clears a stored SMTP password, so enter it again in the same save or afterwards. If any of the host, username or password is in the environment, the settings page refuses changes to the host and username: change them in the environment. The S3 endpoint works the same way with `AWS_S3_ENDPOINT` and `AWS_S3_SECRET_KEY`.

## Image storage

Any S3-compatible service. Without it, uploads return 503 and everything else works.

| Variable | Notes |
|---|---|
| `AWS_S3_ACCESS_KEY`, `AWS_S3_SECRET_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET` | |
| `AWS_S3_ENDPOINT` | Set this for MinIO, R2 and others |
| `AWS_S3_PUBLIC_ENDPOINT` | The address browsers use, if different from `AWS_S3_ENDPOINT` |

### Cloudflare R2

```bash
AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_REGION=auto
AWS_S3_BUCKET=<bucket>
AWS_S3_ACCESS_KEY=<access key id>
AWS_S3_SECRET_KEY=<secret access key>
```

1. Create the bucket and leave public access off. Images are served through signed links that last an hour.
2. Create an R2 API token with **Object Read & Write**, scoped to that bucket only. Its access key ID and secret access key go in the two variables above.
3. Restart with `docker compose up -d`, then upload an image in the gallery.

Leave `AWS_S3_PUBLIC_ENDPOINT` empty: signed links only work on the `r2.cloudflarestorage.com` address, not on a custom domain. `CSP_EXTRA_MEDIA_SOURCES` isn't needed either, because the Content-Security-Policy already allows images from any `https:` address. The browser loads them as plain images, so the bucket needs no CORS rule.

For R2, uploads to a custom endpoint aren't chunked and don't send optional checksums. Upload, signed fetch and delete are tested against MinIO. They haven't been run against R2 itself: this section follows Cloudflare's documentation for the AWS SDK for Java. If you try it and something differs, please open an issue.

## Request size

Requests are capped at 5 MB, by nginx and, for anything that isn't a file upload, by the backend too. Only the routes that take a file accept up to 50 MB. Both answer 413. If you run your own proxy in front, give it limits of its own.

## Upload limits

| Variable | Default | Notes |
|---|---|---|
| `MAX_UPLOAD_MB` | `10` | Gallery images and question files. `0` turns it off; upload requests are capped at 50 MB regardless |
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
