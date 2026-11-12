import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Turso driver (optional hosting) loads from node_modules at runtime instead of being bundled.
  // The local database uses Node's built-in SQLite, so it needs nothing here.
  serverExternalPackages: ["@libsql/client"],
  // The default data in seed/*.json is read at runtime; ship it with the API routes.
  outputFileTracingIncludes: { "/api/**/*": ["./seed/**/*"] },
};

export default nextConfig;
