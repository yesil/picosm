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
| `npm run dev` | Serve the live tour (`examples/`) |
| `npm run build` | Bundle `src/` into `dist/` with esbuild |
| `npm run docs:build` | Build the documentation page, the example page, `llms.txt` and `sitemap.xml` |
| `npm run docs:dev` | Build the docs and serve them locally |

## Documentation

The docs site is a single page, `index.html`, built by `scripts/build-docs.js`. `docs/index.md` is the introduction, and every other Markdown file in `docs/` becomes a section, in the order the script lists them. Link between sections by file name (`routing.md#navigation`): the build turns those links into anchors and fails on any anchor that doesn't exist.

The API, Lit and Router sections are cut out of `README.md` by heading, so edit that reference in the README, and keep its `## API`, `## Async actions`, `## Router` and `## Contributing` headings where they are. The runnable `docs/example/index.html` is generated from the `file=index.html` code block in `docs/index.md`, so the app shown at the top of the docs and the one you can run can't drift apart. It loads picosm from a pinned CDN URL, which needs bumping by hand for a new release.

Commit the generated files along with their sources. GitHub Pages serves the branch as is: nothing is built on the server, and `.nojekyll` stops Jekyll from processing it.

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
- `src/internal.js` — shared helpers, not exported from the barrel
- `test/` — browser tests (web-test-runner)
- `examples/` — the live tour: one page with a card per capability, served at `yesil.github.io/picosm/examples/`

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
