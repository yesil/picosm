# Contributing to picosm

Thanks for your interest in improving picosm. This guide covers local setup, the
testing model, and the conventions used in this repo.

## Development setup

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm test` | Run the full test suite (browser-based, Chrome) |
| `npm run test:watch` | Re-run tests on file changes |
| `npm run lint` | Lint `src` and `test` (eslint + prettier) |
| `npm run dev` | Start the dev server for the examples |
| `npm run build` | Bundle `src/` into `dist/` with esbuild |

## Testing model

Tests are **browser-based**, not Node. They run via
[`@web/test-runner`](https://modern-web.dev/docs/test-runner/overview/) in a real
headless Chrome instance — `@web/test-runner-chrome` provisions the browser
automatically, so `npm test` works with no extra setup locally and in CI.

Test files live in `test/**/*.test.js`. Add or update tests for any behavior
change; CI runs lint, tests, and the build on every pull request.

## Project structure

- `src/makeObservable.js` — core: action instrumentation, computed caching, observe, subscribe/notify
- `src/reaction.js` — selective reaction to specific value changes
- `src/track.js` — forward notifications between observables
- `src/makeLitObserver.js` — LitElement integration via reactive controller
- `src/router.js` — store-driven URL routing via the History API (`picosm/router`)
- `src/index.js` — barrel export (includes router)
- `test/` — browser tests (web-test-runner)
- `examples/` — runnable demos served at `yesil.github.io/picosm/examples/`

## Conventions

- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Run `npm run lint` and keep your changes formatted (eslint + prettier).
- Keep the change focused; update the README when public behavior changes.

## Pull requests

1. Fork and create a branch.
2. Make your change with tests.
3. Ensure `npm run lint` and `npm test` pass.
4. Open a PR using the template — describe the change and how you verified it.

[Open an issue](https://github.com/yesil/picosm/issues) to discuss larger
changes before investing significant work.
