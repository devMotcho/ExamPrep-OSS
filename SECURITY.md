# Security

Please don't report vulnerabilities in public issues. Use GitHub's [private vulnerability reporting](https://github.com/devMotcho/ExamPrep-OSS/security/advisories/new) and include the steps to reproduce and the impact.

Only the latest `main` is supported.

## Known limitations

- Registration reveals whether an email is already in use, and signing in reveals whether an account is disabled.
- Access tokens stay valid for up to 15 minutes after a logout, password change or password reset, though refresh tokens are revoked immediately.
- CSRF protection relies on `SameSite` cookies. Setting `COOKIE_SAME_SITE=None` removes it, so avoid that unless the frontend and API are on different sites.
- The backend trusts `X-Forwarded-For` from private network ranges. If the app can be reached directly from a private network you don't trust, narrow `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES`.
- Rate limits, social sign-in codes and login attempts in progress are partly kept in memory, so they assume one backend instance and reset on restart.
- Wrong guesses can use up a confirmation code that someone else requested, who then has to ask for a new one. This is the price of limiting guesses per address.
- Content saved before server-side sanitizing existed stays as it was in the database. The browser sanitizes it when showing it.
- The Content-Security-Policy keeps `style-src 'unsafe-inline'`, which the app's theme colours and UI components use, and allows images and video from any `https:` host, as S3-compatible hosts differ per installation.
- S3 and SMTP secrets entered in the settings are stored unencrypted when `AI_SETTINGS_ENCRYPTION_KEY` is not set. The settings page says so. Secrets in the environment are never stored.
- The SMTP port and S3 bucket and region can still be changed in the settings without re-entering a secret; only the host, username and endpoint are tied to one.
- `npm audit` still lists advisories that need major upgrades, mostly in build and test tooling (`vite`, `vitest`, `eslint`); these are not part of the served app. `react-router-dom` needs a major upgrade too and is.
