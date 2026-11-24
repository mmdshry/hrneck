import { defineConfig } from "vitest/config";
import path from "node:path";

// Only tests that touch the DOM pay for jsdom; pure logic runs in plain node.
const domTestFiles = ["src/lib/api.test.ts", "src/lib/tenant.test.ts"];

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: domTestFiles,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", ...domTestFiles],
        },
      },
    ],
  },
});
