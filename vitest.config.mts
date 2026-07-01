import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // Playwright e2e specs live in ./e2e and have their own runner/config; keep them
    // out of Vitest's default include so the two test tools don't collide.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
