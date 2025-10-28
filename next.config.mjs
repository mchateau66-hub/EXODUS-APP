/** @type {import('next').NextConfig} */
const nextConfig = {
  // Autorise les requêtes cross-origin en DEV (HMR, /_next/*) depuis 127.0.0.1 et localhost
  allowedDevOrigins: [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  process.env.E2E_BASE_URL || undefined, // utile si les E2E pointent ailleurs
  ].filter(Boolean),
  
  experimental: {
  // Si tu utilises des Server Actions déclenchées depuis une autre origine
  serverActions: {
  allowedOrigins: [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  process.env.E2E_BASE_URL || undefined,
  ].filter(Boolean),
  },
  },
  }
  
  export default nextConfig