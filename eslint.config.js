export default [
  { ignores: ["node_modules/**", ".artifacts/**"] },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "valid-typeof": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
];
