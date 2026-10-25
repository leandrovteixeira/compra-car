import type { ReactNode } from 'react';

export function CatalogPageHeading({ title, description }: { readonly title: string; readonly description: string }) {
  return <header className="border-b border-[#D6DEE3] pb-3">
    <h1 className="cc-type-page-title text-[#1A1D21]">{title}</h1>
    <p className="mt-1 text-sm text-[#61747B]">{description}</p>
  </header>;
}

export function CatalogActionRow({ children }: { readonly children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2 py-3">{children}</div>;
}
