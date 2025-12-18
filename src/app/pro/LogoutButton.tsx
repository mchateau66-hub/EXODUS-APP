// src/app/pro/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // on ignore les erreurs réseau ici, on force juste le retour login
    }
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
    >
      Se déconnecter
    </button>
  );
}
