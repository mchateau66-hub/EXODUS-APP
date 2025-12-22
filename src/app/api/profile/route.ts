import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromSession } from '@/lib/auth'

export async function GET() {
  const session = await getUserFromSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const profile = await prisma.athleteProfile.findUnique({
    where: { user_id: session.user.id },
  })

  return NextResponse.json(profile ?? null)
}

export async function POST(req: Request) {
  const session = await getUserFromSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({} as any))

  // debug optionnel
  console.log('PROFILE POST body:', body)

  const data = {
    goalType: body.goalType ?? 'custom',
    customGoal: body.customGoal ?? '',
    timeframe: body.timeframe ?? '',
    experienceLevel: body.experienceLevel ?? '',
    context: body.context ?? '',
    objectiveSummary: body.objectiveSummary ?? '',
  }

  const profile = await prisma.athleteProfile.upsert({
    where: { user_id: session.user.id },
    update: data,
    create: { user_id: session.user.id, ...data },
  })

  return NextResponse.json(profile)
}
