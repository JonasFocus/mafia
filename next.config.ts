import type { NextConfig } from "next";
import path from "node:path";

const e2eRendererFile = process.env.NEXT_PUBLIC_E2E === "1"
  ? "e2e-renderer.enabled.ts"
  : "e2e-renderer.ts";
const e2eRendererImport = `@/lib/game/${e2eRendererFile.replace(/\.ts$/, "")}`;
const e2eRendererPath = path.resolve(process.cwd(), "src/lib/game", e2eRendererFile);

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "game-e2e-renderer": e2eRendererImport,
    },
  },
  webpack(config) {
    config.resolve.alias["game-e2e-renderer"] = e2eRendererPath;
    return config;
  },
};

export default nextConfig;
