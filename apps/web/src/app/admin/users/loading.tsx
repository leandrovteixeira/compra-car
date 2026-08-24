export default function AdminUsersLoading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-900" />
      <div className="grid gap-4 md:hidden">
        {[0, 1, 2].map((item) => (
          <div
            className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50"
            key={item}
          />
        ))}
      </div>
      <div className="hidden h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50 md:block" />
      <p className="sr-only">Carregando usuários…</p>
    </section>
  );
}
