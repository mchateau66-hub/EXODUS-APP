import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Fix build : désactive l’étape ESLint intégrée à `next build`
  // (utile quand tu es sur ESLint 9+ et que Next déclenche "Invalid Options")
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { dev }) => {
    // Fix: évite les erreurs PackFileCacheStrategy (.next/cache/webpack/*.pack)
    if (!dev) {
      config.cache = false;
    }
    return config;
  },

  // E2E_LOGIN_REWRITE (do not remove)
  async rewrites() {
    return {
      // ✅ CRITIQUE : appliqué AVANT le matching des routes (/api/login)
      beforeFiles: [
        {
          source: "/api/login",
          has: [{ type: "header", key: "x-e2e", value: "1" }],
          destination: "/api/e2e/login",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
