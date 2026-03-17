import { redirect } from "next/navigation"
import { getUserFromSession } from "@/lib/auth"
import { SettingsShell } from "@/components/settings/settings-shell"
import { SettingsProfileSection } from "@/components/settings/sections/settings-profile-section"
import { SettingsSecuritySection } from "@/components/settings/sections/settings-security-section"
import { SettingsNotificationsSection } from "@/components/settings/sections/settings-notifications-section"
import { SettingsPreferencesSection } from "@/components/settings/sections/settings-preferences-section"
import { SettingsPrivacySection } from "@/components/settings/sections/settings-privacy-section"
import { SettingsBillingSection } from "@/components/settings/sections/settings-billing-section"

export default async function AccountSettingsPage() {
  const ctx = await getUserFromSession()

  if (!ctx?.user) {
    redirect("/login?next=/account/settings")
  }

  return (
    <SettingsShell
      title="Paramètres"
      description="Gère ton profil, ta sécurité, tes préférences et ton abonnement."
    >
      <SettingsProfileSection />
      <SettingsSecuritySection />
      <SettingsNotificationsSection />
      <SettingsPreferencesSection />
      <SettingsPrivacySection />
      <SettingsBillingSection />
    </SettingsShell>
  )
}