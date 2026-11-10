import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // LHCI configs are CommonJS consumed by the CLI, not app modules.
    "lighthouse/**",
  ]),
  {
    rules: {
      // Existing app patterns; keep as warnings so CI/deploy can stay green.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "no-alert": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "alert",
          message: "Use toast helpers or ConfirmDialog/PromptDialog instead.",
        },
        {
          name: "confirm",
          message: "Use ConfirmDialog instead of window.confirm.",
        },
        {
          name: "prompt",
          message: "Use PromptDialog instead of window.prompt.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "alert",
          message: "Use toast helpers or ConfirmDialog/PromptDialog instead.",
        },
        {
          object: "window",
          property: "confirm",
          message: "Use ConfirmDialog instead of window.confirm.",
        },
        {
          object: "window",
          property: "prompt",
          message: "Use PromptDialog instead of window.prompt.",
        },
      ],
    },
  },
]);

export default eslintConfig;
