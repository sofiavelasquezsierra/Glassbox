import type { NextConfig } from "next";

const config: NextConfig = {
  // libpg-query loads a WASM build of the Postgres parser at runtime; keep it out of the bundle.
  serverExternalPackages: ["libpg-query"],
  poweredByHeader: false,
};

export default config;
