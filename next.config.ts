import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers load from node_modules at runtime instead of being bundled:
  // better-sqlite3 (local file, native module) and @libsql/client (Turso).
  serverExternalPackages: ["better-sqlite3", "@libsql/client"],
  // The default data in seed/*.json is read at runtime; ship it with the API routes.
  outputFileTracingIncludes: { "/api/**/*": ["./seed/**/*"] },
};

export default nextConfig;
