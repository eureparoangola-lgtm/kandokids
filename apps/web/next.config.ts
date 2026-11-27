import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kandokids/shared"],
  // Docker (Hetzner): self-contained server in .next/standalone. Vercel ignores this.
  ...(process.env.KANDOKIDS_STANDALONE
    ? { output: "standalone" as const, outputFileTracingRoot: path.join(__dirname, "../..") }
    : {}),
  async rewrites() {
    return {
      // A app web (Expo) vive em public/app: qualquer rota /app/... que não seja ficheiro abre a app.
      fallback: [{ source: "/app/:path*", destination: "/app/index.html" }],
    };
  },
};

export default nextConfig;
