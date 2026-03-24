"use client"

import { useFormState, useFormStatus } from "react-dom"
import Link from "next/link"
import {
  updatePreferencesAction,
  type UpdatePreferencesState,
} from "@/app/account/settings/actions"

const initialState: UpdatePreferencesState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
    >
      {pending ? "Enregistrement…" : "Enregistrer les préférences"}
    </button>
  )
}

export function SettingsPreferencesForm({
  theme,
  language,
}: {
  theme: string | null
  language: string | null
}) {
  const [state, formAction] = useFormState(updatePreferencesAction, initialState)

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <label htmlFor="pref-theme" className="mb-1 block text-sm text-[var(--text)]">
          Thème du profil (base de données)
        </label>
        <p className="mb-2 text-xs text-[var(--text-muted)]">
          Préférence métier enregistrée sur ton compte — distincte du thème d’affichage de
          l’interface (voir l’encadré ci-dessus).
        </p>
        <select
          id="pref-theme"
          name="theme"
          defaultValue={theme ?? ""}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          <option value="">Non défini</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
          <option value="system">Système</option>
        </select>
      </div>

      <div>
        <label htmlFor="pref-language" className="mb-1 block text-sm text-[var(--text)]">
          Langue
        </label>
        <select
          id="pref-language"
          name="language"
          defaultValue={language ?? ""}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        >
          <option value="">Non définie</option>
          <option value="fr">Français</option>
          <option value="en">Anglais</option>
        </select>
      </div>

      <SubmitButton />

      {state?.ok ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Préférences mises à jour.</p>
      ) : null}

      {state?.error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Autres champs du profil (bio, pays…)&nbsp;:{" "}
        <Link href="/account/edit" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
          éditeur de profil
        </Link>
        .
      </p>
    </form>
  )
}
