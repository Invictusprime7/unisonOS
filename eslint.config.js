import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".vercel/**",
      ".artifacts/**",
      "zip_extract/**",
      "docs/knowledge/references/dream-design/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/set-state-in-effect": "off", 
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-compiler/react-compiler": "off",
      "prefer-const": "warn",
      "no-case-declarations": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/prefer-ts-expect-error": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": "warn",
    },
  },
);
