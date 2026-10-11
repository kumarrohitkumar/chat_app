import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./tests/globalSetup.js",
    setupFiles: "./tests/setup.js",
    // One in-memory Mongo shared by the suite, so files must not run in
    // parallel against the same collections.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
