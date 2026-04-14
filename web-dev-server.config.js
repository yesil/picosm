const example = process.env.EXAMPLE || 'cart';
const exampleBase = `/examples/${example}/`;
const appIndex = `${exampleBase}index.html`;

export default {
  rootDir: '.',
  open: appIndex,
  middleware: [
    function spaFallback(ctx, next) {
      // SPA fallback: non-file requests under the example path serve index.html
      if (ctx.url.startsWith(exampleBase) && !ctx.url.includes('.')) {
        ctx.url = appIndex;
      }
      return next();
    },
  ],
};
