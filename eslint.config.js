// Verificador de código (npm run lint). Regras do Expo + erros de React (hooks) como falha.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'updates/*', 'supabase/functions/*', 'scripts/icon/*'],
  },
  {
    rules: {
      // Quebra de regra de hooks trava o app: é erro
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      // Regras do React Compiler (o app não usa o compilador): dão alarme falso em Animated, relógio etc.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
