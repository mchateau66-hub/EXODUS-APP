import Link from "next/link"
import { redirect } from "next/navigation"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getEffectiveFeatures } from "@/lib/entitlements.server"
import type { Role, SubStatus, UserStatus } from "@prisma/client"
import { SettingsShell } from "@/components/account/settings/settings-shell"
import {
  SettingsFactRow,
  SettingsFactsList,
  SettingsInfoBox,
  SettingsSection,
} from "@/components/account/settings/settings-section"
import { SettingsPreferencesForm } from "@/components/account/settings/settings-preferences-form"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function maskUserId(id: string): string {
  if (id.length <= 13) return `${id.slice(0, 4)}…`
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

function roleLabel(role: Role): string {
  if (role === "athlete") return "Athlète"
  if (role === "coach") return "Coach"
  if (role === "admin") return "Administrateur"
  return role
}

function userStatusLabel(s: UserStatus): string {
  const m: Record<UserStatus, string> = {
    active: "Actif",
    disabled: "Désactivé",
    deleted: "Supprimé",
  }
  return m[s] ?? s
}

function subStatusLabel(s: SubStatus): string {
  const m: Record<SubStatus, string> = {
    incomplete: "Incomplet",
    trialing: "Période d’essai",
    active: "Actif",
    past_due: "Paiement en retard",
    canceled: "Résilié",
    unpaid: "Impayé",
  }
  return m[s] ?? s
}

function formatDateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d)
}

type SettingsViewModel = {
  profile: {
    email: string
    displayName: string | null
    role: Role
    roleLabel: string
    onboardingStep: number
  }
  security: {
    hasSession: boolean
    userIdMasked: string
    hasPassword: boolean
  }
  preferences: {
    userTheme: string | null
    language: string | null
  }
  privacy: {
    accountStatus: UserStatus
    accountStatusLabel: string
    createdAtLabel: string
  }
  billing: {
    stripeCustomerIdPresent: boolean
    subscription: null | {
      planKey: string | null
      planName: string | null
      status: SubStatus
      statusLabel: string
      currentPeriodEnd: Date | null
      cancelAtPeriodEnd: boolean
    }
    effectiveFeatures: string[]
  }
}

function SettingsAccountSummary({ vm }: { vm: SettingsViewModel }) {
  const abonnementMain = vm.billing.subscription
    ? `${vm.billing.subscription.planName ?? vm.billing.subscription.planKey ?? "Offre"} · ${vm.billing.subscription.statusLabel}`
    : "Aucun abonnement actif"

  const droits =
    vm.billing.effectiveFeatures.length > 0
      ? `${vm.billing.effectiveFeatures.length} fonctionnalité(s) active(s) (vue agrégée)`
      : "Non disponible"

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--card-shadow)] md:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Aperçu du compte</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Lecture seule — détail par section ci-dessous.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">E-mail</div>
          <div className="mt-1 break-all text-sm font-medium text-[var(--text)]">{vm.profile.email}</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Rôle</div>
          <div className="mt-1 text-sm font-medium text-[var(--text)]">{vm.profile.roleLabel}</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Statut du compte</div>
          <div className="mt-1 text-sm font-medium text-[var(--text)]">{vm.privacy.accountStatusLabel}</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Abonnement</div>
          <div className="mt-1 text-sm font-medium text-[var(--text)]">{abonnementMain}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{droits}</div>
        </div>
      </div>
    </div>
  )
}

export default async function AccountSettingsPage() {
  const session = await getUserFromSession()
  if (!session) redirect("/login?next=/account/settings")

  const userId = session.user?.id
  if (!userId) redirect("/login?next=/account/settings")

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      onboardingStep: true,
      theme: true,
      language: true,
      status: true,
      created_at: true,
      passwordHash: true,
      stripe_customer_id: true,
    },
  })
  if (!user) redirect("/login?next=/account/settings")

  const onboardingStep = user.onboardingStep ?? 0
  if (onboardingStep < 1) redirect("/onboarding")
  if (onboardingStep < 2) redirect("/onboarding/step-2")
  if (onboardingStep < 3) redirect("/onboarding/step-3")

  const [subscription, effectiveFeatures] = await Promise.all([
    prisma.subscription.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        plan_key: true,
        status: true,
        current_period_end: true,
        cancel_at_period_end: true,
        plan: { select: { key: true, name: true } },
      },
    }),
    getEffectiveFeatures(userId),
  ])

  const settingsViewModel: SettingsViewModel = {
    profile: {
      email: user.email,
      displayName: user.name,
      role: user.role,
      roleLabel: roleLabel(user.role),
      onboardingStep: user.onboardingStep ?? 0,
    },
    security: {
      hasSession: true,
      userIdMasked: maskUserId(user.id),
      hasPassword: Boolean(user.passwordHash),
    },
    preferences: {
      userTheme: user.theme,
      language: user.language,
    },
    privacy: {
      accountStatus: user.status,
      accountStatusLabel: userStatusLabel(user.status),
      createdAtLabel: formatDateFr(user.created_at),
    },
    billing: {
      stripeCustomerIdPresent: Boolean(user.stripe_customer_id?.trim()),
      subscription: subscription
        ? {
            planKey: subscription.plan_key,
            planName: subscription.plan?.name ?? null,
            status: subscription.status,
            statusLabel: subStatusLabel(subscription.status),
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }
        : null,
      effectiveFeatures,
    },
  }

  const vm = settingsViewModel

  return (
    <SettingsShell subtitle={vm.profile.email} summary={<SettingsAccountSummary vm={vm} />}>
      <SettingsSection
        id="profile"
        title="Profil"
        description="Lecture des données compte — la modification se fait dans l’éditeur de profil ou sur Mon compte."
      >
        <SettingsFactsList>
          <SettingsFactRow
            label="Nom"
            value={vm.profile.displayName?.trim() ? vm.profile.displayName : "Non renseigné"}
          />
          <SettingsFactRow label="E-mail" value={vm.profile.email} />
          <SettingsFactRow label="Rôle" value={vm.profile.roleLabel} />
          <SettingsFactRow label="Étape d’onboarding" value={String(vm.profile.onboardingStep)} />
        </SettingsFactsList>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account/edit"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95"
          >
            Modifier le profil
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            Mon compte
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection
        id="security"
        title="Sécurité"
        description="Session active et identifiants techniques — la gestion de session passe par la connexion."
      >
        <SettingsFactsList>
          <SettingsFactRow
            label="Session"
            value={vm.security.hasSession ? "Session active (page authentifiée)." : "—"}
          />
          <SettingsFactRow label="ID utilisateur" value={<span className="font-mono text-xs">{vm.security.userIdMasked}</span>} />
          <SettingsFactRow
            label="Mot de passe"
            value={
              vm.security.hasPassword
                ? "Un mot de passe est enregistré pour ce compte."
                : "Aucun mot de passe enregistré en base pour ce compte."
            }
          />
        </SettingsFactsList>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Pour ouvrir une autre session ou réinitialiser l’accès, utilise le flux de connexion.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95"
          >
            Connexion (autre compte)
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            Mon compte
          </Link>
        </div>
      </SettingsSection>

      <SettingsSection
        id="notifications"
        title="Notifications"
        description="Aucune préférence de notification n’est stockée dans l’application pour l’instant."
      >
        <p className="text-sm text-[var(--text-muted)]">
          Les réglages détaillés ne sont pas disponibles ici. Les préférences générales (langue,
          thème) sont gérées dans{" "}
          <Link href="/account/edit" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
            Préférences du profil
          </Link>
          .
        </p>
      </SettingsSection>

      <SettingsSection
        id="preferences"
        title="Préférences"
        description="Thème et langue enregistrés sur ton profil (base de données). Le thème global de l’interface est géré à part."
      >
        <SettingsInfoBox>
          <span className="font-medium text-[var(--text)]">Thème UI (appareil)</span> : réglage
          local via le sélecteur de thème (stockage navigateur, clé dédiée), sans impact sur la
          base.
          <br />
          <span className="font-medium text-[var(--text)]">Thème du profil</span> : préférence
          métier ci-dessous, distincte du thème UI.
        </SettingsInfoBox>
        <SettingsPreferencesForm
          theme={vm.preferences.userTheme}
          language={vm.preferences.language}
        />
      </SettingsSection>

      <SettingsSection
        id="privacy"
        title="Confidentialité"
        description="Transparence sur les données du compte."
      >
        <SettingsFactsList>
          <SettingsFactRow label="Statut du compte" value={vm.privacy.accountStatusLabel} />
          <SettingsFactRow label="Création du compte" value={vm.privacy.createdAtLabel} />
          <SettingsFactRow
            label="E-mail enregistré"
            value={<span className="break-all">{vm.profile.email}</span>}
          />
        </SettingsFactsList>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Aucune page « politique de confidentialité » dédiée n’est référencée dans l’application
          pour l’instant.
        </p>
      </SettingsSection>

      <SettingsSection
        id="billing"
        title="Abonnement"
        description="Stripe et droits effectifs — le parcours complet (paiement, offre) est sur Mon compte."
      >
        <SettingsFactsList>
          <SettingsFactRow
            label="Client Stripe"
            value={vm.billing.stripeCustomerIdPresent ? "Identifiant client présent." : "Aucun identifiant client Stripe enregistré."}
          />
          {vm.billing.subscription ? (
            <>
              <SettingsFactRow
                label="Offre (plan)"
                value={
                  vm.billing.subscription.planName?.trim()
                    ? `${vm.billing.subscription.planName}${vm.billing.subscription.planKey ? ` (${vm.billing.subscription.planKey})` : ""}`
                    : vm.billing.subscription.planKey ?? "Non renseigné"
                }
              />
              <SettingsFactRow label="Statut" value={vm.billing.subscription.statusLabel} />
              <SettingsFactRow
                label="Fin de période"
                value={
                  vm.billing.subscription.currentPeriodEnd
                    ? formatDateFr(vm.billing.subscription.currentPeriodEnd)
                    : "Non renseigné"
                }
              />
              <SettingsFactRow
                label="Résiliation en fin de période"
                value={vm.billing.subscription.cancelAtPeriodEnd ? "Oui" : "Non"}
              />
            </>
          ) : (
            <SettingsFactRow
              label="Abonnement"
              value="Aucune ligne d’abonnement trouvée pour ce compte (plus récent par date de création)."
            />
          )}
        </SettingsFactsList>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Fonctionnalités effectives (vue SQL)
          </p>
          {vm.billing.effectiveFeatures.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text)]">
              {vm.billing.effectiveFeatures.map((f) => (
                <li key={f} className="break-all">
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Aucune fonctionnalité listée (vue absente, vide, ou droits non agrégés).
            </p>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/account"
            className="inline-flex items-center rounded-[var(--radius-md)] bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-primary-fg)] shadow-sm transition-opacity hover:opacity-95"
          >
            Gérer l’abonnement
          </Link>
        </div>
      </SettingsSection>
    </SettingsShell>
  )
}
