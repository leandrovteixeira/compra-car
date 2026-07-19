'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface ComparisonToolbarProps {
  readonly onlyDifferences: boolean;
}

export function ComparisonToolbar({ onlyDifferences }: ComparisonToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleOnlyDifferences(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set('differences', 'true');
    else params.delete('differences');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-300">Uma linha independente para cada item comparável.</p>
      <label className="flex shrink-0 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          checked={onlyDifferences}
          className="size-4 accent-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          onChange={(event) => toggleOnlyDifferences(event.target.checked)}
          type="checkbox"
        />
        Mostrar apenas diferenças
      </label>
    </div>
  );
}
