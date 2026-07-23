import Link from 'next/link';

export function AdminProductError() {
  return (
    <section
      aria-labelledby="admin-product-error-title"
      className="rounded-2xl border border-rose-900/70 bg-rose-950/20 px-5 py-10 text-center sm:px-8"
      role="alert"
    >
      <h2 className="text-lg font-semibold text-rose-200" id="admin-product-error-title">
        Não foi possível carregar os veículos
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
        Tente novamente. Se o problema continuar, verifique a disponibilidade do catálogo.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-800 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        href="/admin/products"
      >
        Recarregar página
      </Link>
    </section>
  );
}
