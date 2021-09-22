module.exports = {
  'env': {
    'node': true,
  },
  'extends': [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module',
  },
  'plugins': ['@typescript-eslint'],
  'rules': {
    'comma-dangle': ['error', { 'objects': 'always-multiline', 'functions': 'never', 'arrays': 'never', 'imports': 'never' }],
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'no-inner-declarations': 'off',
    'semi': ['error', 'never'],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
}
