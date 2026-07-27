export default function AdminPricesLoading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-900" />
      <div className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
      <p className="sr-only">Carregando preços públicos…</p>
    </section>
  );
}
