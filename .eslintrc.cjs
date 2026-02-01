module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: true
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  settings: {
    react: {
      version: "detect"
    }
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "react/react-in-jsx-scope": "off"
  }
};
