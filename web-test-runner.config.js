import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: ['src/**/*.test.js'],
  plugins: [esbuildPlugin({})],
};
