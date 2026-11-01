# Contributing

Bug reports and pull requests are welcome. For anything bigger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

## Setting up

See [local development](docs/architecture.md#local-development).

## Before opening a pull request

- `mvn test` passes in `backend/`; `npm test` and `npm run build` pass in `frontend/`. ESLint has known existing failures, so just don't add new ones.
- New user-facing text exists in both `en.json` and `pt.json`.
- Schema changes come as a new Flyway migration. Never edit one that has been released.
- A new site setting that the browser must read has to be added to the allowlist in `SiteConfigController`.

Keep pull requests to one change, and say in the description what you tested.

By contributing, you agree your work is licensed under [AGPL-3.0](LICENSE).

Security problems don't go in public issues: see [SECURITY.md](SECURITY.md).
