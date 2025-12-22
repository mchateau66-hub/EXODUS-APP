// e2e/helpers/resend.ts
type ResendList = {
    object: 'list'
    data: Array<{ id: string; to: string[]; subject: string; created_at: string }>
  }
  
  type ResendEmail = {
    object: 'email'
    id: string
    to: string[]
    subject: string
    html: string | null
    text: string | null
  }
  
  async function resendFetch<T>(path: string, apiKey: string): Promise<T> {
    const r = await fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` } // doc auth :contentReference[oaicite:8]{index=8}
    })
    if (!r.ok) throw new Error(`resend_http_${r.status}`)
    return r.json() as Promise<T>
  }
  
  export async function waitForPasswordResetUrlFromResend(opts: {
    apiKey: string
    to: string
    subjectIncludes?: string
    timeoutMs?: number
  }) {
    const { apiKey, to } = opts
    const subjectIncludes = opts.subjectIncludes ?? 'Réinitialisez votre mot de passe'
    const timeoutMs = opts.timeoutMs ?? 60_000
  
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const list = await resendFetch<ResendList>(`/emails?limit=100`, apiKey) // list emails :contentReference[oaicite:9]{index=9}
      const hit = list.data.find(e => e.to?.includes(to) && (e.subject || '').includes(subjectIncludes))
      if (hit) {
        const email = await resendFetch<ResendEmail>(`/emails/${hit.id}`, apiKey) // retrieve :contentReference[oaicite:10]{index=10}
        const blob = (email.html || '') + '\n' + (email.text || '')
        const m = blob.match(/https?:\/\/[^\s"']+\/reset-password\?token=[^&\s"']+/)
        if (m?.[0]) return m[0]
      }
      await new Promise(r => setTimeout(r, 1500)) // éviter rate-limit Resend
    }
    throw new Error('reset_email_not_found')
  }
  