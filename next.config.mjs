// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
    // Régle le warning dev (localhost ↔ 127.0.0.1)
    allowedDevOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  }
  
  export default nextConfig
  