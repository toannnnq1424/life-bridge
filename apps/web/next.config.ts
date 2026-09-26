import path from "node:path";

import type { NextConfig } from "next";

const gatewayUrl = process.env.GATEWAY_URL ?? "http://127.0.0.1:3001";
const workspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
