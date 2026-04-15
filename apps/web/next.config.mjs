import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadWorkspaceAndRootEnv } from "./env-loader.mjs";

const appDir = path.dirname(fileURLToPath(import.meta.url));
loadWorkspaceAndRootEnv(appDir);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["better-sqlite3"]
  },
  transpilePackages: ["@autocashback/ui", "@autocashback/domain", "@autocashback/db"]
};

export default nextConfig;
