# Security

Please don't report vulnerabilities in public issues. Use GitHub's [private vulnerability reporting](https://github.com/devMotcho/ExamPrep-OSS/security/advisories/new) and include the steps to reproduce and the impact.

Only the latest `main` is supported.

## Known limitations

- Registration reveals whether an email is already in use, and signing in reveals whether an account is disabled.
- Access tokens stay valid for up to 15 minutes after a password reset, though refresh tokens are revoked immediately.
- CSRF protection relies on `SameSite` cookies. Setting `COOKIE_SAME_SITE=None` removes it, so avoid that unless the frontend and API are on different sites.
- The backend trusts `X-Forwarded-For` from private network ranges. If the app can be reached directly from a private network you don't trust, narrow `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES`.
