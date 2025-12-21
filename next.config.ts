import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ✅ Fix build : désactive l’étape ESLint intégrée à `next build`
  // (utile quand tu es sur ESLint 9+ et que Next déclenche "Invalid Options")
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { dev }) => {
    // Fix: évite les erreurs PackFileCacheStrategy (.next/cache/webpack/*.pack)
    if (!dev) {
      config.cache = false
    }
    return config
  },
}

export default nextConfig
