import Link from "next/link"

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-[var(--text-muted)]">
          © {new Date().getFullYear()} Rencontre Coach
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
          <Link href="#features" className="hover:text-[var(--text)]">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-[var(--text)]">
            Pricing
          </Link>
          <Link href="#faq" className="hover:text-[var(--text)]">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  )
}
