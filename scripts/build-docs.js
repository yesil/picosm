import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);

const root = new URL('../', import.meta.url);
const site = 'https://yesil.github.io/picosm/';
const { version } = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8'),
);
const readme = await readFile(new URL('README.md', root), 'utf8');
const title = 'picosm: state management without a bundler';
const description =
  'Write web apps in plain HTML and JavaScript modules, with no bundler, and keep state in observable classes. Explicit actions, cached getters, batched updates and no dependencies.';
const sections = [
  {
    slug: 'how-it-works',
    nav: 'How it works',
    description:
      'Stores, subscriptions, batching and loading picosm without a bundler, and what the explicit-action model costs.',
  },
  {
    slug: 'api',
    nav: 'API reference',
    description:
      'makeObservable, observe, reaction, track, subscribe/notify and async actions.',
  },
  {
    slug: 'lit',
    nav: 'Lit',
    description: 'Using stores from Lit components with makeLitObserver.',
  },
  {
    slug: 'routing',
    nav: 'Router',
    description:
      'createRouter and register: URL ownership, history, links with router.go, deep links that survive a refresh, guards and storage.',
  },
  {
    slug: 'tracing',
    nav: 'Tracing',
    description:
      'startTrace and stopTrace: recording which store changes make Lit views update, and what each update cost.',
  },
];

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
const headingId = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');

function section(start, end) {
  const first = readme.indexOf(start);
  const last = readme.indexOf(end, first + start.length);
  if (first === -1 || last === -1)
    throw new Error(`README section not found: ${start}`);
  return readme.slice(first + start.length, last).trim();
}

// README reference sections sit one heading level below the docs pages
const promote = (markdown) => markdown.replace(/^#(#+ )/gm, '$1');

const api = section('## API\n', '### `makeLitObserver(constructor)`');
const asyncActions = section('## Async actions\n', '## Router\n');
const litDetails = section(
  '### `makeLitObserver(constructor)`\n',
  '## Async actions\n',
);
const router = section('## Router\n', '## Performance tracing\n');
const tracing = section('## Performance tracing\n', '## Contributing\n');
await writeFile(
  new URL('docs/api.md', root),
  `# API reference\n\n${promote(api)}\n\n## Async actions\n\n${asyncActions}\n`,
);
await writeFile(
  new URL('docs/lit.md', root),
  `# Lit\n\n${litDetails}\n\nThe observer doesn't replay changes the element missed while it was detached. If the store can change in that time, call \`this.requestUpdate()\` after \`super.connectedCallback()\` in your own \`connectedCallback\`. When a store is only ever set as a property, declare it with \`attribute: false\` so Lit doesn't also look for an HTML attribute of that name.\n`,
);
await writeFile(
  new URL('docs/routing.md', root),
  `# Router\n\n${promote(router)}\n`,
);
await writeFile(
  new URL('docs/tracing.md', root),
  `# Performance tracing\n\n${promote(tracing)}\n`,
);

// The app shown at the top of the docs is also published as a runnable page, from the same code block
const introMarkdown = await readFile(new URL('docs/index.md', root), 'utf8');
const example = introMarkdown.match(
  /```html file=index\.html\n([\s\S]*?)\n```/,
);
if (!example) throw new Error('Missing example: docs/index.md file=index.html');
await mkdir(new URL('docs/example/', root), { recursive: true });
await writeFile(new URL('docs/example/index.html', root), `${example[1]}\n`);

// Wraps each line in its own element for CSS line numbers, closing and reopening highlight spans that cross lines
function numberLines(highlighted) {
  const open = [];
  return highlighted
    .split('\n')
    .map((line) => {
      const start = open.join('');
      for (const [tag] of line.matchAll(/<span[^>]*>|<\/span>/g))
        if (tag === '</span>') open.pop();
        else open.push(tag);
      return `<span class="line">${start}${line}${'</span>'.repeat(open.length)}</span>`;
    })
    .join('\n');
}

function highlight(text, lang = '') {
  const [name, ...options] = lang.split(' ');
  const language = name === 'html' ? 'xml' : name;
  const file = options.find((option) => option.startsWith('file='))?.slice(5);
  const code = hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : escape(text);
  const lines = text.split('\n').length;
  const pre = `<pre class="language-${escape(name || 'text')}"><code>${lines > 1 ? numberLines(code) : code}</code></pre>`;
  return file
    ? `<figure class="code"><figcaption>${escape(file)}</figcaption>${pre}</figure>\n`
    : `${pre}\n`;
}

const ids = new Set(['content', ...sections.map(({ slug }) => slug)]);
function uniqueId(text) {
  const base = headingId(text);
  let id = base;
  for (let count = 1; ids.has(id); count += 1) id = `${base}-${count}`;
  ids.add(id);
  return id;
}

// Each Markdown file is a section of the page: its title becomes an h2 with the slug as id
function render(markdown, page) {
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const level = page ? depth + 1 : depth;
        const id = page && depth === 1 ? page.slug : uniqueId(text);
        if (page && depth === 2) page.headings.push({ id, text });
        return `<h${level} id="${escape(id)}">${text}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const resolved = new URL(href, `${site}docs/`);
        if (!['http:', 'https:'].includes(resolved.protocol))
          throw new Error(`Unsafe documentation link: ${href}`);
        const [file, fragment] = href.split('#');
        const target = sections.find(({ slug }) => file === `${slug}.md`);
        const local = target
          ? `#${fragment ?? target.slug}`
          : href.startsWith('#') || /^(https?:)?\//.test(href)
            ? href
            : href.startsWith('../')
              ? href.slice(3)
              : `docs/${href}`;
        return `<a href="${escape(local)}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      code({ text, lang }) {
        return highlight(text, lang);
      },
      html({ text }) {
        return escape(text);
      },
    },
  });
  return marked.parse(markdown);
}

const intro = render(introMarkdown, null);
// The tab is sticky within its section, so the tab bar always names the file being read
const file = (name, labelledBy, content) =>
  `<section aria-labelledby="${labelledBy}"><div class="tab-bar" aria-hidden="true"><span class="tab">${name}</span></div><div class="doc">${content}</div></section>`;
const body = [file('index.md', 'picosm', intro)];
for (const page of sections) {
  page.headings = [];
  const markdown = await readFile(
    new URL(`docs/${page.slug}.md`, root),
    'utf8',
  );
  body.push(file(`${page.slug}.md`, page.slug, render(markdown, page)));
}
const tree = sections
  .map(
    ({ slug, headings }) =>
      `<li><a class="file" href="#${slug}">${slug}.md</a>${headings.length ? `<ul>${headings.map(({ id, text }) => `<li><a class="symbol" href="#${id}">${text}</a></li>`).join('')}</ul>` : ''}</li>`,
  )
  .join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(description)}">
  <meta name="generator" content="picosm documentation build">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
  <title>${escape(title)}</title>
  <link rel="canonical" href="${site}">
  <link rel="stylesheet" href="docs/site.css">
  <link rel="icon" type="image/svg+xml" href="docs/icon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="picosm">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${site}">
  <meta property="og:image" content="${site}docs/social.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escape(title)}">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <div class="workbench">
    <aside class="explorer">
      <nav aria-label="Documentation">
        <p class="folder">picosm</p>
        <ul class="tree"><li><span class="folder">docs</span><ul>
<li><a class="file" href="#picosm">index.md</a></li>
${tree}
</ul></li></ul>
      </nav>
    </aside>
    <main id="content">${body.join('\n')}</main>
  </div>
  <footer class="status-bar">
    <span>picosm ${escape(version)}</span>
    <span>ISC</span>
    <nav aria-label="Project">
      <a href="examples/">Live tour</a>
      <a href="https://www.npmjs.com/package/picosm">npm</a>
      <a href="https://github.com/yesil/picosm">GitHub</a>
      <a href="docs/assistant-guide.md">Assistant guide</a>
      <a href="llms.txt">llms.txt</a>
    </nav>
  </footer>
</body>
</html>
`;
for (const [, id] of html.matchAll(/href="#([^"]*)"/g))
  if (!ids.has(id)) throw new Error(`Link to missing anchor: #${id}`);
await writeFile(new URL('index.html', root), html);

await writeFile(
  new URL('llms.txt', root),
  `# picosm\n\n> State management for web apps written in plain HTML and JavaScript modules, with no bundler: observable classes with explicit actions, cached getters and batched notifications, and no dependencies. Documentation for version ${version}.\n\nOnly methods listed in \`observableActions\` notify subscribers and clear cached getters; assigning a field does neither. Notifications are delivered in a microtask, and async actions notify after their Promise settles. Every subscription returns a disposer.\n\n## Documentation\n\n- [Documentation](${site}): every section below on one page.\n${sections.map(({ slug, nav, description }) => `- [${nav}](${site}docs/${slug}.md): ${description}`).join('\n')}\n- [Coding assistant guide](${site}docs/assistant-guide.md): Rules and a complete example for writing picosm code.\n\n## Project\n\n- [npm](https://www.npmjs.com/package/picosm): Published package and releases.\n- [GitHub](https://github.com/yesil/picosm): Source, issues and license.\n- [Runnable example](${site}docs/example/): The single-file cart app from the top of the documentation.\n- [Live tour](${site}examples/): Every feature, running against the repository source.\n`,
);
await writeFile(
  new URL('sitemap.xml', root),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'docs/example/', 'examples/'].map((path) => `  <url><loc>${site}${path}</loc></url>`).join('\n')}\n</urlset>\n`,
);
console.log(
  `Built index.html (${sections.length} sections), the example page, llms.txt and sitemap.xml in ${fileURLToPath(root)}`,
);
