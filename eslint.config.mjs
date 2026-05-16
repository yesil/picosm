import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const config = {
  ...eslintPluginPrettierRecommended,
};

export default [
  { ignores: ['dist/**', 'examples/**/swc.js'] },
  config,
];
