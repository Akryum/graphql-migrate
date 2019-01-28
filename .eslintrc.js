module.exports = {
  extends: [
    'plugin:vue-libs/recommended',
  ],
  plugins: [
    'node',
  ],
  env: {
    'jest': true,
  },
  rules: {
    'indent': ['error', 2, {
      'MemberExpression': 'off',
    }],
    'node/no-extraneous-require': ['error'],
    'comma-dangle': ['error', 'always-multiline'],
  },
}
