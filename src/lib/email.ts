// src/lib/email.ts
type PasswordResetEmailParams = {
    to: string
    resetUrl: string
    ttlMinutes: number
  }
  
  
  function escapeHtml(s: string) {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return s.replace(/[&<>"']/g, (ch) => map[ch]!)
  }  
  
  function passwordResetTemplate({ resetUrl, ttlMinutes }: { resetUrl: string; ttlMinutes: number }) {
    const safeUrl = escapeHtml(resetUrl)
    const subject = 'Réinitialisez votre mot de passe'
  
    const text =
  `Réinitialisation du mot de passe
  
  Cliquez sur ce lien pour définir un nouveau mot de passe (valide ${ttlMinutes} min) :
  ${resetUrl}
  
  Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.`
  
    const html =
  `<div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.5; color:#0f172a">
    <h2 style="margin:0 0 12px">Réinitialisez votre mot de passe</h2>
    <p style="margin:0 0 16px">Vous avez demandé un lien pour définir un nouveau mot de passe.</p>
    <p style="margin:0 0 16px">
      <a href="${safeUrl}"
         style="display:inline-block;padding:10px 14px;border-radius:12px;background:#0f172a;color:#fff;text-decoration:none">
         Définir un nouveau mot de passe
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#334155">
      Ce lien expire dans <strong>${ttlMinutes} minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#64748b">
      Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.
    </p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0" />
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Si le bouton ne fonctionne pas, copiez/collez ce lien :<br/>
      <span style="word-break:break-all">${safeUrl}</span>
    </p>
  </div>`
  
    return { subject, html, text }
  }
  
  export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<{ provider: string; id?: string }> {
    const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase()
    const from = process.env.EMAIL_FROM || ''
  
    if (!from && provider !== 'console') throw new Error('EMAIL_FROM manquant')
  
    const { subject, html, text } = passwordResetTemplate(params)
  
    if (provider === 'resend') {
      const key = process.env.RESEND_API_KEY || ''
      if (!key) throw new Error('RESEND_API_KEY manquant')
  
      const { Resend } = await import('resend')
      const resend = new Resend(key)
  
      const { data, error } = await resend.emails.send({
        from,
        to: [params.to],
        subject,
        html,
        text
      })
  
      if (error) throw new Error(`resend_failed:${error.message || 'unknown'}`)
      return { provider: 'resend', id: (data as any)?.id }
    }
  
    // Fallback DEV: log console
    console.log('[email:password-reset]', { to: params.to, subject, resetUrl: params.resetUrl })
    return { provider: 'console' }
  }
  