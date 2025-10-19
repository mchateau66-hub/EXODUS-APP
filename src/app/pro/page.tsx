export default function ProPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Espace Pro (protégé)</h1>
      <p className="mt-2 text-slate-600">
        Accès autorisé car cookie <code>session</code> présent.
      </p>
    </main>
  )
}
