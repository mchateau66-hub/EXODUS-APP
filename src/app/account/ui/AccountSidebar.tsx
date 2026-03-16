"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const items: NavItem[] = [
  {
    href: "/account",
    label: "Vue d’ensemble",
    description: "Résumé du compte",
  },
  {
    href: "/account/profile",
    label: "Profil",
    description: "Infos publiques et personnelles",
  },
  {
    href: "/account/security",
    label: "Sécurité",
    description: "Mot de passe et protection",
  },
  {
    href: "/account/preferences",
    label: "Préférences",
    description: "Affichage et expérience",
  },
  {
    href: "/account/billing",
    label: "Abonnement",
    description: "Plan et facturation",
  },
  {
    href: "/account/verification",
    label: "Vérification",
    description: "Statut et documents",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <nav className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <ul className="space-y-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "block rounded-xl px-3 py-3 transition",
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900",
                ].join(" ")}
              >
                <div className="text-sm font-medium">{item.label}</div>
                <div
                  className={[
                    "mt-1 text-xs",
                    active
                      ? "text-neutral-200 dark:text-neutral-700"
                      : "text-neutral-500 dark:text-neutral-400",
                  ].join(" ")}
                >
                  {item.description}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}