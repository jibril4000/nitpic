import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["daemon/test/**/*.test.ts"],
    testTimeout: 15000,
  },
});
