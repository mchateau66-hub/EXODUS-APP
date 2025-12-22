'use client'

import { useEffect, useState } from 'react'

export type AthleteProfile = {
  id: string
  user_id: string
  goalType: string
  customGoal: string | null
  timeframe: string
  experienceLevel: string
  context: string
  objectiveSummary: string
}

export function useAthleteProfile() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/profile', { credentials: 'include' })
        if (!res.ok) throw new Error(`profile_${res.status}`)
        const json = (await res.json()) as AthleteProfile | null
        if (!cancelled) setProfile(json)
      } catch (e: any) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { profile, loading, error }
}
