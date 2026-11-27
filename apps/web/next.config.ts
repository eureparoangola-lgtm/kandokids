import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kandokids/shared"],
  async rewrites() {
    return {
      // A app web (Expo) vive em public/app: qualquer rota /app/... que não seja ficheiro abre a app.
      fallback: [{ source: "/app/:path*", destination: "/app/index.html" }],
    };
  },
};

export default nextConfig;
