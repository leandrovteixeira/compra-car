import Link from 'next/link';

interface ModuleCardProps {
  readonly description: string;
  readonly href?: string;
  readonly status: string;
  readonly title: string;
}

export function ModuleCard({ description, href, status, title }: ModuleCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold text-slate-100">{title}</h2>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-400">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
    </>
  );

  return href ? (
    <Link
      className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-800 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      href={href}
    >
      {content}
    </Link>
  ) : (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">{content}</article>
  );
}
