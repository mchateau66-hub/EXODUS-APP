'use client'

import Link from 'next/link'
import {
  FormEvent,
  KeyboardEvent,
  useMemo,
  useState,
  type HTMLAttributes,
} from 'react'
import { maskPII } from '@/lib/pii'
import { useEntitlements } from '@/lib/entitlements'

type ComposerMode = 'default' | 'quota' | 'trial_expired' | 'coach_limit'

type ComposerProps = {
  onSend: (payload: { text: string }) => Promise<void> | void
  disabled?: boolean
  error?: string | null
  mode?: ComposerMode
  upgradeHref?: string
  quotaRemaining?: number | null
  quotaLimit?: number | null
} & HTMLAttributes<HTMLFormElement>

export default function Composer({
  onSend,
  disabled,
  error,
  mode,
  upgradeHref = '/paywall?next=/messages',
  quotaRemaining = null,
  quotaLimit = null,
  ...formProps
}: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const { data: ent } = useEntitlements()
  const features = ent?.features ?? []
  const plan = ent?.plan ?? 'free'

  const hasMessagesUnlimited = features.includes('messages.unlimited' as any)
  const isPaidPlan = plan === 'master' || plan === 'premium'
  const canReveal = hasMessagesUnlimited || isPaidPlan

  const inferredMode: ComposerMode = useMemo(() => {
    if (mode) return mode
    const msg = (error ?? '').toLowerCase()
    if (msg.includes('essai') || msg.includes('période d’essai') || msg.includes('trial')) return 'trial_expired'
    if (msg.includes('limite') || msg.includes('quota') || msg.includes('messages restants')) return 'quota'
    if (msg.includes('ne peut plus accepter') || msg.includes('nouveaux athlètes')) return 'coach_limit'
    return 'default'
  }, [mode, error])

  const canSend = !disabled && !sending && text.trim().length > 0
  const blocked = !!disabled && !sending

  const showUpgradeCta =
    blocked &&
    !canReveal &&
    (inferredMode === 'quota' || inferredMode === 'trial_expired')

  const placeholder = useMemo(() => {
    if (blocked) {
      if (inferredMode === 'trial_expired') return 'Essai terminé : déverrouille la messagerie pour continuer…'
      if (inferredMode === 'quota') return 'Quota atteint : passe en illimité pour continuer…'
      return 'Messagerie momentanément indisponible…'
    }
    return canReveal ? 'Votre message au coach…' : "Plan Free : emails/téléphones/pseudos seront masqués."
  }, [blocked, inferredMode, canReveal])

  const headerHint = useMemo(() => {
    if (!blocked) return null

    if (inferredMode === 'trial_expired') {
      return { tone: 'danger' as const, title: 'Essai terminé', subtitle: 'Passe en Premium pour envoyer de nouveaux messages.' }
    }
    if (inferredMode === 'quota') {
      const quotaLine =
        typeof quotaRemaining === 'number' && typeof quotaLimit === 'number'
          ? `Quota : ${Math.max(0, quotaRemaining)}/${quotaLimit} restant(s)`
          : 'Quota du plan Free atteint.'
      return { tone: 'warning' as const, title: 'Quota atteint', subtitle: quotaLine }
    }
    if (inferredMode === 'coach_limit') {
      return { tone: 'warning' as const, title: 'Coach indisponible', subtitle: "Ce coach a atteint sa limite d’athlètes sur son plan actuel." }
    }
    return { tone: 'neutral' as const, title: 'Envoi désactivé', subtitle: 'Tu peux toujours lire l’historique.' }
  }, [blocked, inferredMode, quotaRemaining, quotaLimit])

  async function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault()
    if (!canSend) return

    const raw = text.trim()
    const safeText = maskPII(raw, canReveal)

    setSending(true)
    try {
      await onSend({ text: safeText })
      setText('')
    } catch (err) {
      console.error('Erreur envoi message', err)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (disabled) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const hintToneClasses =
    headerHint?.tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : headerHint?.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white px-3 py-2" {...formProps}>
      {headerHint && (
        <div className={`mb-2 rounded-2xl border px-3 py-2 text-[11px] ${hintToneClasses}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{headerHint.title}</div>
              <div className="opacity-90">{headerHint.subtitle}</div>
            </div>

            {showUpgradeCta && (
              <Link
                href={upgradeHref}
                className="inline-flex h-7 items-center justify-center rounded-full bg-slate-900 px-3 text-[11px] font-medium text-white hover:bg-slate-800"
              >
                Débloquer (Premium)
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            data-testid="composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/40 disabled:cursor-not-allowed disabled:bg-slate-50"
            placeholder={placeholder}
            disabled={disabled}
          />

          <p className="mt-1 text-[10px] text-slate-500">
            Entrée pour envoyer • Maj+Entrée pour un retour à la ligne.
          </p>

          {!canReveal && !blocked && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Les emails et numéros de téléphone sont masqués tant que vous n’avez pas débloqué la messagerie illimitée.
            </p>
          )}

          {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
        </div>

        <button
          data-testid="composer-send"
          type="submit"
          disabled={!canSend}
          className={`mb-1 inline-flex h-9 items-center rounded-2xl px-4 text-sm font-medium ${
            canSend ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500'
          }`}
        >
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </form>
  )
}
