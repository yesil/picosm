const example = process.env.EXAMPLE || 'cart';
const appIndex = `/examples/${example}/index.html`;

export default {
  rootDir: '.',
  open: appIndex,
  middleware: [
    function rewriteToExample(ctx, next) {
      // Serve the example index.html for / and any non-file paths (SPA fallback)
      if (
        ctx.url === '/' ||
        (!ctx.url.includes('.') &&
          !ctx.url.startsWith('/node_modules') &&
          !ctx.url.startsWith('/dist') &&
          !ctx.url.startsWith('/src') &&
          !ctx.url.startsWith('/examples'))
      ) {
        ctx.url = appIndex;
      }
      return next();
    },
  ],
};
