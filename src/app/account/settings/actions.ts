"use server"

import { revalidatePath } from "next/cache"
import { getUserFromSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

export type UpdatePreferencesState = {
  ok: boolean
  error?: string
}

const ALLOWED_THEMES = ["light", "dark", "system"]
const ALLOWED_LANGUAGES = ["fr", "en"]

export async function updatePreferencesAction(
  _: UpdatePreferencesState,
  formData: FormData,
): Promise<UpdatePreferencesState> {
  const session = await getUserFromSession()
  const userId = session?.user?.id
  if (!userId) {
    return { ok: false, error: "Non authentifié" }
  }

  const themeRaw = formData.get("theme")
  const languageRaw = formData.get("language")
  const theme = typeof themeRaw === "string" ? themeRaw.trim() : ""
  const language = typeof languageRaw === "string" ? languageRaw.trim() : ""

  if (theme !== "" && !ALLOWED_THEMES.includes(theme)) {
    return { ok: false, error: "Thème invalide" }
  }

  if (language !== "" && !ALLOWED_LANGUAGES.includes(language)) {
    return { ok: false, error: "Langue invalide" }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        theme: theme === "" ? null : theme,
        language: language === "" ? null : language,
      },
    })

    revalidatePath("/account/settings")
    revalidatePath("/account")

    return { ok: true }
  } catch {
    return { ok: false, error: "Erreur serveur" }
  }
}
