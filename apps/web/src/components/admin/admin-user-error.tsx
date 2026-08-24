export function AdminUserError() {
  return (
    <section
      className="rounded-2xl border border-rose-900/70 bg-rose-950/20 px-5 py-8"
      role="alert"
    >
      <h2 className="font-semibold text-rose-200">Não foi possível carregar os usuários.</h2>
      <p className="mt-2 text-sm text-rose-300/80">Tente novamente em alguns instantes.</p>
    </section>
  );
}
