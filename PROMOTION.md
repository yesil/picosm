# picosm promotion packet

Status: local drafts for approval, updated 2026-10-21 for the single-page docs. Nothing has been posted, submitted, released or changed on GitHub or npm. Awesome Lit [PR #103](https://github.com/web-padawan/awesome-lit/pull/103) was submitted earlier, before this approval requirement.

## Positioning and metadata

**Message:** you can write web apps in plain HTML and JavaScript modules, with no bundler and no build step, and still have real state management.

**Headline:** picosm: state management without a bundler.

**Supporting line:** Plain HTML, JavaScript modules and observable classes. Explicit actions, cached getters and batched updates, with no build step and no dependencies.

**Proposed GitHub description:** State management for web apps without a bundler: observable classes with explicit actions, cached getters and batched updates. No dependencies; optional Lit integration and router.

**Proposed homepage:** https://yesil.github.io/picosm/ (currently the live tour at `/examples/`; change it only after the new root page is deployed and checked).

**Proposed GitHub topics:** `javascript`, `vanilla-javascript`, `web-components`, `lit`, `state-management`, `observable`, `reactive`, `router`, `buildless`, `import-maps`, `zero-dependency`. This drops the current `state-machine` topic: picosm isn't a state-machine library.

Don't add performance or size claims without a measured, reproducible figure for the named version.

## What's ready for review

- **The docs page:** `index.html`, built by `npm run docs:build` from `docs/index.md` and, in order, `how-it-works.md`, `api.md`, `lit.md`, `growing.md`, `history-routing.md` and `routing.md`. The API, Lit and Router sections come from `README.md`.
- **The runnable example:** `docs/example/index.html`, generated from the single-file app at the top of `docs/index.md`. It loads picosm 3.0.0 from jsDelivr.
- **For tools:** `docs/assistant-guide.md`, `llms.txt` and `sitemap.xml`.
- **Social image:** `docs/social.png`, rendered from `docs/social.svg` with `rsvg-convert -w 1200 -h 630 docs/social.svg -o docs/social.png`.

Review locally with `npm run docs:dev`. The example page uses the published 3.0.0 build; the live tour uses the repository source.

### DEV article

Use the docs' opening app, "How it works" and "As the app grows" as one article. After the docs are live, publish with:

```yaml
title: Web apps without a bundler, with real state management
published: false
description: One HTML file, an import map and an observable class, then the same app split into modules.
tags: javascript, webdev, webcomponents, tutorial
canonical_url: https://yesil.github.io/picosm/
cover_image: https://yesil.github.io/picosm/docs/social.png
```

Make relative links absolute and drop the `file=index.html` label from the code fence. Check the cover preview before publishing.

## Distribution targets

Recheck each list's rules and existing entries right before submitting.

| Target                                                                                   | Plan                                                                     | Status                                                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [Awesome Lit](https://github.com/web-padawan/awesome-lit)                                | Extensions                                                               | [PR #103](https://github.com/web-padawan/awesome-lit/pull/103) already submitted; don't duplicate |
| [Awesome JavaScript](https://github.com/sorrycc/awesome-javascript#reactive-programming) | Reactive Programming                                                     | Entry below; no earlier picosm PR found                                                           |
| [Awesome Web Components](https://github.com/web-padawan/awesome-web-components)          | The earlier draft pointed at the coffee tutorial, which no longer exists | Recheck the categories against the single-file example before proposing anything                  |
| [Lit Discord](https://discord.com/invite/buildWithLit)                                   | Lit post below                                                           | Check which channel allows project showcases first                                                |
| DEV                                                                                      | Article above                                                            | After the docs deploy                                                                             |
| LinkedIn                                                                                 | Post below                                                               | Draft                                                                                             |
| [Show HN](https://news.ycombinator.com/showhn.html)                                      | Link the live tour, which runs without a build                           | Draft below                                                                                       |

Sources: [Awesome JavaScript guidelines](https://github.com/sorrycc/awesome-javascript/blob/master/CONTRIBUTING.md), [Awesome Web Components guidelines](https://github.com/web-padawan/awesome-web-components/blob/main/CONTRIBUTING.md), [Lit community links](https://lit.dev/docs/resources/community/).

### Awesome JavaScript entry

```markdown
- [picosm](https://github.com/yesil/picosm) - State management for web apps without a bundler: observable classes with explicit actions, cached getters and batched updates.
```

PR title: **Add picosm to reactive programming**

PR body:

> Adds picosm, a zero-dependency state manager for apps written as plain HTML and JavaScript modules, with no bundler. Stores are ordinary classes: listed methods notify subscribers, listed getters are cached, and notifications are batched per microtask. It works with plain DOM code and custom elements, with optional Lit integration.
>
> I maintain the library. The docs open with a complete single-file app, and the repository has browser-based tests.

## Launch copy

### Plain JavaScript community post

I've been building small web apps from an HTML file, an import map and a few JavaScript modules, with no bundler. What I kept missing was a clean place for state that several parts of the page share, so I wrote picosm.

You write an ordinary class, list the methods that change state, and subscribe views to it. A custom element subscribes in `connectedCallback` and unsubscribes in `disconnectedCallback`, so you can put `<cart-count>` anywhere in the HTML and it stays in sync.

The docs open with a complete app in one file: https://yesil.github.io/picosm/?utm_source=community&utm_medium=social&utm_campaign=docs_launch

If you build without a bundler too, I'd like to hear what's missing.

### Lit community post

picosm is a small state manager for apps the browser loads directly, with no bundler. Stores are plain classes, and `makeLitObserver` re-renders a Lit component after store actions, subscribing and unsubscribing as the element connects and disconnects. The same store works from plain DOM code, so Lit components and hand-written elements can share it.

https://yesil.github.io/picosm/?utm_source=lit_community&utm_medium=social&utm_campaign=docs_launch#lit

Feedback on the Lit integration is welcome.

### LinkedIn post

You can build a real web app from an HTML file, an import map and a few JavaScript modules, with no bundler and no build step. Shared state is usually what sends people back to a framework.

picosm is my answer to that: a plain class whose state-changing methods you list as actions. Call them from anywhere, and every view subscribed to the class updates, once per batch. Getters are cached between changes. No dependencies.

The docs start with a complete app in one file:
https://yesil.github.io/picosm/?utm_source=linkedin&utm_medium=social&utm_campaign=docs_launch

If you've tried building without a bundler, what made you stop?

### Show HN

Title: **Show HN: Picosm – state management for web apps without a bundler**

URL: https://yesil.github.io/picosm/examples/

Author comment draft:

> I wanted to write web apps as plain HTML and JavaScript modules, loaded by the browser through an import map, without giving up a proper state layer. picosm makes a class observable: you list the methods that change state and the getters to cache, and subscribers run once per microtask after actions. Custom elements subscribe in `connectedCallback`. There's an optional Lit integration, and a router that keeps store state in the URL through the History API.
>
> The trade-off is explicitness: assigning a field outside an action doesn't notify anyone, cached getters are cleared per instance rather than per dependency, and there's no devtools panel or state history.
>
> The link is the live tour, which itself runs without a build step. The docs open with a complete single-file app: https://yesil.github.io/picosm/. Source: https://github.com/yesil/picosm. I'd like to hear where this model falls short.

Show HN wants something people can try, so the submission links the tour rather than the docs. Recheck the [rules](https://news.ycombinator.com/showhn.html) before submitting, and don't ask for votes.

## Demo recording

There's no recording; the earlier one showed the retired coffee tutorial and was deleted. If one is needed after the deploy, record 20–30 seconds of `docs/example/`: show the page source to make the point that it's one file, add a few drinks while the count and total update, then clear. Uploading it needs separate approval.

## Publication sequence requiring approval

1. Approve the wording, docs, example and social image.
2. Open a PR with the docs changes. Pages builds from `main` at `/`, so merging deploys. Then check the root page, `docs/example/`, the Markdown files, `docs/social.png` and `sitemap.xml` in production.
3. Update the GitHub description, homepage and topics to the approved values.
4. Release the npm metadata as 3.0.1, never overwriting 3.0.0. `package.json` still has the earlier description; replace it with the approved one first.
5. Register a Search Console URL-prefix property for `https://yesil.github.io/picosm/` and submit `https://yesil.github.io/picosm/sitemap.xml`. The project can't set a host-root `robots.txt` at `yesil.github.io`, and `/picosm/robots.txt` doesn't control crawlers.
6. Submit the approved list PRs, publish the DEV article and share the posts, spaced out according to each community's rules, with time to answer feedback.
7. Review the results after a month and address the adoption blockers people report before a second round.

## Measurement

First-month target: five external projects trying picosm, with feedback on what blocked or helped them. Downloads alone don't count as adoption.

| Signal                            | Baseline before launch  | One-month observation                                               |
| --------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| External projects trying picosm   | Not yet recorded        | Project links or voluntary feedback                                 |
| Search impressions and clicks     | Needs Search Console    | Query and page trends                                               |
| Docs, example and tour engagement | No analytics configured | Needs an approved analytics choice; UTM links alone collect nothing |
| npm downloads and GitHub traffic  | Record before launch    | Directional only; automation inflates downloads                     |
| Adoption blockers                 | None collected          | Issues, questions and direct feedback                               |

No analytics or tracking scripts have been added. `llms.txt` is a convenience index for tools that read it; it doesn't guarantee discovery, and Google Search [doesn't use it for rankings](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Assistant verification prompts

Give the assistant guide and API docs as context, then run the result against the published release.

- "Build a page with no bundler where two custom elements share a cart." Expected: an import map, a class store passed to `makeObservable`, `observe` in `connectedCallback` with an explicit first render, and the disposer called in `disconnectedCallback`.
- "Show a spinner before async work and render the result or the error afterward." Expected: a separate synchronous loading action, with the rejected Promise still handled by the caller.
- "Reuse a store in Lit and replace the store property." Expected: `makeLitObserver`, `observe: true`, an observable instance, and no manual subscription.
- "Keep a search filter in the URL while another registered store owns other parameters." Expected: the store that owns the search registers itself (no separate store mirroring it), changes go through actions, and no `navigate` call that wipes the other store's parameters.

These checks show whether an assistant writes correct picosm code when given the docs. They don't measure whether an assistant recommends picosm unprompted, whether crawlers index it, or whether people adopt it.

## Local verification, 2026-10-21

- `npm test`: 87 browser tests passed. `npm run lint`: passed.
- `npm run docs:build`: passed. The build fails on any in-page link to a missing anchor.
- Run in Chrome against picosm 3.0.0 from jsDelivr:
  - `docs/example/`: adding and clearing items; a `<cart-count>` inserted later renders and stays in sync; a removed one stops updating.
  - The `growing.md` store and checkout code: `track` clears the cached shipping, and eight adds produce one notification.
  - The `history-routing.md` app on a server with an `index.html` fallback: loading a deep link, link clicks pushing without a reload, the checkbox replacing the entry, reload restoring state, Back, and the bare `/`.
- The live tour at `examples/` loads with every custom element defined.
- The docs page at desktop and 375px widths; explorer links land each heading below the sticky file tab.
- `docs/social.png` rendered from `docs/social.svg` and checked by eye.

Not verified: the production deploy, social unfurls on external platforms, search indexing and analytics.
