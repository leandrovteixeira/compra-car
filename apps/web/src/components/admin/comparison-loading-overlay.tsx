export function ComparisonLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1D21]/35 backdrop-blur-[2px]"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[#D6DEE3] bg-white/95 px-8 py-6 shadow-2xl">
        <div className="relative grid size-20 place-items-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-2xl border-2 border-[#9ABCC8] border-t-[#EF7732]"
          />
        </div>
        <p className="text-sm font-medium text-[#1A1D21]">Carregando</p>
      </div>
    </div>
  );
}
