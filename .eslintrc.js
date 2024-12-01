module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        'no-console': 'warn',
        '@typescript-eslint/explict-function-return-type': 'error',
        '@typescript-eslint/no-explicit-any': 'warn'
    }
}