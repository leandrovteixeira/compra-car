import { ComparisonState } from '@/components/comparison-state';

export default function ComparisonLoading() {
  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-slate-950 px-3 py-6 text-slate-50 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[100rem]">
        <div className="animate-pulse">
          <div className="h-3 w-24 rounded-full bg-slate-800" />
          <div className="mt-4 h-8 w-72 max-w-full rounded-xl bg-slate-800" />
          <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-slate-900" />
        </div>
        <div className="mt-8">
          <ComparisonState
            description="Organizando equipamentos e especificações dos veículos selecionados."
            kind="loading"
            title="Preparando comparação"
          />
        </div>
      </div>
    </main>
  );
}
