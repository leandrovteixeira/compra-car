import Link from 'next/link';

export function BrandSlot({ href = '/' }: { readonly href?: string }) {
  return (
    <Link
      aria-label="Ir para o início"
      className="inline-flex h-8 shrink-0 items-center rounded px-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href={href}
    >
      <span aria-hidden="true" className="min-[24rem]:hidden">
        CC
      </span>
      <span aria-hidden="true" className="hidden min-[24rem]:inline">
        Compra Car
      </span>
    </Link>
  );
}
