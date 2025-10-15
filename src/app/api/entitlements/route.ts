import { NextRequest } from 'next/server'
import { signEntitlements } from '@/lib/jwt'
function getUser(req: NextRequest){ return { sub: req.headers.get('x-user-id') || 'demo-user', plan: (new URL(req.url).searchParams.get('plan')) || 'premium' } }
export async function GET(req: NextRequest){
  const { sub, plan } = getUser(req)
  const token = await signEntitlements({ sub, plan })
  return Response.json({ entitlements: token }, { headers: { 'cache-control': 'no-store' } })
}
